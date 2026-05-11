"""
solve_problem.py — Socratic problem-solving guidance via Gemini

Given a problem statement, generates a step-by-step Socratic breakdown.
Each step is a guiding question (with an optional hint) — never the answer.

Usage (as a library):
    from execution.solve_problem import solve_problem
    result = solve_problem("Prove that √2 is irrational")
    # Returns: {"steps": [{"question": "...", "hint": "..."}]}
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


def build_prompt(problem: str) -> str:
    """Build the Gemini prompt for Socratic problem guidance."""
    return f"""You are a Socratic tutor helping a student solve a problem step by step.

Problem: {problem}

Your task:
- Break the problem into 3 to 6 logical steps.
- For each step, write a Socratic QUESTION that guides the student toward the answer.
- NEVER directly state the answer in the question.
- For each step, also write a brief hint (one sentence) that nudges further without revealing the answer.

Return ONLY a valid JSON object in this exact format — no markdown, no explanation:
{{
  "steps": [
    {{
      "question": "What do we know about the properties of rational numbers?",
      "hint": "Think about how any rational number can be expressed as a fraction of two integers."
    }},
    {{
      "question": "If we assume √2 is rational, how can we write it?",
      "hint": "Express it as p/q in lowest terms where p and q share no common factors."
    }}
  ]
}}

Rules:
- All questions must be open-ended and require the student to think.
- Hints must be one sentence and must NOT contain the answer.
- Return between 3 and 6 steps total.
- Return ONLY the JSON — no additional text."""


def solve_problem(problem: str) -> dict:
    """
    Generate Socratic step-by-step guidance for a problem.

    Args:
        problem: The full problem statement from the student.

    Returns:
        Dict with key "steps", each step having "question" and "hint".

    Raises:
        ValueError: If Gemini returns invalid JSON or missing keys.
        RuntimeError: If the API call fails.
    """
    prompt = build_prompt(problem)

    try:
        response = client.models.generate_content(model=MODEL, contents=prompt)
        text = response.text.strip()
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {e}") from e

    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0].strip()

    # Parse JSON
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # One retry with stricter instruction
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON object. No markdown, no backticks, no extra text."
        try:
            response = client.models.generate_content(model=MODEL, contents=retry_prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                text = text.rsplit("```", 1)[0].strip()
            data = json.loads(text)
        except Exception as e:
            raise ValueError(f"Gemini returned invalid JSON: {e}") from e

    # Validate structure
    if "steps" not in data or not isinstance(data["steps"], list):
        raise ValueError("Response missing 'steps' array")

    for i, step in enumerate(data["steps"]):
        if "question" not in step or "hint" not in step:
            raise ValueError(f"Step {i + 1} missing 'question' or 'hint'")
        if not step["question"].strip():
            raise ValueError(f"Step {i + 1} has empty question")

    return data
