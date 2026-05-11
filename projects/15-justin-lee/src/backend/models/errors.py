from __future__ import annotations


class AppError(Exception):
    status_code: int = 500
    detail: str = "Internal Server Error"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.detail)
        if detail:
            self.detail = detail


class BadRequestError(AppError):
    status_code = 400
    detail = "Bad Request"


class PayloadTooLargeError(AppError):
    status_code = 413
    detail = "Request Entity Too Large"


class UnauthorizedError(AppError):
    status_code = 401
    detail = "Unauthorized"


class NotFoundError(AppError):
    status_code = 404
    detail = "Not Found"


class ConfigError(AppError):
    status_code = 500
    detail = "Server configuration error"


class UpstreamServiceError(AppError):
    status_code = 502
    detail = "Upstream service error"


class ForbiddenError(AppError):
    status_code = 403
    detail = "Forbidden"


class ConflictError(AppError):
    status_code = 409
    detail = "Conflict"


class UnsupportedMediaTypeError(AppError):
    status_code = 415
    detail = "Unsupported Media Type"


class ServiceUnavailableError(AppError):
    status_code = 503
    detail = "Service unavailable"


class TooManyRequestsError(AppError):
    status_code = 429
    detail = "Too Many Requests"
