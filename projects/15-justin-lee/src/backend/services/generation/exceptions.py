from __future__ import annotations

from backend.models.errors import AppError


class GenerationError(AppError):
    status_code = 422
    detail = "Generation pipeline error"
