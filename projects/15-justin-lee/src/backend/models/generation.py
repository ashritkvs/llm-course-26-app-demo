from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

RequestType = Literal["practice_set", "simulated_exam", "targeted_regeneration"]
GenerationStatus = Literal["queued", "running", "completed", "failed"]
ExamMode = Literal["practice", "exam", "targeted_practice"]
FormatType = Literal["mcq", "frq", "mixed"]
QuestionType = Literal["mcq", "frq", "calculation", "proof"]
DifficultyLabel = Literal["easy", "moderate", "moderate-hard", "hard"]


class GenerationConfig(BaseModel):
    question_count: int = Field(ge=3, le=30)
    format_type: FormatType
    difficulty: DifficultyLabel | None = None
    question_types: list[QuestionType] = Field(default_factory=list, max_length=4)


class ScopeConstraints(BaseModel):
    topics: list[str] = Field(default_factory=list, max_length=15)
    document_ids: list[UUID] = Field(default_factory=list)
    custom_prompt: str | None = Field(default=None, max_length=500)


class GenerationRequestCreate(BaseModel):
    request_type: RequestType
    scope_constraints: ScopeConstraints = Field(default_factory=ScopeConstraints)
    generation_config: GenerationConfig


class GenerationRequestRead(BaseModel):
    id: UUID
    workspace_id: UUID
    request_type: RequestType
    scope_constraints: ScopeConstraints
    generation_config: GenerationConfig
    status: GenerationStatus
    created_at: dt.datetime


class GeneratedExamSummary(BaseModel):
    id: UUID
    generation_request_id: UUID
    workspace_id: UUID
    title: str
    exam_mode: ExamMode
    format_type: FormatType
    rendered_artifact_path: str | None = None
    created_at: dt.datetime


class GeneratedQuestionRead(BaseModel):
    id: UUID
    generated_exam_id: UUID
    question_order: int
    question_text: str
    question_type: QuestionType
    difficulty_label: str | None = None
    topic_label: str | None = None
    answer_key: str | None = None
    explanation: str | None = None
    options: list[str] = Field(default_factory=list)
    created_at: dt.datetime


class GeneratedExamDetail(GeneratedExamSummary):
    questions: list[GeneratedQuestionRead] = Field(default_factory=list)
