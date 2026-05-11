from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

SourceType = Literal["prior_exam", "homework", "lecture_slides", "practice_test", "notes"]
ProcessingStatus = Literal["uploaded", "parsing", "parsed", "indexed", "ready", "failed"]


class DocumentResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    source_type: SourceType
    file_name: str
    upload_label: str | None
    file_path: str
    processing_status: ProcessingStatus
    created_at: dt.datetime
    updated_at: dt.datetime


class DocumentCreateResponse(BaseModel):
    document: DocumentResponse
