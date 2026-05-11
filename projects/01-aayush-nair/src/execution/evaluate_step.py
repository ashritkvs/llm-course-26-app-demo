"""
evaluate_step.py — Socratic reasoning evaluator for problem-mode steps

Unlike evaluate_answer.py (which checks quiz answers against a stored correct_answer),
this evaluator assesses FREE-FORM reasoning on a Socratic guiding question.

There is no single "correct" answer — Gemini judges:
  - How well the student's reasoning addresses the guiding question
  - Where their thinking breaks down (gaps, misunderstandings)
  - A Socratic nudge that guides without revealing the answer

Returns:
    {
      "reasoning_score": int (1–5),
      "on_track": bool,          # True if reasoning is good enough to move on
      "what_went_wrong": str,    # Plain-language explanation of gaps (empty if on_track)
      "socratic_nudge": str,     # A follow-up question to push thinking further (always present)
    }
"""

import os
import sys
import json
from dotenv import load_dotenv
from google import genai

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY must be set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"


EVAL_PROMPT = """You are a Socratic tutor evaluating a student's reasoning on a guiding question.

Original problem: {problem}

Guiding question (step {step_num} of {total_steps}): {question}

Hint provided (if the student revealed it): {hint}

Student's response: {student_answer}

Your task:
- Assess the QUALITY OF REASONING, not whether the answer is "correct" in a binary sense.
- This is open-ended — there is no single right answer, only better or worse reasoning.
- Determine if the reasoning is strong enough to move forward ("on_track": true) or needs more work.

Respond with ONLY valid JSON (no markdown, no extra text):
{{
  "reasoning_score": <integer 1 to 5>,
  "on_track": <true or false>,
  "what_went_wrong": "<if on_track is false: 1-2 sentences explaining the gap in reasoning. If on_track is true: empty string>",
  "socratic_nudge": "<A single follow-up question that pushes the student's thinking to the next level — never give the answer directly>"
}}

Scoring guide:
1 = No engagement — answer is blank, off-topic, or random
2 = Surface-level — student names the right topic but reasoning is absent or deeply flawed
3 = Partial — some valid reasoning but a key step is missing or misunderstood
4 = Strong — mostly correct reasoning with only minor gaps; ready to move forward
5 = Excellent — complete, well-structured reasoning that addresses the question fully

Rules:
- "on_track" should be true if reasoning_score >= 4.
- "what_went_wrong" MUST be empty string ("") when on_track is true.
- "socratic_nudge" is ALWAYS present and NEVER gives the answer.
- If the answer is empty or just whitespace, return score=1, on_track=false.
- Keep all text fields concise and direct — no filler phrases.
"""


def evaluate_step(
    problem: str,
    question: str,
    hint: str,
    student_answer: str,
    step_num: int = 1,
    total_steps: int = 1,
) -> dict:
    """
    Evaluate a student's response to a Socratic guiding question in problem mode.

    Args:
        problem:        The original full problem statement.
        question:       The guiding question for this step.
        hint:           The hint text (empty string if not revealed).
        student_answer: The student's free-form response.
        step_num:       Current step index (1-based).
        total_steps:    Total number of steps.

    Returns:
        Dict with: reasoning_score, on_track, what_went_wrong, socratic_nudge
    """
    student_answer = (student_answer or "").strip()

    # Short-circuit empty answers without burning API tokens
    if not student_answer:
        return {
            "reasoning_score": 1,
            "on_track": False,
            "what_went_wrong": "No response was provided.",
            "socratic_nudge": "Try to write at least one sentence about what you think — any starting point helps.",
        }

    prompt = EVAL_PROMPT.format(
        problem=problem,
        step_num=step_num,
        total_steps=total_steps,
        question=question,
        hint=hint if hint else "(not revealed)",
        student_answer=student_answer,
    )

    try:
        response = client.models.generate_content(model=MODEL, contents=prompt)
        text = response.text.strip()
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {e}") from e

    # Strip markdown fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0].strip()

    # Parse JSON
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON object. No markdown, no backticks, no extra text."
        try:
            response = client.models.generate_content(model=MODEL, contents=retry_prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                text = text.rsplit("```", 1)[0].strip()
            data = json.loads(text)
        except Exception as e:
            raise ValueError(f"Gemini returned invalid JSON after retry: {e}") from e

    # Normalize
    score = max(1, min(5, int(data.get("reasoning_score", 1))))
    on_track = bool(data.get("on_track", score >= 4))

    # Enforce consistency: on_track=True requires score >= 4
    if on_track and score < 4:
        score = 4
    if not on_track and score >= 4:
        on_track = True   # trust the score over the flag

    what_went_wrong = str(data.get("what_went_wrong", "")) if not on_track else ""
    socratic_nudge = str(data.get("socratic_nudge", "Keep thinking — what does this step tell you about the next?"))

    return {
        "reasoning_score": score,
        "on_track": on_track,
        "what_went_wrong": what_went_wrong,
        "socratic_nudge": socratic_nudge,
    }
