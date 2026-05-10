"""
GET  /categories  — returns current user category list.
POST /categories  — saves a new category list.
"""
import json
import os
import logging
from fastapi import APIRouter, HTTPException

from api.models.category_model import CategoryList, CategoryUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


def _categories_path() -> str:
    from src.utils import get_project_root
    return os.path.join(get_project_root(), "config", "user_categories.json")


@router.get("/categories", response_model=CategoryList)
async def get_categories():
    """Returns the current list of user-defined categories."""
    try:
        path = _categories_path()
        if not os.path.exists(path):
            return CategoryList(categories=[])
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return CategoryList(categories=data.get("categories", []))
    except Exception as exc:
        logger.error("Failed to load categories: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/categories", response_model=CategoryList)
async def save_categories(payload: CategoryUpdate):
    """Saves a new list of user-defined categories."""
    try:
        path = _categories_path()
        data = {"categories": payload.categories}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info("Saved %d categories.", len(payload.categories))
        return CategoryList(categories=payload.categories)
    except Exception as exc:
        logger.error("Failed to save categories: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
