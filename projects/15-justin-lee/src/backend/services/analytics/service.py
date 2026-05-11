from __future__ import annotations

import logging
from typing import Any, Protocol

from supabase import Client

from backend.services.analytics.models import (
    AnalyticsResult,
    ConceptMasteryEntry,
    PerformanceTrendEntry,
    Recommendation,
    _mastery_level,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Protocol — keeps AnalyticsService testable without real Supabase
# ---------------------------------------------------------------------------


class AnalyticsStore(Protocol):
    def get_submissions(self, workspace_id: str, user_id: str) -> list[dict[str, Any]]: ...
    def get_submission_answers(self, submission_ids: list[str]) -> list[dict[str, Any]]: ...
    def get_grading_results(self, answer_ids: list[str]) -> list[dict[str, Any]]: ...
    def get_error_classifications(self, grading_result_ids: list[str]) -> list[dict[str, Any]]: ...


# ---------------------------------------------------------------------------
# Aggregation helpers — each stays under 50 lines
# ---------------------------------------------------------------------------


def _empty_result() -> AnalyticsResult:
    return AnalyticsResult()


def _compute_concept_mastery(
    grading_results: list[dict[str, Any]],
) -> dict[str, ConceptMasteryEntry]:
    """Weighted average of (score_value / points_possible) per concept."""
    sums: dict[str, list[float]] = {}  # concept -> [score_sum, points_sum, count]
    for gr in grading_results:
        concept = gr.get("concept_label") or "unknown"
        score = float(gr.get("score_value") or 0)
        points = float(gr.get("points_possible") or 1)
        if concept not in sums:
            sums[concept] = [0.0, 0.0, 0.0]
        sums[concept][0] += score
        sums[concept][1] += points
        sums[concept][2] += 1

    result: dict[str, ConceptMasteryEntry] = {}
    for concept, (score_sum, points_sum, count) in sums.items():
        ratio = score_sum / points_sum if points_sum > 0 else 0.0
        result[concept] = ConceptMasteryEntry(
            concept_label=concept,
            score=round(ratio, 4),
            level=_mastery_level(ratio, int(count)),
        )
    return result


def _compute_error_distribution(
    error_classifications: list[dict[str, Any]],
) -> dict[str, int]:
    """Count error_classifications by error_type."""
    counts: dict[str, int] = {}
    for ec in error_classifications:
        error_type = ec.get("error_type") or "unknown"
        counts[error_type] = counts.get(error_type, 0) + 1
    return counts


def _compute_performance_trend(
    grading_results: list[dict[str, Any]],
    answer_to_sub: dict[str, str],
    submission_index: dict[str, int],
) -> list[PerformanceTrendEntry]:
    """Score ratio per submission, ordered by session index."""
    sub_scores: dict[str, list[float]] = {}  # submission_id -> [score_sum, points_sum]
    for gr in grading_results:
        answer_id = gr.get("submission_answer_id") or ""
        sub_id = answer_to_sub.get(answer_id, "")
        if not sub_id:
            continue
        score = float(gr.get("score_value") or 0)
        points = float(gr.get("points_possible") or 1)
        if sub_id not in sub_scores:
            sub_scores[sub_id] = [0.0, 0.0]
        sub_scores[sub_id][0] += score
        sub_scores[sub_id][1] += points

    entries: list[PerformanceTrendEntry] = []
    for sub_id, (score_sum, points_sum) in sub_scores.items():
        ratio = score_sum / points_sum if points_sum > 0 else 0.0
        entries.append(PerformanceTrendEntry(
            session_index=submission_index.get(sub_id, 0),
            score=round(ratio, 4),
            submission_id=sub_id,
        ))
    return sorted(entries, key=lambda e: e.session_index)


def _compute_recommendations(
    concept_mastery: dict[str, ConceptMasteryEntry],
    error_distribution: dict[str, int],
) -> list[Recommendation]:
    """Up to 5 recommendations: weak concepts first, then frequent error types."""
    recs: list[Recommendation] = []

    # Concepts below 50% mastery, most urgent (lowest score) first
    weak = sorted(
        [(e.score, k) for k, e in concept_mastery.items()
         if e.score < 0.5 and e.level != "not_started"],
        key=lambda x: x[0],
    )
    for score, concept in weak:
        recs.append(Recommendation(
            concept=concept,
            reason=f"Mastery score is {score:.0%} — below proficiency threshold",
        ))

    # Error types with >= 3 occurrences, highest count first
    frequent = sorted(
        [(count, et) for et, count in error_distribution.items() if count >= 3],
        key=lambda x: -x[0],
    )
    for count, error_type in frequent:
        recs.append(Recommendation(
            concept=error_type,
            reason=f"Repeated {error_type.replace('_', ' ')} ({count} occurrences)",
        ))

    return recs[:5]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class AnalyticsService:
    def __init__(self, *, store: AnalyticsStore) -> None:
        self._store = store

    def compute_analytics(self, workspace_id: str, user_id: str) -> AnalyticsResult:
        """Aggregate grading signals for a workspace into an AnalyticsResult.

        Does NOT write to the database — call persist_analytics_snapshot separately.
        """
        submissions = self._store.get_submissions(workspace_id, user_id)
        if not submissions:
            return _empty_result()

        submission_ids = [s["id"] for s in submissions]
        # 1-based session index ordered by created_at (submissions already ordered)
        submission_index = {s["id"]: i + 1 for i, s in enumerate(submissions)}

        answers = self._store.get_submission_answers(submission_ids)
        if not answers:
            return _empty_result()

        answer_to_sub = {a["id"]: a["submission_id"] for a in answers}
        answer_ids = [a["id"] for a in answers]

        grading_results = self._store.get_grading_results(answer_ids)
        if not grading_results:
            return _empty_result()

        gr_ids = [gr["id"] for gr in grading_results]
        error_classifications = self._store.get_error_classifications(gr_ids)

        concept_mastery = _compute_concept_mastery(grading_results)
        error_distribution = _compute_error_distribution(error_classifications)
        performance_trend = _compute_performance_trend(
            grading_results, answer_to_sub, submission_index
        )
        recommendations = _compute_recommendations(concept_mastery, error_distribution)

        logger.info(
            "Analytics computed for workspace %s: %d concepts, %d error types",
            workspace_id,
            len(concept_mastery),
            len(error_distribution),
        )
        return AnalyticsResult(
            concept_mastery=concept_mastery,
            error_distribution=error_distribution,
            performance_trend=performance_trend,
            recommendations=recommendations,
        )


# ---------------------------------------------------------------------------
# Supabase-backed store
# ---------------------------------------------------------------------------


class SupabaseAnalyticsStore:
    """Implements AnalyticsStore using the Supabase admin client."""

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def get_submissions(self, workspace_id: str, user_id: str) -> list[dict[str, Any]]:
        resp = (
            self._supabase.table("submissions")
            .select("id, created_at")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user_id)
            .eq("status", "graded")
            .order("created_at")
            .execute()
        )
        return resp.data or []

    def get_submission_answers(self, submission_ids: list[str]) -> list[dict[str, Any]]:
        if not submission_ids:
            return []
        resp = (
            self._supabase.table("submission_answers")
            .select("id, submission_id")
            .in_("submission_id", submission_ids)
            .execute()
        )
        return resp.data or []

    def get_grading_results(self, answer_ids: list[str]) -> list[dict[str, Any]]:
        if not answer_ids:
            return []
        resp = (
            self._supabase.table("grading_results")
            .select("id, submission_answer_id, score_value, points_possible, concept_label")
            .in_("submission_answer_id", answer_ids)
            .execute()
        )
        return resp.data or []

    def get_error_classifications(self, grading_result_ids: list[str]) -> list[dict[str, Any]]:
        if not grading_result_ids:
            return []
        resp = (
            self._supabase.table("error_classifications")
            .select("grading_result_id, error_type")
            .in_("grading_result_id", grading_result_ids)
            .execute()
        )
        return resp.data or []


def build_analytics_service(supabase: Client) -> AnalyticsService:
    return AnalyticsService(store=SupabaseAnalyticsStore(supabase))
