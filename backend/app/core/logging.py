"""Structured JSON logging.

Every log line is one JSON object, which is what log aggregators (CloudWatch,
Loki, Datadog) expect. Each line carries the request id, so all the work done
for one API call can be pulled up together when something goes wrong.
"""

import json
import logging
import sys
from contextvars import ContextVar
from typing import Any, Dict

from app.core.config import settings

# Set by the request-context middleware for the lifetime of one request.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")

# Attributes the stdlib puts on every record; anything else was added by us.
_STANDARD_ATTRS = set(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
) | {"asctime", "message", "taskName"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }

        user_id = user_id_var.get()
        if user_id != "-":
            payload["user_id"] = user_id

        # Anything passed via `logger.info("...", extra={...})`.
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS:
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging() -> None:
    """Install the JSON formatter on the root logger.

    In development, plain readable lines are easier to scan, so JSON is only
    used outside development.
    """
    handler = logging.StreamHandler(sys.stdout)

    if settings.is_production or settings.ENVIRONMENT == "staging":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(levelname)-8s %(name)s: %(message)s")
        )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # These two are far too chatty at INFO in normal operation.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DEBUG else logging.WARNING
    )
