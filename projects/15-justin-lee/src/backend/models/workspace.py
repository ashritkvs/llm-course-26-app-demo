from __future__ import annotations

import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field


class WorkspaceCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    course_code: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=1000)


class WorkspaceUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    course_code: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=1000)


class WorkspaceResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    course_code: str | None
    description: str | None
    created_at: dt.datetime
    updated_at: dt.datetime


class WorkspaceDetailResponse(WorkspaceResponse):
    document_count: int
    profile_status: str
