from __future__ import annotations

from typing import Any
from uuid import uuid4

from backend.services.analytics.models import AnalyticsResult
from backend.services.analytics.service import AnalyticsService


# ---------------------------------------------------------------------------
# Fake store
# ---------------------------------------------------------------------------


class FakeAnalyticsStore:
    def __init__(
        self,
        submissions: list[dict[str, Any]] | None = None,
        answers: list[dict[str, Any]] | None = None,
        grading_results: list[dict[str, Any]] | None = None,
        error_classifications: list[dict[str, Any]] | None = None,
    ) -> None:
        self._submissions = submissions or []
        self._answers = answers or []
        self._grading_results = grading_results or []
        self._error_classifications = error_classifications or []

    def get_submissions(self, workspace_id: str, user_id: str) -> list[dict[str, Any]]:
        return self._submissions

    def get_submission_answers(self, submission_ids: list[str]) -> list[dict[str, Any]]:
        return self._answers

    def get_grading_results(self, answer_ids: list[str]) -> list[dict[str, Any]]:
        return self._grading_results

    def get_error_classifications(self, grading_result_ids: list[str]) -> list[dict[str, Any]]:
        return self._error_classifications


# ---------------------------------------------------------------------------
# ID fixtures
# ---------------------------------------------------------------------------

_WS_ID = str(uuid4())
_USER_ID = str(uuid4())
_SUB1_ID = str(uuid4())
_SUB2_ID = str(uuid4())
_ANS1_ID = str(uuid4())
_ANS2_ID = str(uuid4())
_GR1_ID = str(uuid4())
_GR2_ID = str(uuid4())


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestEmptyWorkspace:
    def test_no_submissions_returns_empty_result(self) -> None:
        store = FakeAnalyticsStore()
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        assert isinstance(result, AnalyticsResult)
        assert result.concept_mastery == {}
        assert result.error_distribution == {}
        assert result.performance_trend == []
        assert result.recommendations == []

    def test_submissions_but_no_grading_results_returns_empty(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=[],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        assert result.concept_mastery == {}
        assert result.performance_trend == []


class TestConceptMastery:
    def test_two_submissions_correct_mastery_average(self) -> None:
        """Two graded answers for the same concept → weighted average score."""
        store = FakeAnalyticsStore(
            submissions=[
                {"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"},
                {"id": _SUB2_ID, "created_at": "2025-01-02T00:00:00"},
            ],
            answers=[
                {"id": _ANS1_ID, "submission_id": _SUB1_ID},
                {"id": _ANS2_ID, "submission_id": _SUB2_ID},
            ],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.5,
                    "points_possible": 1.0,
                    "concept_label": "hypothesis_testing",
                },
                {
                    "id": _GR2_ID,
                    "submission_answer_id": _ANS2_ID,
                    "score_value": 1.0,
                    "points_possible": 1.0,
                    "concept_label": "hypothesis_testing",
                },
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        assert "hypothesis_testing" in result.concept_mastery
        entry = result.concept_mastery["hypothesis_testing"]
        # (0.5 + 1.0) / (1.0 + 1.0) = 0.75 → strong
        assert abs(entry.score - 0.75) < 0.001
        assert entry.level == "strong"

    def test_low_mastery_score_produces_developing_level(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.2,
                    "points_possible": 1.0,
                    "concept_label": "bayesian_inference",
                },
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        entry = result.concept_mastery["bayesian_inference"]
        assert entry.level == "developing"

    def test_mid_range_score_produces_proficient_level(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.6,
                    "points_possible": 1.0,
                    "concept_label": "confidence_intervals",
                },
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        entry = result.concept_mastery["confidence_intervals"]
        assert entry.level == "proficient"


class TestErrorDistribution:
    def test_error_counts_aggregated_by_type(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.0,
                    "points_possible": 1.0,
                    "concept_label": "hypothesis_testing",
                },
            ],
            error_classifications=[
                {"grading_result_id": _GR1_ID, "error_type": "interpretation_error"},
                {"grading_result_id": _GR1_ID, "error_type": "interpretation_error"},
                {"grading_result_id": _GR1_ID, "error_type": "formula_misuse"},
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        assert result.error_distribution["interpretation_error"] == 2
        assert result.error_distribution["formula_misuse"] == 1


class TestRecommendations:
    def test_three_or_more_same_error_type_generates_recommendation(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.0,
                    "points_possible": 1.0,
                    "concept_label": "hypothesis_testing",
                },
            ],
            error_classifications=[
                {"grading_result_id": _GR1_ID, "error_type": "interpretation_error"},
                {"grading_result_id": _GR1_ID, "error_type": "interpretation_error"},
                {"grading_result_id": _GR1_ID, "error_type": "interpretation_error"},
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        rec_concepts = [r.concept for r in result.recommendations]
        assert "interpretation_error" in rec_concepts

    def test_low_mastery_concept_generates_recommendation(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.1,
                    "points_possible": 1.0,
                    "concept_label": "p_value_interpretation",
                },
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        rec_concepts = [r.concept for r in result.recommendations]
        assert "p_value_interpretation" in rec_concepts

    def test_max_five_recommendations_returned(self) -> None:
        """More than 5 weak concepts yields at most 5 recommendations."""
        concepts = [f"concept_{i}" for i in range(8)]
        grading_results = [
            {
                "id": str(uuid4()),
                "submission_answer_id": _ANS1_ID,
                "score_value": 0.1,
                "points_possible": 1.0,
                "concept_label": c,
            }
            for c in concepts
        ]
        store = FakeAnalyticsStore(
            submissions=[{"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"}],
            answers=[{"id": _ANS1_ID, "submission_id": _SUB1_ID}],
            grading_results=grading_results,
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        assert len(result.recommendations) <= 5


class TestPerformanceTrend:
    def test_two_submissions_ordered_by_session_index(self) -> None:
        store = FakeAnalyticsStore(
            submissions=[
                {"id": _SUB1_ID, "created_at": "2025-01-01T00:00:00"},
                {"id": _SUB2_ID, "created_at": "2025-01-02T00:00:00"},
            ],
            answers=[
                {"id": _ANS1_ID, "submission_id": _SUB1_ID},
                {"id": _ANS2_ID, "submission_id": _SUB2_ID},
            ],
            grading_results=[
                {
                    "id": _GR1_ID,
                    "submission_answer_id": _ANS1_ID,
                    "score_value": 0.5,
                    "points_possible": 1.0,
                    "concept_label": "test_concept",
                },
                {
                    "id": _GR2_ID,
                    "submission_answer_id": _ANS2_ID,
                    "score_value": 1.0,
                    "points_possible": 1.0,
                    "concept_label": "test_concept",
                },
            ],
        )
        service = AnalyticsService(store=store)

        result = service.compute_analytics(_WS_ID, _USER_ID)

        assert len(result.performance_trend) == 2
        assert result.performance_trend[0].session_index == 1
        assert abs(result.performance_trend[0].score - 0.5) < 0.001
        assert result.performance_trend[1].session_index == 2
        assert abs(result.performance_trend[1].score - 1.0) < 0.001
