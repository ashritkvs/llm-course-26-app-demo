"""
quiz_engine.py — Adaptive difficulty engine

For adaptive mode: builds a per-question difficulty distribution tuned to the
user's last session accuracy (40/40/20 default, shifts easier or harder).
For forced mode: uses the selected difficulty for all questions in one call.
"""

import sys
import os
import random

# Add parent dir to path for execution imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from execution.supabase_client import supabase
from execution.generate_questions import generate_questions, generate_questions_batch


# ── Difficulty thresholds ─────────────────────────────────────────────────────
LOWER_THRESHOLD = 0.65  # Below → shift easier
UPPER_THRESHOLD = 0.80  # Above → shift harder

DIFFICULTY_ORDER = ["easy", "medium", "hard"]

# Adaptive distributions
DEFAULT_DISTRIBUTION = {"easy": 0.40, "medium": 0.40, "hard": 0.20}
EASIER_DISTRIBUTION  = {"easy": 0.60, "medium": 0.30, "hard": 0.10}
HARDER_DISTRIBUTION  = {"easy": 0.20, "medium": 0.40, "hard": 0.40}


def _get_last_accuracy(user_id: str):
    """Return (accuracy | None, last_difficulty_str)."""
    last_sessions = (
        supabase.table("sessions")
        .select("session_id, difficulty_level")
        .eq("user_id", user_id)
        .not_.is_("end_time", "null")
        .order("start_time", desc=True)
        .limit(1)
        .execute()
    )
    if not last_sessions.data:
        return None, "medium"

    last = last_sessions.data[0]
    session_id = last["session_id"]
    last_difficulty = last["difficulty_level"] or "medium"

    analytics = (
        supabase.table("session_analytics")
        .select("accuracy")
        .eq("session_id", session_id)
        .execute()
    )
    if not analytics.data:
        return None, last_difficulty

    return analytics.data[0]["accuracy"], last_difficulty


def resolve_difficulty(user_id: str, default: str = "medium") -> str:
    """
    Determine a single representative difficulty (used when setting the
    session record or when a non-adaptive fixed difficulty is needed).
    """
    accuracy, last_difficulty = _get_last_accuracy(user_id)
    if accuracy is None:
        return default

    current_idx = DIFFICULTY_ORDER.index(last_difficulty)
    if accuracy < LOWER_THRESHOLD:
        return DIFFICULTY_ORDER[max(0, current_idx - 1)]
    elif accuracy > UPPER_THRESHOLD:
        return DIFFICULTY_ORDER[min(len(DIFFICULTY_ORDER) - 1, current_idx + 1)]
    return last_difficulty


def _build_difficulty_list(user_id: str, count: int) -> list:
    """
    Build a shuffled per-question difficulty list for adaptive mode.
    Distribution is tuned based on the user's last session accuracy.
    """
    accuracy, _ = _get_last_accuracy(user_id)

    if accuracy is None:
        dist = DEFAULT_DISTRIBUTION
    elif accuracy < LOWER_THRESHOLD:
        dist = EASIER_DISTRIBUTION
    elif accuracy > UPPER_THRESHOLD:
        dist = HARDER_DISTRIBUTION
    else:
        dist = DEFAULT_DISTRIBUTION

    difficulties = []
    for level, fraction in dist.items():
        n = max(1, round(fraction * count))
        difficulties.extend([level] * n)

    difficulties = difficulties[:count]
    while len(difficulties) < count:
        difficulties.append("medium")

    random.shuffle(difficulties)
    return difficulties


def get_user_performance(user_id: str, concept: str):
    """Fetch mastery data for a user+concept from concept_mastery."""
    result = (
        supabase.table("concept_mastery")
        .select("*")
        .eq("user_id", user_id)
        .eq("concept_tag", concept)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def start_quiz(
    user_id: str,
    concept: str,
    count: int = 5,
    session_id=None,
    forced_difficulty=None,
    question_format: str = "open",
    source_text: str = None,
):
    """
    Start a new quiz.

    Forced mode  → one Gemini call, all questions at the selected difficulty.
    Adaptive mode → one Gemini call (batch) for all questions at their assigned
                    difficulties.

    source_text: optional raw text from a PDF — sent to Gemini as reading material
                 while concept is used as a clean display title.
    """
    user_performance = get_user_performance(user_id, concept)

    if forced_difficulty:
        questions = generate_questions(
            concept=concept,
            difficulty=forced_difficulty,
            count=count,
            user_performance=user_performance,
            session_id=session_id,
            store=session_id is not None,
            question_format=question_format,
            source_text=source_text,
        )
        return forced_difficulty, questions

    # Adaptive mode: build per-question difficulty list, then ONE batch Gemini call
    difficulty_list = _build_difficulty_list(user_id, count)

    level_counts = {lvl: difficulty_list.count(lvl) for lvl in DIFFICULTY_ORDER}
    session_difficulty = max(level_counts, key=lambda k: level_counts[k])

    questions = generate_questions_batch(
        concept=concept,
        difficulty_list=difficulty_list,
        user_performance=user_performance,
        session_id=session_id,
        store=session_id is not None,
        question_format=question_format,
        source_text=source_text,
    )

    return session_difficulty, questions
