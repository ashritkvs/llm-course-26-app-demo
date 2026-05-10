"""
POST /scan — triggers desktop scan + LLM classification, returns ScanResult.
"""
import json
import os
import logging
from fastapi import APIRouter, HTTPException
from datetime import datetime

from api.models.file_model import FileMetadata, ClassifiedFile
from api.models.result_model import ScanResult

router = APIRouter()
logger = logging.getLogger(__name__)


def _load_user_categories() -> list:
    """Loads categories from config/user_categories.json."""
    from src.utils import get_project_root
    cfg_path = os.path.join(get_project_root(), "config", "user_categories.json")
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("categories", [])
    except Exception as exc:
        logger.warning("Could not load user_categories.json: %s", exc)
        return []


def _meta_dict_to_model(meta: dict) -> FileMetadata:
    """Converts a raw scanner metadata dict to a FileMetadata Pydantic model."""
    def _coerce_dt(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(str(val))
        except Exception:
            return None

    return FileMetadata(
        name=meta.get("name", ""),
        path=meta.get("path", ""),
        extension=meta.get("extension", ""),
        size_bytes=int(meta.get("size_bytes", 0)),
        last_accessed=_coerce_dt(meta.get("last_accessed")),
        last_modified=_coerce_dt(meta.get("last_modified")),
        created=_coerce_dt(meta.get("created")),
        is_shortcut=bool(meta.get("is_shortcut", False)),
        shortcut_target=meta.get("shortcut_target"),
    )


@router.post("/scan", response_model=ScanResult)
async def run_scan():
    """
    Scans the desktop and classifies every file using Claude.
    Returns the full ScanResult including per-file category assignments.
    """
    try:
        from src.scanner import DesktopScanner
        from src.classifier import LLMClassifier

        scanner = DesktopScanner()
        raw_files = scanner.scan()

        user_categories = _load_user_categories()

        classifier = LLMClassifier()
        classified = classifier.classify_files(raw_files, user_categories)

        classified_file_models: list[ClassifiedFile] = []
        user_category_count = 0
        auto_category_count = 0
        categories_found: set[str] = set()

        for item in classified:
            file_model = _meta_dict_to_model(item["file_metadata"])
            category = item.get("category", "Miscellaneous")
            pass_number = item.get("pass_number", 2)

            classified_file_models.append(
                ClassifiedFile(file=file_model, category=category, pass_number=pass_number)
            )
            categories_found.add(category)

            if pass_number == 1:
                user_category_count += 1
            else:
                auto_category_count += 1

        return ScanResult(
            files=classified_file_models,
            total_files=len(classified_file_models),
            user_category_count=user_category_count,
            auto_category_count=auto_category_count,
            categories_found=sorted(categories_found),
        )

    except Exception as exc:
        logger.error("Scan failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
