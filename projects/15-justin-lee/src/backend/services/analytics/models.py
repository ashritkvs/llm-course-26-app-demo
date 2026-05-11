from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MasteryLevel = Literal["not_started", "developing", "proficient", "strong"]


def _mastery_level(score: float, count: int) -> MasteryLevel:
    """Derive a categorical mastery level from a weighted score ratio."""
    if count == 0:
        return "not_started"
    if score < 0.4:
        return "developing"
    if score < 0.7:
        return "proficient"
    return "strong"


class ConceptMasteryEntry(BaseModel):
    concept_label: str
    score: float = Field(ge=0.0, le=1.0)
    level: MasteryLevel


class PerformanceTrendEntry(BaseModel):
    session_index: int  # 1-based, ordered by submission created_at
    score: float = Field(ge=0.0, le=1.0)
    submission_id: str


class Recommendation(BaseModel):
    concept: str
    reason: str


class AnalyticsResult(BaseModel):
    concept_mastery: dict[str, ConceptMasteryEntry] = Field(default_factory=dict)
    error_distribution: dict[str, int] = Field(default_factory=dict)
    performance_trend: list[PerformanceTrendEntry] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
