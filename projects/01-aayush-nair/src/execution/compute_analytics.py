"""
compute_analytics.py — Performance analytics computation

Queries Supabase for a user's quiz history, computes per-concept mastery,
identifies strong/weak concepts, and session trends.

Usage:
    python compute_analytics.py --user-id <uuid>

Returns JSON to stdout.
"""

import sys
import os
import json
import argparse

# Add parent dir to path so we can import supabase_client
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase


def compute_analytics(user_id: str) -> dict:
    """
    Compute performance analytics for a given user.

    Pulls from concept_mastery for per-concept data and
    session_analytics for session-over-session trends.

    Args:
        user_id: UUID of the user.

    Returns:
        Analytics dict with overall accuracy, strong/weak concepts,
        concept breakdown, and session trend.
    """
    # ---- Concept mastery data ----
    mastery_resp = (
        supabase.table("concept_mastery")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    mastery = mastery_resp.data

    if not mastery:
        return {
            "user_id": user_id,
            "overall_accuracy": 0,
            "total_questions_attempted": 0,
            "strong_concepts": [],
            "weak_concepts": [],
            "concept_breakdown": [],
            "session_trend": [],
            "message": "Take your first quiz to see analytics.",
        }

    # ---- Aggregate totals ----
    total_attempts = sum(m["attempts"] for m in mastery)
    total_correct = sum(m["correct_answers"] for m in mastery)
    overall_accuracy = round(total_correct / total_attempts, 4) if total_attempts > 0 else 0

    # ---- Concept breakdown ----
    concept_breakdown = []
    for m in mastery:
        concept_breakdown.append({
            "concept_tag": m["concept_tag"],
            "mastery_score": m["mastery_score"],
            "attempts": m["attempts"],
            "correct_answers": m["correct_answers"],
            # Only report trend if enough data
            "status": "insufficient_data" if m["attempts"] < 3 else (
                "strong" if m["mastery_score"] > 0.8 else
                "weak" if m["mastery_score"] < 0.6 else
                "developing"
            ),
        })

    concept_breakdown.sort(key=lambda x: x["mastery_score"], reverse=True)

    # Strong: mastery > 80% and ≥ 3 attempts
    strong = [
        c for c in concept_breakdown
        if c["mastery_score"] > 0.8 and c["attempts"] >= 3
    ][:5]

    # Weak: mastery < 60% and ≥ 3 attempts
    weak = [
        c for c in concept_breakdown
        if c["mastery_score"] < 0.6 and c["attempts"] >= 3
    ][:5]

    # ---- Session trend (from session_analytics) ----
    sessions_resp = (
        supabase.table("sessions")
        .select("session_id, start_time")
        .eq("user_id", user_id)
        .order("start_time")
        .execute()
    )

    session_trend = []
    if sessions_resp.data:
        session_ids = [s["session_id"] for s in sessions_resp.data]
        analytics_resp = (
            supabase.table("session_analytics")
            .select("session_id, accuracy, avg_reasoning_score, hint_usage_rate")
            .in_("session_id", session_ids)
            .execute()
        )
        # Build a lookup and preserve chronological order
        analytics_map = {a["session_id"]: a for a in analytics_resp.data}
        for s in sessions_resp.data:
            analytics = analytics_map.get(s["session_id"])
            if analytics:
                session_trend.append({
                    "session_id": s["session_id"],
                    "accuracy": analytics["accuracy"],
                    "avg_reasoning_score": analytics["avg_reasoning_score"],
                    "hint_usage_rate": analytics["hint_usage_rate"],
                })

    return {
        "user_id": user_id,
        "overall_accuracy": overall_accuracy,
        "total_questions_attempted": total_attempts,
        "strong_concepts": strong,
        "weak_concepts": weak,
        "concept_breakdown": concept_breakdown,
        "session_trend": session_trend,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute user analytics")
    parser.add_argument("--user-id", required=True, help="User UUID")
    args = parser.parse_args()

    analytics = compute_analytics(args.user_id)
    print(json.dumps(analytics, indent=2))
