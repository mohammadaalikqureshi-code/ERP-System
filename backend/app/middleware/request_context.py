"""Request-level middleware: identity, timing and back-pressure.

Three concerns, deliberately kept small and separate:

  RequestContextMiddleware  gives every request an id and logs how long it took
  ConcurrencyLimitMiddleware  sheds load instead of collapsing under it
"""

import asyncio
import logging
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import request_id_var, user_id_var

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Tag each request with an id and record its duration.

    The id is echoed back in the `X-Request-ID` header, so when a user reports
    "it failed at 3pm" you can find exactly their request in the logs. If the
    caller already sent one (from a load balancer or the frontend), it is kept.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        request_id_var.set(request_id)
        user_id_var.set("-")
        request.state.request_id = request_id

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "Unhandled error",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            raise

        duration_ms = (time.perf_counter() - started) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers["X-Response-Time-ms"] = f"{duration_ms:.1f}"

        # Only log slow or failed requests, so normal traffic stays quiet.
        if duration_ms >= settings.SLOW_REQUEST_MS or response.status_code >= 400:
            logger.warning(
                "Request completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                    "slow": duration_ms >= settings.SLOW_REQUEST_MS,
                },
            )

        return response


class ConcurrencyLimitMiddleware(BaseHTTPMiddleware):
    """Cap how many requests are processed at once.

    Without this, a traffic spike queues work until the database pool is
    exhausted and *every* request times out. With it, requests beyond the limit
    are refused immediately with 503 and a `Retry-After`, so the requests
    already in flight still complete. Health probes are never refused.
    """

    def __init__(self, app, max_concurrent: int | None = None):
        super().__init__(app)
        limit = max_concurrent or settings.MAX_CONCURRENT_REQUESTS
        self._semaphore = asyncio.Semaphore(limit)
        self._limit = limit

    async def dispatch(self, request: Request, call_next):
        if request.url.path.endswith(("/health", "/ready")):
            return await call_next(request)

        if self._semaphore.locked():
            logger.warning(
                "Concurrency limit reached", extra={"limit": self._limit, "path": request.url.path}
            )
            return JSONResponse(
                status_code=503,
                headers={"Retry-After": "2"},
                content={
                    "error": {
                        "code": "server_busy",
                        "message": "The server is busy right now. Please try again in a moment.",
                        "details": [],
                    }
                },
            )

        async with self._semaphore:
            return await call_next(request)
