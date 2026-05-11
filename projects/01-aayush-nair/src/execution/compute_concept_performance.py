"""
compute_concept_performance.py — Session-level concept mastery computation

Given a list of result dicts (each with concept_tags[] and correct bool),
computes mastery_score per concept and classifies into weak / developing / strong.

This is a pure deterministic function — no DB, no LLM.
Output is used by the reinforce endpoint and the frontend summary panel.
"""

from collections import defaultdict


# Classification thresholds
WEAK_THRESHOLD      = 0.50   # < 50%  → weak
DEVELOPING_THRESHOLD = 0.75  # 50–75% → developing; > 75% → strong


def compute_concept_performance(results: list[dict]) -> dict:
    """
    Compute per-concept mastery from a list of evaluated answer dicts.

    Each result must have:
        concept_tag  : str           — primary concept (always present)
        concept_tags : list[str]     — optional multi-tag list (falls back to [concept_tag])
        correct      : bool

    Returns:
        {
            "mastery_map":        { concept: mastery_score (0–1) },
            "weak_topics":        [concept, ...],         # < 50%
            "developing_topics":  [concept, ...],         # 50–75%
            "strong_topics":      [concept, ...],         # > 75%
        }
    """
    stats: dict[str, dict] = defaultdict(lambda: {"attempts": 0, "correct": 0})

    for r in results:
        is_correct = bool(r.get("correct", False))
        # Prefer multi-tag list, fall back to [concept_tag]
        tags = r.get("concept_tags") or [r.get("concept_tag", "unknown")]
        # Guard: ensure it's a non-empty list of strings
        if not isinstance(tags, list) or not tags:
            tags = [r.get("concept_tag", "unknown")]

        for tag in tags:
            tag = str(tag).strip()
            if not tag:
                continue
            stats[tag]["attempts"] += 1
            if is_correct:
                stats[tag]["correct"] += 1

    mastery_map = {}
    weak_topics = []
    developing_topics = []
    strong_topics = []

    for tag, s in stats.items():
        if s["attempts"] == 0:
            continue
        score = round(s["correct"] / s["attempts"], 4)
        mastery_map[tag] = score

        if score < WEAK_THRESHOLD:
            weak_topics.append(tag)
        elif score <= DEVELOPING_THRESHOLD:
            developing_topics.append(tag)
        else:
            strong_topics.append(tag)

    return {
        "mastery_map":       mastery_map,
        "weak_topics":       weak_topics,
        "developing_topics": developing_topics,
        "strong_topics":     strong_topics,
    }


def step_down_difficulty(difficulty: str) -> str:
    """Return one difficulty level lower. If already 'easy', stays 'easy'."""
    order = ["easy", "medium", "hard"]
    idx = order.index(difficulty) if difficulty in order else 1
    return order[max(0, idx - 1)]
