"""
generate_analytics.py — User learning analytics generator

Computes structured analytics from Supabase data:
  accuracy, correct/wrong counts, weak/strong topics,
  avg reasoning score, hint usage rate, avg response time.

Usage:
    python generate_analytics.py --user-id <uuid>
    python generate_analytics.py --user-id <uuid> --session-id <uuid>

Returns JSON to stdout.
"""

import sys
import os
import json
import argparse

# Add parent dir for supabase imports
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase


# ---- Thresholds ----
WEAK_THRESHOLD = 0.50    # mastery_score < this → weak
STRONG_THRESHOLD = 0.75  # mastery_score > this → strong
MIN_ATTEMPTS = 3         # minimum attempts before classifying


# ---- Core Analytics ----

def generate_analytics(user_id: str, session_id: str = None) -> dict:
    """
    Compute learning analytics for a user or a specific session.

    Args:
        user_id: UUID of the user.
        session_id: Optional session UUID. If provided, only that session's
                    data is used; otherwise all-time data.

    Returns:
        Structured analytics dict for the frontend dashboard.
    """
    # ---- Fetch answers ----
    answers = _fetch_answers(user_id, session_id)

    if not answers:
        return _empty_analytics(user_id)

    # ---- Core metrics ----
    total = len(answers)
    correct_count = sum(1 for a in answers if a["correct"])
    wrong_count = total - correct_count
    accuracy = correct_count / total

    # Avg reasoning score (already 0–1 in the DB)
    reasoning_scores = [a.get("reasoning_score", 0) for a in answers]
    avg_reasoning = sum(reasoning_scores) / total if total > 0 else 0

    # Hint usage rate
    hint_users = sum(1 for a in answers if (a.get("hints_used") or 0) > 0)
    hint_usage_rate = hint_users / total if total > 0 else 0

    # Avg response time (exclude nulls)
    response_times = [a["response_time"] for a in answers if a.get("response_time") is not None]
    avg_response_time = sum(response_times) / len(response_times) if response_times else None

    # ---- Concept mastery ----
    mastery = _fetch_concept_mastery(user_id)
    concept_breakdown = _build_concept_breakdown(mastery)
    weak_topics = [c for c in concept_breakdown if c["status"] == "weak"]
    strong_topics = [c for c in concept_breakdown if c["status"] == "strong"]

    # ---- Session trend ----
    session_trend = _build_session_trend(user_id)

    # ---- Store session analytics if session_id provided ----
    if session_id:
        _store_session_analytics(session_id, accuracy, avg_reasoning,
                                 hint_usage_rate, weak_topics, strong_topics)

    return {
        "user_id": user_id,
        "accuracy": round(accuracy, 4),
        "correct_answers": correct_count,
        "wrong_answers": wrong_count,
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
        "avg_reasoning_score": round(avg_reasoning, 4),
        "hint_usage_rate": round(hint_usage_rate, 4),
        "avg_response_time": round(avg_response_time, 2) if avg_response_time is not None else None,
        "concept_breakdown": concept_breakdown,
        "session_trend": session_trend,
    }


# ---- Data Fetching Helpers ----

def _fetch_answers(user_id: str, session_id: str = None) -> list[dict]:
    """Fetch answers for a user, optionally limited to a session."""
    if session_id:
        # Get question IDs for this session
        questions = (
            supabase.table("questions")
            .select("question_id")
            .eq("session_id", session_id)
            .execute()
        ).data

        if not questions:
            return []

        question_ids = [q["question_id"] for q in questions]
        answers = (
            supabase.table("answers")
            .select("*")
            .in_("question_id", question_ids)
            .execute()
        ).data
    else:
        # All-time: get all sessions for this user, then all their answers
        sessions = (
            supabase.table("sessions")
            .select("session_id")
            .eq("user_id", user_id)
            .execute()
        ).data

        if not sessions:
            return []

        session_ids = [s["session_id"] for s in sessions]
        all_question_ids = []
        for sid in session_ids:
            qs = (
                supabase.table("questions")
                .select("question_id")
                .eq("session_id", sid)
                .execute()
            ).data
            all_question_ids.extend(q["question_id"] for q in qs)

        if not all_question_ids:
            return []

        answers = (
            supabase.table("answers")
            .select("*")
            .in_("question_id", all_question_ids)
            .execute()
        ).data

    return answers or []


def _fetch_concept_mastery(user_id: str) -> list[dict]:
    """Fetch all concept mastery rows for a user."""
    result = (
        supabase.table("concept_mastery")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


# ---- Classification ----

def _build_concept_breakdown(mastery_rows: list[dict]) -> list[dict]:
    """
    Build per-concept breakdown with status labels.

    Status rules:
        mastery_score < 0.50 AND attempts >= 3 → "weak"
        mastery_score > 0.75 AND attempts >= 3 → "strong"
        0.50 <= mastery_score <= 0.75 AND attempts >= 3 → "developing"
        attempts < 3 → "insufficient_data"
    """
    breakdown = []
    for m in mastery_rows:
        attempts = m["attempts"]
        score = m["mastery_score"]

        if attempts < MIN_ATTEMPTS:
            status = "insufficient_data"
        elif score < WEAK_THRESHOLD:
            status = "weak"
        elif score > STRONG_THRESHOLD:
            status = "strong"
        else:
            status = "developing"

        breakdown.append({
            "concept_tag": m["concept_tag"],
            "mastery_score": score,
            "attempts": attempts,
            "correct_answers": m["correct_answers"],
            "status": status,
        })

    # Sort: weak first (ascending score), then developing, then strong
    status_order = {"weak": 0, "developing": 1, "insufficient_data": 2, "strong": 3}
    breakdown.sort(key=lambda x: (status_order.get(x["status"], 2), x["mastery_score"]))

    return breakdown


# ---- Session Trend ----

def _build_session_trend(user_id: str) -> list[dict]:
    """Build session-over-session trend data from session_analytics."""
    sessions = (
        supabase.table("sessions")
        .select("session_id, start_time")
        .eq("user_id", user_id)
        .not_.is_("end_time", "null")
        .order("start_time")
        .execute()
    ).data

    if not sessions:
        return []

    session_ids = [s["session_id"] for s in sessions]
    analytics = (
        supabase.table("session_analytics")
        .select("session_id, accuracy, avg_reasoning_score, hint_usage_rate")
        .in_("session_id", session_ids)
        .execute()
    ).data

    analytics_map = {a["session_id"]: a for a in (analytics or [])}

    trend = []
    for s in sessions:
        sid = s["session_id"]
        if sid in analytics_map:
            a = analytics_map[sid]
            trend.append({
                "session_id": sid,
                "accuracy": a["accuracy"],
                "avg_reasoning_score": a["avg_reasoning_score"],
            })

    return trend


# ---- Storage ----

def _store_session_analytics(session_id: str, accuracy: float,
                              avg_reasoning: float, hint_usage_rate: float,
                              weak_topics: list, strong_topics: list) -> None:
    """Upsert computed analytics into the session_analytics table."""
    row = {
        "session_id": session_id,
        "accuracy": round(accuracy, 4),
        "avg_reasoning_score": round(avg_reasoning, 4),
        "hint_usage_rate": round(hint_usage_rate, 4),
        "weak_topics": [t["concept_tag"] for t in weak_topics],
        "strong_topics": [t["concept_tag"] for t in strong_topics],
    }
    supabase.table("session_analytics").upsert(row, on_conflict="session_id").execute()


# ---- Empty State ----

def _empty_analytics(user_id: str) -> dict:
    """Return zeroed analytics for users with no data."""
    return {
        "user_id": user_id,
        "accuracy": 0,
        "correct_answers": 0,
        "wrong_answers": 0,
        "weak_topics": [],
        "strong_topics": [],
        "avg_reasoning_score": 0,
        "hint_usage_rate": 0,
        "avg_response_time": None,
        "concept_breakdown": [],
        "session_trend": [],
        "message": "Take your first quiz to see analytics.",
    }


# ---- CLI ----

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate user learning analytics")
    parser.add_argument("--user-id", required=True, help="User UUID")
    parser.add_argument("--session-id", default=None, help="Session UUID (optional)")
    args = parser.parse_args()

    result = generate_analytics(args.user_id, args.session_id)
    print(json.dumps(result, indent=2))
