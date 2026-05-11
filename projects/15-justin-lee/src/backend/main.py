from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config.settings import Settings, get_settings
from backend.models.errors import AppError
from backend.routes.analytics import router as analytics_router
from backend.routes.documents import router as documents_router
from backend.routes.regeneration import router as regeneration_router
from backend.routes.generation import router as generation_router
from backend.routes.health import router as health_router
from backend.routes.profiles import router as profiles_router
from backend.routes.submissions import router as submissions_router
from backend.routes.workspaces import router as workspaces_router


def create_app(settings: Settings) -> FastAPI:
    settings.validate_required_secrets()
    app = FastAPI(title="ExamProfile AI API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def handle_app_error(_: Any, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Any, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal Server Error",
                "timestamp": dt.datetime.now(dt.UTC).isoformat(),
            },
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(workspaces_router, prefix="/api")
    app.include_router(documents_router, prefix="/api")
    app.include_router(profiles_router, prefix="/api")
    app.include_router(generation_router, prefix="/api")
    app.include_router(submissions_router, prefix="/api")
    app.include_router(analytics_router, prefix="/api")
    app.include_router(regeneration_router, prefix="/api")
    return app


app = create_app(get_settings())
