from __future__ import annotations

import json

from backend.services.grading.models import LLMGradingResult


def build_grading_prompt(
    *,
    question_text: str,
    student_answer: str,
    answer_key: str,
    question_type: str,
    points_possible: float,
) -> str:
    schema_json = json.dumps(
        LLMGradingResult.model_json_schema(), indent=2, sort_keys=True
    )
    return _GRADING_PROMPT_TEMPLATE.format(
        question_text=question_text,
        student_answer=student_answer,
        answer_key=answer_key,
        question_type=question_type,
        points_possible=points_possible,
        schema_json=schema_json,
    )


_GRADING_PROMPT_TEMPLATE = """\
You are a rigorous but fair STEM grader. Evaluate the student's answer against the \
official answer key and produce a structured grading result.

QUESTION TYPE: {question_type}
POINTS POSSIBLE: {points_possible}

QUESTION:
{question_text}

OFFICIAL ANSWER KEY / RUBRIC:
{answer_key}

STUDENT ANSWER:
{student_answer}

GRADING RULES:

1. CORRECTNESS LABEL — assign EXACTLY one of: "correct", "partial", or "incorrect".
   - "correct": All steps, the final result, and the reasoning are sound.
   - "partial": The student shows some correct understanding but has errors, incomplete \
work, or a wrong final result despite valid intermediate steps. You MUST use "partial" \
whenever the answer is neither fully correct nor entirely wrong. Binary grading is NOT \
acceptable for answers that demonstrate partial understanding.
   - "incorrect": Fundamentally wrong with no redeeming correct reasoning.

2. SCORE — assign score_value as a number in [0, {points_possible}], proportional to \
answer quality. Partial answers MUST receive a score strictly between 0 and {points_possible}.

3. DIAGNOSTIC EXPLANATION — write 2–4 sentences of specific, pedagogically useful \
feedback. The explanation MUST:
   - State exactly what the student did or selected.
   - Explain whether it is right, partially right, or wrong, and WHY.
   - Identify the concept, formula, or reasoning step that was misapplied or missed.
   - For partial credit: acknowledge what was correct and explain what fell short.
   FORBIDDEN: Do NOT write "Correct!", "Expected: X", "Expected [answer key]", or \
any one-line placeholder. Every explanation must be a genuine pedagogical statement.

4. CONCEPT LABEL — a short tag (1–5 words) naming the specific concept being tested.

5. ERROR CLASSIFICATIONS — if the answer has errors, include one or more entries.
   Each entry must have:
   - error_type: exactly one of "wrong_method", "formula_misuse", "computation_error", \
"interpretation_error", "incomplete_reasoning".
   - description: a one-sentence explanation of the specific mistake.
   If the answer is fully correct, error_classifications MUST be an empty list.

SPECIAL HANDLING BY QUESTION TYPE:

For MCQ questions:
   - The student's answer is a letter (A, B, C, D) indicating their selected choice.
   - Determine if the selected letter matches the correct answer letter in the answer key.
   - In diagnostic_explanation: state which option the student chose, whether it is \
correct, and explain why the correct answer is right (or what misconception the wrong \
choice reveals).

For FRQ / calculation / proof questions:
   - Evaluate the reasoning, method, and final answer holistically.
   - Award partial credit for correct setup, correct method with arithmetic error, or \
correct concept with incomplete execution.
   - Do NOT penalise equivalent correct forms (e.g., "6x + 2" and "2 + 6x" are the same).

Return ONLY a valid JSON object matching this schema. No markdown fences, no commentary.
{schema_json}
"""
