from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from backend.models.document import SourceType

RetrievalTaskType = Literal["profile_generation", "question_generation"]


class RetrievalScope(BaseModel):
    document_ids: list[UUID] = Field(default_factory=list)
    source_types: list[SourceType] = Field(default_factory=list)
    upload_labels: list[str] = Field(default_factory=list)
    chunk_type_labels: list[str] = Field(default_factory=list)
    topic_label: str | None = None

    @model_validator(mode="after")
    def normalize_values(self) -> RetrievalScope:
        self.upload_labels = [label.strip() for label in self.upload_labels if label.strip()]
        self.chunk_type_labels = [label.strip() for label in self.chunk_type_labels if label.strip()]
        self.topic_label = _normalize_optional_text(self.topic_label)
        return self


class ProfileGenerationRetrievalRequest(BaseModel):
    workspace_id: UUID
    query_text: str = Field(
        default="professor assessment style, exam structure, emphasized topics, representative course evidence",
        min_length=1,
    )
    max_chunks: int = Field(default=12, ge=1, le=50)
    scope: RetrievalScope = Field(default_factory=RetrievalScope)

    @model_validator(mode="after")
    def normalize_query(self) -> ProfileGenerationRetrievalRequest:
        self.query_text = self.query_text.strip()
        return self


class QuestionGenerationRetrievalRequest(BaseModel):
    workspace_id: UUID
    topic_label: str = Field(min_length=1)
    query_text: str | None = None
    max_chunks: int = Field(default=8, ge=1, le=50)
    scope: RetrievalScope = Field(default_factory=RetrievalScope)

    @model_validator(mode="after")
    def normalize_topic(self) -> QuestionGenerationRetrievalRequest:
        self.topic_label = self.topic_label.strip()
        self.query_text = _normalize_optional_text(self.query_text)
        return self

    @property
    def resolved_query_text(self) -> str:
        return self.query_text or self.topic_label


class AppliedRetrievalFilters(BaseModel):
    workspace_id: UUID
    document_ids: list[UUID] = Field(default_factory=list)
    source_types: list[SourceType] = Field(default_factory=list)
    upload_labels: list[str] = Field(default_factory=list)
    chunk_type_labels: list[str] = Field(default_factory=list)
    topic_label: str | None = None


class RetrievedChunk(BaseModel):
    chunk_id: UUID
    document_id: UUID
    workspace_id: UUID
    source_type: SourceType
    upload_label: str | None = None
    position: int = Field(ge=0)
    chunk_type_label: str
    topic_label: str | None = None
    content: str
    similarity_score: float = Field(ge=0.0)
    weighted_score: float = Field(ge=0.0)
    rank: int = Field(ge=1)


class RetrievalResponse(BaseModel):
    task_type: RetrievalTaskType
    query_text: str
    applied_filters: AppliedRetrievalFilters
    results: list[RetrievedChunk]


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None
