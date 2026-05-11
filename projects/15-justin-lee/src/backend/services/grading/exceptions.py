from __future__ import annotations

from backend.models.errors import AppError


class GradingError(AppError):
    status_code = 422
    detail = "Grading pipeline error"
