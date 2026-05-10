"""
GET  /deletion          — returns files flagged for deletion review.
POST /deletion/delete   — moves selected files to "Review for Deletion" folder.
"""
import json
import os
import shutil
import logging
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.models.result_model import DeletionResult

router = APIRouter()
logger = logging.getLogger(__name__)


class DeletionDeleteRequest(BaseModel):
    """List of file paths to move to the review folder."""
    file_paths: List[str]


def _load_settings() -> dict:
    from src.utils import get_project_root
    cfg_path = os.path.join(get_project_root(), "config", "settings.json")
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"age_threshold_days": 90, "deletion_review_folder": "Review for Deletion"}


@router.get("/deletion", response_model=DeletionResult)
async def get_flagged_files():
    """
    Scans the desktop and returns all files flagged as deletion candidates
    based on the configured age threshold.
    """
    try:
        from src.scanner import DesktopScanner
        from src.deletion_checker import DeletionChecker

        settings = _load_settings()
        age_threshold = int(settings.get("age_threshold_days", 90))

        scanner = DesktopScanner()
        raw_files = scanner.scan()

        checker = DeletionChecker()
        results = checker.check_files(raw_files, age_threshold)

        flagged = [r for r in results if r["flagged_for_deletion"]]

        # Serialise datetime objects to ISO strings for JSON response
        serialisable_flagged = []
        for item in flagged:
            meta = dict(item["file_metadata"])
            for key in ("last_accessed", "last_modified", "created"):
                if meta.get(key) is not None:
                    meta[key] = meta[key].isoformat()
            serialisable_flagged.append(
                {
                    "file_metadata": meta,
                    "days_since_access": item["days_since_access"],
                    "flagged_for_deletion": item["flagged_for_deletion"],
                }
            )

        return DeletionResult(
            flagged_files=serialisable_flagged,
            total_flagged=len(serialisable_flagged),
        )

    except Exception as exc:
        logger.error("Deletion check failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/deletion/delete")
async def move_to_review(payload: DeletionDeleteRequest):
    """
    Moves selected files to the "Review for Deletion" folder on the desktop.
    Files are NEVER permanently deleted.
    """
    try:
        from src.utils import get_desktop_path, ensure_dir, log_action

        settings = _load_settings()
        review_folder_name = settings.get("deletion_review_folder", "Review for Deletion")
        desktop_path = get_desktop_path()
        review_dir = os.path.join(desktop_path, review_folder_name)
        ensure_dir(review_dir)

        moved = []
        errors = []

        for file_path in payload.file_paths:
            if not os.path.exists(file_path):
                errors.append({"path": file_path, "error": "File not found"})
                continue

            file_name = os.path.basename(file_path)
            dest = os.path.join(review_dir, file_name)

            # Avoid collision
            if os.path.exists(dest):
                base, ext = os.path.splitext(file_name)
                counter = 1
                while os.path.exists(dest):
                    dest = os.path.join(review_dir, f"{base} ({counter}){ext}")
                    counter += 1

            try:
                shutil.move(file_path, dest)
                log_action("MOVE_TO_REVIEW", file_path, review_folder_name)
                moved.append({"src": file_path, "dest": dest})
                logger.info("Moved to review: %s → %s", file_path, dest)
            except Exception as exc:
                logger.error("Could not move %s: %s", file_path, exc)
                errors.append({"path": file_path, "error": str(exc)})

        return {"moved": moved, "errors": errors}

    except Exception as exc:
        logger.error("Deletion move failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
