from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RegenerationRequestCreate(BaseModel):
    target_concepts: list[str] = Field(min_length=1, max_length=10)
    question_count: int = Field(ge=3, le=20, default=5)
    format_type: Literal["mcq", "frq", "mixed"] = "mixed"

    @field_validator("target_concepts")
    @classmethod
    def validate_concept_lengths(cls, v: list[str]) -> list[str]:
        for concept in v:
            if len(concept) > 60:
                raise ValueError("Each concept string must be at most 60 characters")
        return v


class RegenerationRequestResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    status: str
    target_concepts: list[str]
    generated_exam_id: UUID | None = None
    created_at: dt.datetime
