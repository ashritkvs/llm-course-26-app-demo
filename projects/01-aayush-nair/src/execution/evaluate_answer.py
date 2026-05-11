"""
evaluate_answer.py — Answer evaluation engine with misconception detection

Uses Gemini to evaluate student answers against expected reasoning,
assigns a reasoning score (1–5), and detects misconceptions.

Usage:
    python evaluate_answer.py \\
        --question '{"question_text":"...","concept_tag":"circular wait"}' \\
        --expected-reasoning '["step1","step2"]' \\
        --answer "Student's answer text"

Returns JSON to stdout.
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


# ---- Evaluation Prompt ----

EVAL_PROMPT = """You are an expert educational assessment AI. Evaluate the student's answer to the following question.

Question: {question_text}

Expected reasoning steps:
{expected_reasoning_formatted}

Student's answer: {student_answer}

Evaluate the answer and respond with ONLY valid JSON (no markdown fences, no extra text):
{{
  "correct": true or false,
  "reasoning_score": <integer from 1 to 5>,
  "feedback": "2-3 sentences explaining what the student got right or wrong and why",
  "ideal_answer": "A concise, accurate model answer a student should aim for",
  "misconceptions": ["list of specific misconceptions detected in the student's reasoning"],
  "concept_tag": "{concept_tag}"
}}

Scoring guide for reasoning_score:
1 = No understanding — answer is unrelated or random
2 = Minimal understanding — recognizes the topic but reasoning is deeply flawed
3 = Partial understanding — some correct reasoning but key gaps remain
4 = Strong understanding — mostly correct reasoning with only minor gaps
5 = Full understanding — correct answer with complete, well-structured reasoning

STRICT SCORING RULES (CRITICAL — do not violate):
- If correct == false: reasoning_score MUST be 1, 2, or 3. Do NOT give 4 or 5 for wrong answers.
- If correct == true: reasoning_score MUST be 4 or 5. Do NOT give 1, 2, or 3 for correct answers.
- These rules are absolute and override all other considerations.

Additional rules:
- Only list misconceptions that are CLEARLY evidenced by the student's answer. Do not invent misconceptions.
- If the answer is correct and reasoning is sound, misconceptions should be an empty list.
- If the student's answer is empty or just whitespace, return correct=false, reasoning_score=1, misconceptions=["No answer provided"].
- The concept_tag must be exactly "{concept_tag}".
- The ideal_answer must be factually correct and concise (2-4 sentences max).
"""


# ---- Validation ----

def validate_evaluation(data: dict, concept_tag: str) -> dict:
    """
    Validate and normalize the evaluation response.

    Args:
        data: Raw parsed JSON from Gemini.
        concept_tag: Expected concept tag.

    Returns:
        Validated evaluation dict.

    Raises:
        ValueError: If critical fields are missing or invalid.
    """
    # correct — must be bool
    if "correct" not in data or not isinstance(data["correct"], bool):
        raise ValueError("'correct' must be a boolean")

    # reasoning_score — must be int 1–5
    score = data.get("reasoning_score", 1)
    if not isinstance(score, (int, float)):
        raise ValueError("'reasoning_score' must be a number")
    data["reasoning_score"] = max(1, min(5, int(score)))

    # Enforce strict scoring rules:
    # correct=True → score must be ≥ 4; correct=False → score must be ≤ 3
    is_correct = data["correct"]
    if is_correct and data["reasoning_score"] < 4:
        data["reasoning_score"] = 4   # floor for correct answers
    if not is_correct and data["reasoning_score"] > 3:
        data["reasoning_score"] = 3   # ceiling for incorrect answers

    # feedback — optional but expected
    data["feedback"] = str(data.get("feedback", ""))

    # ideal_answer — concise model answer
    data["ideal_answer"] = str(data.get("ideal_answer", ""))

    # misconceptions — must be list of strings
    misconceptions = data.get("misconceptions", [])
    if not isinstance(misconceptions, list):
        data["misconceptions"] = []
    else:
        data["misconceptions"] = [str(m) for m in misconceptions if m]

    # concept_tag — force to match expected
    data["concept_tag"] = concept_tag

    return data


# ---- Core Evaluation ----

def evaluate_answer(
    question: dict,
    student_answer: str,
    expected_reasoning: list[str] = None,
) -> dict:
    """
    Evaluate a student's answer using Gemini.

    Args:
        question: Dict with at minimum 'question_text' and 'concept_tag'.
                  May also contain 'hint_1', 'hint_2', 'hint_3'.
        student_answer: The student's submitted answer.
        expected_reasoning: List of expected reasoning steps.

    Returns:
        Evaluation dict: { correct, reasoning_score, misconceptions, concept_tag }
    """
    # Handle empty answers without burning an API call
    student_answer = (student_answer or "").strip()
    concept_tag = question.get("concept_tag", "general")

    if not student_answer:
        return {
            "correct": False,
            "reasoning_score": 1,
            "misconceptions": ["No answer provided"],
            "concept_tag": concept_tag,
        }

    # Build the expected reasoning display
    if expected_reasoning:
        reasoning_formatted = "\n".join(f"  {i+1}. {step}" for i, step in enumerate(expected_reasoning))
    else:
        reasoning_formatted = "  (No expected reasoning provided — evaluate based on the question alone)"

    prompt = EVAL_PROMPT.format(
        question_text=question.get("question_text", question.get("question", "")),
        expected_reasoning_formatted=reasoning_formatted,
        student_answer=student_answer,
        concept_tag=concept_tag,
    )

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
        # Retry once
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON object. No markdown, no backticks."
        response = client.models.generate_content(model=MODEL, contents=retry_prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        data = json.loads(text)

    # Validate
    data = validate_evaluation(data, concept_tag)
    return data


# ---- Supabase Storage ----

def store_evaluation(
    question_id: str,
    student_answer: str,
    evaluation: dict,
    hints_used: int = 0,
    response_time: float = None,
) -> dict:
    """
    Store the evaluation result in the Supabase answers table.

    Args:
        question_id: UUID of the question.
        student_answer: What the student answered.
        evaluation: Evaluation dict from evaluate_answer().
        hints_used: Number of hints used (0–3).
        response_time: Seconds taken to answer.

    Returns:
        The created answer row.
    """
    # Normalize reasoning_score from 1–5 scale to 0–1 for the DB column
    normalized_score = (evaluation["reasoning_score"] - 1) / 4.0

    row = {
        "question_id": question_id,
        "student_answer": student_answer,
        "correct": evaluation["correct"],
        "reasoning_score": normalized_score,
        "misconceptions": evaluation["misconceptions"],
        "hints_used": hints_used,
        "response_time": response_time,
        "feedback": evaluation.get("feedback", ""),
        "ideal_answer": evaluation.get("ideal_answer", ""),
    }
    result = supabase.table("answers").insert(row).execute()
    return result.data[0]


def update_concept_mastery(user_id: str, concept_tag: str, is_correct: bool) -> None:
    """
    Update the concept_mastery table after an answer.

    Args:
        user_id: UUID of the user.
        concept_tag: The concept tag.
        is_correct: Whether the answer was correct.
    """
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


# ---- CLI ----

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate a student answer with misconception detection")
    parser.add_argument("--question", required=True, help="Question JSON string")
    parser.add_argument("--expected-reasoning", default="[]", help="Expected reasoning JSON array")
    parser.add_argument("--answer", required=True, help="Student's answer")
    args = parser.parse_args()

    question_obj = json.loads(args.question)
    reasoning = json.loads(args.expected_reasoning)
    result = evaluate_answer(question_obj, args.answer, reasoning)
    print(json.dumps(result, indent=2))
