from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FileMetadata(BaseModel):
    name: str
    path: str
    extension: str
    size_bytes: int
    last_accessed: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    created: Optional[datetime] = None
    is_shortcut: bool
    shortcut_target: Optional[str] = None


class ClassifiedFile(BaseModel):
    file: FileMetadata
    category: str
    pass_number: int  # 1 = user category match, 2 = auto-generated
