from __future__ import annotations

import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from backend.models.document import SourceType

EvidenceStrength = Literal["low", "medium", "high"]
DifficultyLabel = Literal["easy", "moderate", "moderate-hard", "hard"]
DifficultyAxisLevel = Literal["low", "moderate", "high"]
ProfileQuestionType = Literal["mcq", "frq", "calculation", "proof", "mixed"]


class TopicWeight(BaseModel):
    topic_label: str = Field(min_length=1, max_length=120)
    weight: float = Field(ge=0.0, le=1.0)
    evidence_strength: EvidenceStrength
    rationale: str = Field(min_length=1, max_length=600)


class TopicDistribution(BaseModel):
    summary: str = Field(min_length=1, max_length=1200)
    topics: list[TopicWeight] = Field(min_length=1, max_length=15)

    @model_validator(mode="after")
    def validate_topics(self) -> TopicDistribution:
        _ensure_unique_strings(
            values=[entry.topic_label for entry in self.topics],
            field_name="topic_distribution.topics.topic_label",
        )
        _ensure_distribution_total(
            values=[entry.weight for entry in self.topics],
            field_name="topic_distribution.topics.weight",
        )
        return self


class QuestionTypeWeight(BaseModel):
    question_type: ProfileQuestionType
    weight: float = Field(ge=0.0, le=1.0)
    evidence_strength: EvidenceStrength
    rationale: str = Field(min_length=1, max_length=600)


class QuestionTypeDistribution(BaseModel):
    summary: str = Field(min_length=1, max_length=1200)
    question_types: list[QuestionTypeWeight] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def validate_question_types(self) -> QuestionTypeDistribution:
        _ensure_unique_strings(
            values=[entry.question_type for entry in self.question_types],
            field_name="question_type_distribution.question_types.question_type",
        )
        _ensure_distribution_total(
            values=[entry.weight for entry in self.question_types],
            field_name="question_type_distribution.question_types.weight",
        )
        return self


class DifficultyAxis(BaseModel):
    level: DifficultyAxisLevel
    rationale: str = Field(min_length=1, max_length=600)


class DifficultyProfile(BaseModel):
    estimated_level: DifficultyLabel
    confidence: EvidenceStrength
    calculation_intensity: DifficultyAxis
    conceptual_intensity: DifficultyAxis
    multi_step_reasoning: DifficultyAxis
    time_pressure: DifficultyAxis
    summary: str = Field(min_length=1, max_length=1200)


class ExamStructureProfile(BaseModel):
    minimum_question_count: int = Field(ge=1, le=100)
    typical_question_count: int = Field(ge=1, le=100)
    maximum_question_count: int = Field(ge=1, le=100)
    section_patterns: list[str] = Field(default_factory=list, max_length=8)
    tendency_notes: list[str] = Field(default_factory=list, min_length=1, max_length=10)
    answer_format_expectations: list[str] = Field(default_factory=list, max_length=10)
    summary: str = Field(min_length=1, max_length=1200)

    @model_validator(mode="after")
    def validate_counts(self) -> ExamStructureProfile:
        if self.minimum_question_count > self.typical_question_count:
            raise ValueError("minimum_question_count cannot exceed typical_question_count")
        if self.typical_question_count > self.maximum_question_count:
            raise ValueError("typical_question_count cannot exceed maximum_question_count")
        return self


class SourceEvidenceCount(BaseModel):
    source_type: SourceType
    document_count: int = Field(ge=0)
    chunk_count: int = Field(ge=0)


class EvidenceSummary(BaseModel):
    total_documents: int = Field(ge=1)
    total_chunks: int = Field(ge=1)
    source_counts: list[SourceEvidenceCount] = Field(min_length=1)
    retrieved_document_ids: list[UUID | str] = Field(default_factory=list)
    retrieved_chunk_ids: list[UUID | str] = Field(default_factory=list)
    retrieval_query: str = Field(min_length=1, max_length=500)
    evidence_characterization: str = Field(min_length=1, max_length=1200)

    @model_validator(mode="after")
    def validate_references(self) -> EvidenceSummary:
        _ensure_unique_strings(
            values=[str(document_id) for document_id in self.retrieved_document_ids],
            field_name="evidence_summary.retrieved_document_ids",
        )
        _ensure_unique_strings(
            values=[str(chunk_id) for chunk_id in self.retrieved_chunk_ids],
            field_name="evidence_summary.retrieved_chunk_ids",
        )
        return self


class ProfessorProfileBase(BaseModel):
    topic_distribution: TopicDistribution
    question_type_distribution: QuestionTypeDistribution
    difficulty_profile: DifficultyProfile
    exam_structure_profile: ExamStructureProfile
    evidence_summary: EvidenceSummary


class ProfessorProfileResponse(ProfessorProfileBase):
    id: UUID
    workspace_id: UUID
    version: int = Field(ge=1)
    created_at: dt.datetime
    updated_at: dt.datetime


class ProfessorProfileVersionResponse(ProfessorProfileBase):
    id: UUID
    professor_profile_id: UUID
    version: int = Field(ge=1)
    created_at: dt.datetime


def _ensure_distribution_total(*, values: list[float], field_name: str) -> None:
    total = round(sum(values), 6)
    if abs(total - 1.0) > 0.02:
        raise ValueError(f"{field_name} must sum to 1.0")


def _ensure_unique_strings(*, values: list[str], field_name: str) -> None:
    if len(set(values)) != len(values):
        raise ValueError(f"{field_name} must be unique")
