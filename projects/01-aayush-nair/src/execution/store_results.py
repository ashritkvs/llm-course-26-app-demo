"""
store_results.py — Persist quiz data to Supabase

Handles inserting sessions, questions, answers, updating concept mastery,
and computing session analytics.

Usage (as a library):
    from execution.store_results import create_session, store_question, store_answer
"""

import sys
import os

# Add parent dir to path so we can import supabase_client
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase


def create_session(user_id: str, topic: str, difficulty_level: str,
                   source_type: str = "topic") -> dict:
    """
    Create a new quiz session.

    Args:
        user_id: UUID of the user.
        topic: Quiz topic string.
        difficulty_level: easy | medium | hard.
        source_type: "topic" or "pdf".

    Returns:
        The created session row as a dict.
    """
    result = (
        supabase.table("sessions")
        .insert({
            "user_id": user_id,
            "topic": topic,
            "difficulty_level": difficulty_level,
            "source_type": source_type,
        })
        .execute()
    )
    return result.data[0]


def store_question(session_id: str, question: dict) -> dict:
    """
    Store a generated question in the database.

    Args:
        session_id: UUID of the quiz session.
        question: Dict with question_text, concept_tag, difficulty, hint_1, hint_2, hint_3.

    Returns:
        The created question row.
    """
    row = {
        "session_id": session_id,
        "question_text": question["question_text"],
        "concept_tag": question.get("concept_tag", question.get("tags", ["general"])[0]),
        "difficulty": question["difficulty"],
        "hint_1": question.get("hint_1", question.get("socratic_hint", "")),
        "hint_2": question.get("hint_2", ""),
        "hint_3": question.get("hint_3", ""),
    }
    result = supabase.table("questions").insert(row).execute()
    return result.data[0]


def store_answer(question_id: str, student_answer: str, correct: bool,
                 reasoning_score: float = 0.0, misconceptions: list = None,
                 hints_used: int = 0, response_time: float = None) -> dict:
    """
    Store a student's answer.

    Args:
        question_id: UUID of the question.
        student_answer: What the student answered.
        correct: Whether the answer was correct.
        reasoning_score: 0.0–1.0 quality of reasoning.
        misconceptions: List of identified misconception strings.
        hints_used: Number of hints consumed (0–3).
        response_time: Seconds taken to answer.

    Returns:
        The created answer row.
    """
    row = {
        "question_id": question_id,
        "student_answer": student_answer,
        "correct": correct,
        "reasoning_score": reasoning_score,
        "misconceptions": misconceptions or [],
        "hints_used": hints_used,
        "response_time": response_time,
    }
    result = supabase.table("answers").insert(row).execute()
    return result.data[0]


def end_session(session_id: str) -> dict:
    """
    Mark a session as completed by setting its end_time.

    Args:
        session_id: UUID of the session.

    Returns:
        The updated session row.
    """
    result = (
        supabase.table("sessions")
        .update({"end_time": "now()"})
        .eq("session_id", session_id)
        .execute()
    )
    return result.data[0]


def upsert_concept_mastery(user_id: str, concept_tag: str, is_correct: bool) -> None:
    """
    Update concept mastery scores after an answer.

    Increments attempts and conditionally correct_answers,
    then recomputes mastery_score = correct_answers / attempts.

    Args:
        user_id: UUID of the user.
        concept_tag: The concept tag string.
        is_correct: Whether the answer was correct.
    """
    # Check if row exists
    existing = (
        supabase.table("concept_mastery")
        .select("*")
        .eq("user_id", user_id)
        .eq("concept_tag", concept_tag)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        new_attempts = row["attempts"] + 1
        new_correct = row["correct_answers"] + (1 if is_correct else 0)
        new_mastery = new_correct / new_attempts

        supabase.table("concept_mastery").update({
            "attempts": new_attempts,
            "correct_answers": new_correct,
            "mastery_score": round(new_mastery, 4),
        }).eq("user_id", user_id).eq("concept_tag", concept_tag).execute()
    else:
        supabase.table("concept_mastery").insert({
            "user_id": user_id,
            "concept_tag": concept_tag,
            "attempts": 1,
            "correct_answers": 1 if is_correct else 0,
            "mastery_score": 1.0 if is_correct else 0.0,
        }).execute()


def compute_and_store_session_analytics(session_id: str) -> dict:
    """
    Compute session-level analytics and store in session_analytics.

    Calculates accuracy, avg reasoning score, hint usage rate,
    and identifies weak/strong topics for this session.

    Args:
        session_id: UUID of the session.

    Returns:
        The analytics row.
    """
    # Fetch all questions + answers for this session
    questions = (
        supabase.table("questions")
        .select("question_id, concept_tag")
        .eq("session_id", session_id)
        .execute()
    ).data

    if not questions:
        return {}

    question_ids = [q["question_id"] for q in questions]
    concept_map = {q["question_id"]: q["concept_tag"] for q in questions}

    answers = (
        supabase.table("answers")
        .select("*")
        .in_("question_id", question_ids)
        .execute()
    ).data

    if not answers:
        return {}

    # Compute overall metrics
    total = len(answers)
    correct_count = sum(1 for a in answers if a["correct"])
    accuracy = correct_count / total
    avg_reasoning = sum(a.get("reasoning_score", 0) for a in answers) / total
    hint_usage_rate = sum(1 for a in answers if a.get("hints_used", 0) > 0) / total

    # Per-concept accuracy
    from collections import defaultdict
    concept_stats = defaultdict(lambda: {"correct": 0, "total": 0})
    for a in answers:
        tag = concept_map.get(a["question_id"], "unknown")
        concept_stats[tag]["total"] += 1
        if a["correct"]:
            concept_stats[tag]["correct"] += 1

    weak_topics = [
        tag for tag, s in concept_stats.items()
        if s["total"] > 0 and (s["correct"] / s["total"]) < 0.6
    ]
    strong_topics = [
        tag for tag, s in concept_stats.items()
        if s["total"] > 0 and (s["correct"] / s["total"]) > 0.8
    ]

    analytics_row = {
        "session_id": session_id,
        "accuracy": round(accuracy, 4),
        "avg_reasoning_score": round(avg_reasoning, 4),
        "hint_usage_rate": round(hint_usage_rate, 4),
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
    }

    supabase.table("session_analytics").upsert(analytics_row, on_conflict="session_id").execute()
    return analytics_row
