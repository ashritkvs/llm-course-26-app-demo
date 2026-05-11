"""
expand_topic.py — Topic expansion via Gemini

Takes a user-entered topic string and returns structured learning concepts
with difficulty categorization.

Usage:
    python expand_topic.py --topic "Deadlocks in Operating Systems"

Returns JSON to stdout:
    {
      "topic": "Deadlocks",
      "concepts": ["mutual exclusion", ...],
      "difficulty_breakdown": { "easy": [], "medium": [], "hard": [] }
    }
"""

import os
import sys
import json
import argparse
from dotenv import load_dotenv
from google import genai

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY must be set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-pro"

# Add parent dir for supabase imports
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase


PROMPT_TEMPLATE = """You are an expert educator. Given a topic, break it down into its core learning concepts and categorize each by difficulty.

Topic: "{topic}"

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{{
  "topic": "<cleaned/short topic name>",
  "concepts": ["concept1", "concept2", ...],
  "difficulty_breakdown": {{
    "easy": ["<concepts needing only recall/basic understanding>"],
    "medium": ["<concepts needing application/analysis>"],
    "hard": ["<concepts needing synthesis/deep reasoning>"]
  }}
}}

Rules:
- Return 4–15 concepts depending on topic breadth.
- Every concept in difficulty_breakdown must also appear in the concepts list.
- Concepts should be lowercase, concise phrases (2–5 words).
- If the topic is too vague (e.g. "Science"), return:
  {{"error": "Topic is too vague. Please be more specific."}}
"""


def validate_schema(data: dict) -> None:
    """
    Validate that the expanded topic JSON matches the expected schema.

    Raises:
        ValueError: If validation fails.
    """
    # Check for error response
    if "error" in data:
        raise ValueError(data["error"])

    # Required top-level keys
    required = {"topic", "concepts", "difficulty_breakdown"}
    missing = required - set(data.keys())
    if missing:
        raise ValueError(f"Missing keys: {missing}")

    # topic must be a non-empty string
    if not isinstance(data["topic"], str) or not data["topic"].strip():
        raise ValueError("'topic' must be a non-empty string")

    # concepts must be a non-empty list of strings
    if not isinstance(data["concepts"], list) or len(data["concepts"]) < 1:
        raise ValueError("'concepts' must be a list with at least 1 item")
    for c in data["concepts"]:
        if not isinstance(c, str) or not c.strip():
            raise ValueError(f"Invalid concept: {c!r}")

    # difficulty_breakdown must have exactly easy/medium/hard
    breakdown = data["difficulty_breakdown"]
    if not isinstance(breakdown, dict):
        raise ValueError("'difficulty_breakdown' must be a dict")
    for level in ("easy", "medium", "hard"):
        if level not in breakdown:
            raise ValueError(f"Missing difficulty level: {level}")
        if not isinstance(breakdown[level], list):
            raise ValueError(f"'{level}' must be a list")

    # Every concept in breakdown must appear in concepts
    all_concepts = set(data["concepts"])
    for level in ("easy", "medium", "hard"):
        for c in breakdown[level]:
            if c not in all_concepts:
                raise ValueError(
                    f"Concept '{c}' in {level} is not in the concepts list"
                )


def expand_topic(topic: str, user_id: str = None, store: bool = True) -> dict:
    """
    Expand a topic into structured concepts via Gemini.

    Args:
        topic: The user-entered topic string.
        user_id: Optional user UUID for storing concepts in Supabase.
        store: Whether to store concepts in Supabase (default True).

    Returns:
        Structured dict with topic, concepts, and difficulty_breakdown.
    """
    prompt = PROMPT_TEMPLATE.format(topic=topic)

    # Call Gemini
    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = response.text.strip()

    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]

    # Parse JSON
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Retry once with a stricter prompt
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON object. No markdown, no backticks, no extra text."
        response = client.models.generate_content(model=MODEL, contents=retry_prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        data = json.loads(text)  # Let it raise if still invalid

    # Validate schema
    validate_schema(data)

    # Store concepts in Supabase if requested
    if store and user_id:
        _store_concepts(user_id, data["concepts"])

    return data


def _store_concepts(user_id: str, concepts: list[str]) -> None:
    """
    Upsert concepts into the concept_mastery table for a user.
    Creates rows with 0 attempts if they don't exist.

    Args:
        user_id: UUID of the user.
        concepts: List of concept tag strings.
    """
    for concept in concepts:
        # Check if row exists
        existing = (
            supabase.table("concept_mastery")
            .select("user_id")
            .eq("user_id", user_id)
            .eq("concept_tag", concept)
            .execute()
        )

        if not existing.data:
            supabase.table("concept_mastery").insert({
                "user_id": user_id,
                "concept_tag": concept,
                "attempts": 0,
                "correct_answers": 0,
                "mastery_score": 0.0,
            }).execute()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Expand a topic into learning concepts")
    parser.add_argument("--topic", required=True, help="Topic to expand")
    parser.add_argument("--user-id", default=None, help="User UUID (optional, for storing concepts)")
    parser.add_argument("--no-store", action="store_true", help="Skip storing concepts in Supabase")
    args = parser.parse_args()

    result = expand_topic(args.topic, args.user_id, store=not args.no_store)
    print(json.dumps(result, indent=2))
