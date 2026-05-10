"""
POST /organize — applies file sorting (moves files into category folders).
Accepts `dry_run` query parameter.
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from api.models.result_model import OrganizeResult

router = APIRouter()
logger = logging.getLogger(__name__)


class OrganizeRequest(BaseModel):
    """
    Body containing the classified file list as raw dicts
    (matching the output of the /scan endpoint).
    """
    classified_files: List[dict]


@router.post("/organize", response_model=OrganizeResult)
async def organize_files(
    payload: OrganizeRequest,
    dry_run: bool = Query(default=False, description="Preview moves without executing"),
):
    """
    Moves files into their assigned category folders on the desktop.
    Pass dry_run=true to preview without actually moving anything.
    """
    try:
        from src.organizer import FileOrganizer
        from src.utils import get_desktop_path

        desktop_path = get_desktop_path()
        organizer = FileOrganizer()

        # Convert API payload back to the format organizer expects
        # classified_files items: {file_metadata: {...}, category: str, pass_number: int}
        raw_classified = []
        for item in payload.classified_files:
            # Support both {"file": {...}, ...} (API model shape) and
            # {"file_metadata": {...}, ...} (internal shape)
            if "file" in item and "file_metadata" not in item:
                item = dict(item)
                item["file_metadata"] = item.pop("file")
            raw_classified.append(item)

        summary = organizer.organize(raw_classified, desktop_path, dry_run=dry_run)

        return OrganizeResult(
            moved=summary["moved"],
            skipped=summary["skipped"],
            errors=summary["errors"],
            dry_run=dry_run,
        )

    except Exception as exc:
        logger.error("Organize failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
