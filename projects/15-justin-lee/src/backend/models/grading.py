from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

CorrectnessLabel = Literal["correct", "partial", "incorrect"]
ErrorType = Literal[
    "wrong_method",
    "formula_misuse",
    "computation_error",
    "interpretation_error",
    "incomplete_reasoning",
]


# ---------------------------------------------------------------------------
# Submission
# ---------------------------------------------------------------------------


class SubmissionCreate(BaseModel):
    generated_exam_id: UUID


class SubmissionRead(BaseModel):
    id: UUID
    user_id: UUID
    generated_exam_id: UUID
    started_at: dt.datetime
    submitted_at: dt.datetime | None = None
    score: float | None = None
    max_score: float | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


# ---------------------------------------------------------------------------
# Submission answers – API payload & DB read
# ---------------------------------------------------------------------------


class AnswerItem(BaseModel):
    question_id: UUID
    answer_content: str = Field(min_length=1)


class SubmissionAnswersPayload(BaseModel):
    answers: list[AnswerItem] = Field(min_length=1)


class SubmissionAnswerRead(BaseModel):
    id: UUID
    submission_id: UUID
    question_id: UUID
    answer_content: str
    created_at: dt.datetime
    updated_at: dt.datetime


# ---------------------------------------------------------------------------
# Grading results
# ---------------------------------------------------------------------------


class GradingResultCreate(BaseModel):
    submission_answer_id: UUID
    correctness_label: CorrectnessLabel
    score_value: float = Field(ge=0)
    points_possible: float = Field(gt=0)
    diagnostic_explanation: str | None = None
    concept_label: str | None = None


class GradingResultRead(BaseModel):
    id: UUID
    submission_answer_id: UUID
    correctness_label: CorrectnessLabel
    score_value: float
    points_possible: float
    diagnostic_explanation: str | None = None
    concept_label: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime


# ---------------------------------------------------------------------------
# Error classifications
# ---------------------------------------------------------------------------


class ErrorClassificationCreate(BaseModel):
    grading_result_id: UUID
    error_type: ErrorType
    description: str | None = None


class ErrorClassificationRead(BaseModel):
    id: UUID
    grading_result_id: UUID
    error_type: ErrorType
    description: str | None = None
    created_at: dt.datetime


# ---------------------------------------------------------------------------
# Composite / detail views
# ---------------------------------------------------------------------------


class GradingResultDetail(GradingResultRead):
    errors: list[ErrorClassificationRead] = Field(default_factory=list)


class SubmissionAnswerDetail(SubmissionAnswerRead):
    grading_result: GradingResultDetail | None = None


class SubmissionDetail(SubmissionRead):
    answers: list[SubmissionAnswerDetail] = Field(default_factory=list)
