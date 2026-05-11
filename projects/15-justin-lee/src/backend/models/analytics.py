from __future__ import annotations

from pydantic import BaseModel, Field


class ConceptMasteryRead(BaseModel):
    score: float
    level: str


class PerformanceTrendRead(BaseModel):
    session: int
    score: float


class RecommendationRead(BaseModel):
    concept: str
    reason: str


class AnalyticsResponse(BaseModel):
    concept_mastery: dict[str, ConceptMasteryRead] = Field(default_factory=dict)
    error_distribution: dict[str, int] = Field(default_factory=dict)
    performance_trend: list[PerformanceTrendRead] = Field(default_factory=list)
    recommendations: list[RecommendationRead] = Field(default_factory=list)
