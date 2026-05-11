from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

SubmissionStatus = Literal["submitted", "grading", "graded", "failed"]
CorrectnessLabel = Literal["correct", "partial", "incorrect"]
ErrorType = Literal[
    "wrong_method",
    "formula_misuse",
    "computation_error",
    "interpretation_error",
    "incomplete_reasoning",
]
ErrorSeverity = Literal["minor", "moderate", "major"]


# --- Request models ---


class AnswerItem(BaseModel):
    question_id: UUID
    answer_content: str = Field(min_length=1)


class SubmissionCreate(BaseModel):
    answers: list[AnswerItem] = Field(min_length=1)


# --- Response models ---


class SubmissionCreatedResponse(BaseModel):
    id: UUID
    status: SubmissionStatus
    created_at: dt.datetime


class ErrorClassificationRead(BaseModel):
    id: UUID
    error_type: ErrorType
    description: str | None = None
    severity: ErrorSeverity | None = None


class GradingResultRead(BaseModel):
    id: UUID
    question_id: UUID
    correctness_label: CorrectnessLabel
    score_value: float
    points_possible: float
    diagnostic_explanation: str | None = None
    concept_label: str | None = None
    error_classifications: list[ErrorClassificationRead] = Field(default_factory=list)


class SubmissionAnswerRead(BaseModel):
    id: UUID
    question_id: UUID
    answer_content: str
    grading_result: GradingResultRead | None = None


class SubmissionRead(BaseModel):
    id: UUID
    workspace_id: UUID
    generated_exam_id: UUID
    status: SubmissionStatus
    overall_score: float | None = None
    total_possible: float | None = None
    submitted_at: dt.datetime | None = None
    created_at: dt.datetime
    answers: list[SubmissionAnswerRead] = Field(default_factory=list)
