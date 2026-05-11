from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from backend.models.grading import CorrectnessLabel, ErrorType


class LLMErrorClassification(BaseModel):
    error_type: ErrorType
    description: str


class LLMGradingResult(BaseModel):
    correctness_label: CorrectnessLabel
    score_value: float = Field(ge=0)
    diagnostic_explanation: str
    concept_label: str
    error_classifications: list[LLMErrorClassification] = Field(default_factory=list)


class GradedAnswer(BaseModel):
    submission_answer_id: UUID
    question_id: UUID
    correctness_label: CorrectnessLabel
    points_awarded: float = Field(ge=0)
    points_possible: float = Field(gt=0)
    feedback: str
    concept_label: str
    error_classifications: list[LLMErrorClassification] = Field(default_factory=list)


class GradingPipelineResult(BaseModel):
    submission_id: UUID
    graded_answers: list[GradedAnswer] = Field(default_factory=list)
    total_score: float = 0.0
    max_score: float = 0.0
