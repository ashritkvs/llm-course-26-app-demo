from pydantic import BaseModel
from typing import List, Dict
from api.models.file_model import ClassifiedFile


class ScanResult(BaseModel):
    files: List[ClassifiedFile]
    total_files: int
    user_category_count: int
    auto_category_count: int
    categories_found: List[str]


class OrganizeResult(BaseModel):
    moved: int
    skipped: int
    errors: int
    dry_run: bool


class DeletionResult(BaseModel):
    flagged_files: List[dict]
    total_flagged: int
