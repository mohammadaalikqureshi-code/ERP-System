"""Rate limiting, backed by Redis so it works across multiple API processes.

Two levels:
  * a global per-IP limit applied to every request (RateLimitMiddleware)
  * tighter per-endpoint limits for expensive or attackable routes (`rate_limiter`)

Both use a fixed window counter: one Redis key per window, incremented per
request. It is cheap (one round trip) and accurate enough for protecting an
API. If Redis is unavailable the limiter fails open — a monitoring outage
should never stop a clinic from booking patients.
"""

import logging
import time
from typing import Callable, Optional

from fastapi import Depends, Request
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import BaseAPIException
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


class RateLimitExceeded(BaseAPIException):
    def __init__(self, retry_after: int):
        super().__init__(
            message=f"Too many requests. Please try again in {retry_after} seconds.",
            code="rate_limited",
            status_code=429,
        )
        self.retry_after = retry_after


def client_key(request: Request) -> str:
    """Identify the caller.

    Behind a load balancer the socket address is the balancer, so trust
    `X-Forwarded-For` when present and take the original client from it.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


_redis_warning_logged = False

async def _hit(redis: Redis, key: str, limit: int, window: int) -> tuple[bool, int]:
    """Count one request. Returns (allowed, seconds until the window resets)."""
    global _redis_warning_logged
    bucket = int(time.time()) // window
    redis_key = f"ratelimit:{key}:{bucket}"

    try:
        async with redis.pipeline() as pipe:
            pipe.incr(redis_key)
            pipe.expire(redis_key, window)
            count, _ = await pipe.execute()
    except Exception:
        # Fail open: never block clinical work because Redis is down.
        if not _redis_warning_logged:
            logger.info("Rate limiter operating in passive fail-open mode (Redis not connected)")
            _redis_warning_logged = True
        return True, 0

    reset_in = window - (int(time.time()) % window)
    return int(count) <= limit, reset_in


def rate_limiter(limit: int, window: int = 60, scope: Optional[str] = None) -> Callable:
    """Dependency factory for a per-endpoint limit.

        @router.post("/login", dependencies=[Depends(rate_limiter(limit=5))])
    """

    async def limiter(request: Request, redis: Redis = Depends(get_redis)) -> bool:
        if not settings.RATE_LIMIT_ENABLED:
            return True

        name = scope or request.url.path
        allowed, reset_in = await _hit(redis, f"{name}:{client_key(request)}", limit, window)
        if not allowed:
            raise RateLimitExceeded(reset_in)
        return True

    return limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """A blanket per-IP limit so no single client can saturate the API."""

    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED or request.url.path.endswith(("/health", "/ready")):
            return await call_next(request)

        redis = get_redis()
        allowed, reset_in = await _hit(
            redis, f"global:{client_key(request)}", settings.RATE_LIMIT_PER_MINUTE, 60
        )

        if not allowed:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(reset_in)},
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": f"Too many requests. Please try again in {reset_in} seconds.",
                        "details": [],
                    }
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_PER_MINUTE)
        return response
