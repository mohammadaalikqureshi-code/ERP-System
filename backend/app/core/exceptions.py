from fastapi import Request
from fastapi.responses import JSONResponse
import logging

class BaseAPIException(Exception):
    def __init__(self, message: str, code: str = "internal_error", status_code: int = 500, details: list = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []

class NotFoundError(BaseAPIException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, code="not_found", status_code=404)

class ForbiddenError(BaseAPIException):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message, code="forbidden", status_code=403)

class ConflictError(BaseAPIException):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, code="conflict", status_code=409)

class ValidationError(BaseAPIException):
    def __init__(self, message: str = "Validation failed", details: list = None):
        super().__init__(message, code="validation_error", status_code=422, details=details)

class UnauthorizedError(BaseAPIException):
    def __init__(self, message: str = "Unauthorized", details: list = None):
        super().__init__(message, code="unauthorized", status_code=401, details=details)

async def api_exception_handler(request: Request, exc: BaseAPIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )
