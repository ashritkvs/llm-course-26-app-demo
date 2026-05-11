"""
adaptive_difficulty.py — Deterministic adaptive difficulty engine

Pure logic, no LLM calls. Computes the recommended difficulty level for
the next question batch based on session accuracy.

Rules:
    session accuracy < 65%  → one step easier
    session accuracy > 80%  → one step harder
    otherwise               → keep same difficulty

Difficulty levels: beginner → intermediate → advanced

Usage:
    python adaptive_difficulty.py --session-id <uuid>
    python adaptive_difficulty.py --accuracy 0.72 --current-difficulty intermediate

Returns JSON to stdout.
"""

import sys
import os
import json
import argparse

# Add parent dir for supabase imports
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase


# ---- Constants ----

DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"]

# Quiz difficulty levels (easy/medium/hard) used by the quiz engine
QUIZ_DIFFICULTY_LEVELS = ["easy", "medium", "hard"]

# Thresholds
LOWER_THRESHOLD = 0.65   # Below this → step easier
UPPER_THRESHOLD = 0.80   # Above this → step harder

# Within-session adaptive: look at this many recent answers
RECENT_WINDOW = 2


# ---- Within-Session Adaptive Logic ----

def compute_next_difficulty(recent_results: list, current_difficulty: str) -> dict:
    """
    Compute the next question's difficulty from the last N results within a session.

    Pure deterministic — no DB, no LLM.

    Rules (looking at last RECENT_WINDOW = 2 answers):
        All correct  → step up   (easy→medium→hard; hard stays hard)
        All incorrect → step down (hard→medium→easy; easy stays easy)
        Mixed / < 2 answers → unchanged

    Args:
        recent_results:     List of bool (True=correct). Only last RECENT_WINDOW used.
        current_difficulty: Current level: 'easy' | 'medium' | 'hard'

    Returns:
        {
            "next_difficulty":  str,     # level to use for the next question
            "trend":            str,     # "↑" | "↓" | "→"
            "changed":          bool,
            "reason":           str,
        }
    """
    levels = QUIZ_DIFFICULTY_LEVELS
    current_idx = levels.index(current_difficulty) if current_difficulty in levels else 1

    window = list(recent_results)[-RECENT_WINDOW:]

    if len(window) >= RECENT_WINDOW and all(window):
        new_idx = min(len(levels) - 1, current_idx + 1)
        trend = "↑"
        reason = f"Last {RECENT_WINDOW} answers all correct → stepping up"
    elif len(window) >= RECENT_WINDOW and not any(window):
        new_idx = max(0, current_idx - 1)
        trend = "↓"
        reason = f"Last {RECENT_WINDOW} answers all incorrect → stepping down"
    else:
        new_idx = current_idx
        trend = "→"
        reason = "Mixed or insufficient results → maintaining difficulty"

    next_diff = levels[new_idx]
    changed = next_diff != current_difficulty
    if not changed:
        trend = "→"

    return {
        "next_difficulty": next_diff,
        "trend": trend,
        "changed": changed,
        "reason": reason,
    }



# ---- Core Logic ----

def compute_session_accuracy(session_id: str) -> float:
    """
    Compute the accuracy for a given session from the answers table.

    Args:
        session_id: UUID of the session.

    Returns:
        Accuracy as a float (0.0–1.0). Returns 0.0 if no answers found.
    """
    # Get all question IDs for this session
    questions = (
        supabase.table("questions")
        .select("question_id")
        .eq("session_id", session_id)
        .execute()
    ).data

    if not questions:
        return 0.0

    question_ids = [q["question_id"] for q in questions]

    # Get all answers for these questions
    answers = (
        supabase.table("answers")
        .select("correct")
        .in_("question_id", question_ids)
        .execute()
    ).data

    if not answers:
        return 0.0

    correct_count = sum(1 for a in answers if a["correct"])
    return correct_count / len(answers)


def get_current_difficulty(session_id: str) -> str:
    """
    Get the difficulty level of a session.

    Args:
        session_id: UUID of the session.

    Returns:
        Difficulty string, mapped to beginner/intermediate/advanced.
    """
    session = (
        supabase.table("sessions")
        .select("difficulty_level")
        .eq("session_id", session_id)
        .execute()
    ).data

    if not session:
        return "intermediate"

    raw = session[0]["difficulty_level"]

    # Map legacy easy/medium/hard to new levels if needed
    legacy_map = {"easy": "beginner", "medium": "intermediate", "hard": "advanced"}
    return legacy_map.get(raw, raw)


def resolve_next_difficulty(accuracy: float, current_difficulty: str) -> dict:
    """
    Determine the recommended difficulty for the next question batch.

    This is pure deterministic logic — no LLM calls.

    Args:
        accuracy: Session accuracy (0.0–1.0).
        current_difficulty: Current difficulty level
                            (beginner / intermediate / advanced).

    Returns:
        Dict with current_difficulty, accuracy, recommended_difficulty,
        and the reason for the change.
    """
    current_idx = DIFFICULTY_LEVELS.index(current_difficulty) if current_difficulty in DIFFICULTY_LEVELS else 1

    if accuracy < LOWER_THRESHOLD:
        new_idx = max(0, current_idx - 1)
        reason = f"Accuracy {accuracy:.0%} < {LOWER_THRESHOLD:.0%} threshold → stepping easier"
    elif accuracy > UPPER_THRESHOLD:
        new_idx = min(len(DIFFICULTY_LEVELS) - 1, current_idx + 1)
        reason = f"Accuracy {accuracy:.0%} > {UPPER_THRESHOLD:.0%} threshold → stepping harder"
    else:
        new_idx = current_idx
        reason = f"Accuracy {accuracy:.0%} is within target range → maintaining difficulty"

    recommended = DIFFICULTY_LEVELS[new_idx]
    changed = recommended != current_difficulty

    return {
        "current_difficulty": current_difficulty,
        "accuracy": round(accuracy, 4),
        "recommended_difficulty": recommended,
        "changed": changed,
        "reason": reason,
    }


def resolve_from_session(session_id: str) -> dict:
    """
    Compute accuracy from a session and resolve next difficulty.

    Convenience function that chains compute_session_accuracy →
    get_current_difficulty → resolve_next_difficulty.

    Args:
        session_id: UUID of the session.

    Returns:
        Full resolution dict.
    """
    accuracy = compute_session_accuracy(session_id)
    current = get_current_difficulty(session_id)
    return resolve_next_difficulty(accuracy, current)


def get_user_recommended_difficulty(user_id: str) -> dict:
    """
    Get recommended difficulty for a user based on their most recent
    completed session.

    Args:
        user_id: UUID of the user.

    Returns:
        Resolution dict, or default to intermediate if no history.
    """
    # Find the most recent completed session
    sessions = (
        supabase.table("sessions")
        .select("session_id")
        .eq("user_id", user_id)
        .not_.is_("end_time", "null")
        .order("start_time", desc=True)
        .limit(1)
        .execute()
    ).data

    if not sessions:
        return {
            "current_difficulty": "intermediate",
            "accuracy": 0.0,
            "recommended_difficulty": "intermediate",
            "changed": False,
            "reason": "No previous sessions — starting at intermediate",
        }

    return resolve_from_session(sessions[0]["session_id"])


# ---- CLI ----

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute adaptive difficulty recommendation")

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--session-id", help="Session UUID to compute from")
    group.add_argument("--accuracy", type=float, help="Manual accuracy value (0.0–1.0)")

    parser.add_argument("--current-difficulty", default="intermediate",
                        choices=DIFFICULTY_LEVELS,
                        help="Current difficulty (used with --accuracy)")
    parser.add_argument("--user-id", help="User UUID (alternative to --session-id)")
    args = parser.parse_args()

    if args.session_id:
        result = resolve_from_session(args.session_id)
    elif args.user_id:
        result = get_user_recommended_difficulty(args.user_id)
    else:
        result = resolve_next_difficulty(args.accuracy, args.current_difficulty)

    print(json.dumps(result, indent=2))
