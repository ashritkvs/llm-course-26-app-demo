from __future__ import annotations

import json
import logging
from typing import Any, Protocol
from uuid import UUID

from pydantic import ValidationError

from backend.models.errors import ConfigError, NotFoundError, ServiceUnavailableError, UpstreamServiceError
from backend.services.grading.exceptions import GradingError
from backend.services.grading.models import GradedAnswer, GradingPipelineResult, LLMGradingResult
from backend.services.grading.prompts import build_grading_prompt

logger = logging.getLogger(__name__)

# Default points when question has no explicit rubric weight.
_DEFAULT_POINTS_POSSIBLE = 1.0


# ---------------------------------------------------------------------------
# Protocols – keep grader testable without concrete Supabase/Gemini deps
# ---------------------------------------------------------------------------


class GeminiCaller(Protocol):
    def call_gemini(self, *, prompt: str) -> str: ...


class SubmissionStore(Protocol):
    """Minimal read interface the grader needs from the DB layer."""

    def get_submission_answers(self, submission_id: str) -> list[dict[str, Any]]: ...

    def get_question(self, question_id: str) -> dict[str, Any]: ...


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class GradingService:
    def __init__(
        self,
        *,
        gemini_caller: GeminiCaller,
        submission_store: SubmissionStore,
        service_logger: logging.Logger | None = None,
    ) -> None:
        self._gemini = gemini_caller
        self._store = submission_store
        self._logger = service_logger or logger

    def grade_submission(self, submission_id: str) -> GradingPipelineResult:
        self._logger.info("Grading submission %s", submission_id)

        answers = self._store.get_submission_answers(submission_id)
        if not answers:
            raise NotFoundError(f"No answers found for submission {submission_id}")

        graded: list[GradedAnswer] = []
        total_score = 0.0
        max_score = 0.0

        for answer_row in answers:
            question = self._store.get_question(answer_row["question_id"])
            points_possible = float(question.get("points_possible", _DEFAULT_POINTS_POSSIBLE))

            graded_answer = self._grade_single_answer(
                submission_answer_id=answer_row["id"],
                question_id=answer_row["question_id"],
                question_text=question["question_text"],
                question_type=question.get("question_type", "frq"),
                answer_key=question.get("answer_key") or question.get("explanation") or "",
                student_answer=answer_row["answer_content"],
                points_possible=points_possible,
            )
            graded.append(graded_answer)
            total_score += graded_answer.points_awarded
            max_score += graded_answer.points_possible

        result = GradingPipelineResult(
            submission_id=UUID(submission_id),
            graded_answers=graded,
            total_score=total_score,
            max_score=max_score,
        )
        self._logger.info(
            "Grading complete for submission %s: %.1f / %.1f",
            submission_id,
            total_score,
            max_score,
        )
        return result

    def _grade_single_answer(
        self,
        *,
        submission_answer_id: str,
        question_id: str,
        question_text: str,
        question_type: str,
        answer_key: str,
        student_answer: str,
        points_possible: float,
    ) -> GradedAnswer:
        prompt = build_grading_prompt(
            question_text=question_text,
            student_answer=student_answer,
            answer_key=answer_key,
            question_type=question_type,
            points_possible=points_possible,
        )

        raw_response = self._gemini.call_gemini(prompt=prompt)
        llm_result = self._parse_llm_response(raw_response)

        # Clamp score to valid range
        awarded = min(max(llm_result.score_value, 0.0), points_possible)

        return GradedAnswer(
            submission_answer_id=UUID(submission_answer_id),
            question_id=UUID(question_id),
            correctness_label=llm_result.correctness_label,
            points_awarded=awarded,
            points_possible=points_possible,
            feedback=llm_result.diagnostic_explanation,
            concept_label=llm_result.concept_label,
            error_classifications=llm_result.error_classifications,
        )

    def _parse_llm_response(self, raw: str) -> LLMGradingResult:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise GradingError("LLM returned invalid JSON") from exc

        try:
            return LLMGradingResult.model_validate(data)
        except ValidationError as exc:
            raise GradingError(f"LLM response failed schema validation: {exc.error_count()} errors") from exc


# ---------------------------------------------------------------------------
# Builder – wires up real dependencies from Settings
# ---------------------------------------------------------------------------


def build_grading_service(
    *,
    gemini_caller: GeminiCaller,
    submission_store: SubmissionStore,
) -> GradingService:
    return GradingService(
        gemini_caller=gemini_caller,
        submission_store=submission_store,
    )
