"""
GET /settings  — returns current application settings.
PUT /settings  — updates settings.
"""
import json
import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)


class Settings(BaseModel):
    age_threshold_days: int = 90
    dry_run: bool = False
    log_level: str = "INFO"
    output_dir: str = "desktop"
    deletion_review_folder: str = "Review for Deletion"
    miscellaneous_folder: str = "Miscellaneous"


def _settings_path() -> str:
    from src.utils import get_project_root
    return os.path.join(get_project_root(), "config", "settings.json")


@router.get("/settings", response_model=Settings)
async def get_settings():
    """Returns the current application settings."""
    try:
        path = _settings_path()
        if not os.path.exists(path):
            return Settings()
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Settings(**data)
    except Exception as exc:
        logger.error("Failed to read settings: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/settings", response_model=Settings)
async def update_settings(payload: Settings):
    """Saves updated application settings."""
    try:
        path = _settings_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload.model_dump(), f, indent=2)
        logger.info("Settings updated: %s", payload.model_dump())
        return payload
    except Exception as exc:
        logger.error("Failed to save settings: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
