from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

import pytest

from backend.services.grading.exceptions import GradingError
from backend.services.grading.grader import GradingService
from backend.services.grading.models import GradingPipelineResult


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

_Q1_ID = str(uuid4())
_Q2_ID = str(uuid4())
_SA1_ID = str(uuid4())
_SA2_ID = str(uuid4())
_SUBMISSION_ID = str(uuid4())


def _make_question(
    *,
    question_id: str = _Q1_ID,
    question_text: str = "Compute the derivative of f(x) = 3x^2 + 2x.",
    question_type: str = "frq",
    answer_key: str = "f'(x) = 6x + 2",
    points_possible: float = 1.0,
) -> dict[str, Any]:
    return {
        "id": question_id,
        "question_text": question_text,
        "question_type": question_type,
        "answer_key": answer_key,
        "points_possible": points_possible,
    }


def _make_answer_row(
    *,
    sa_id: str = _SA1_ID,
    question_id: str = _Q1_ID,
    answer_content: str = "f'(x) = 6x + 2",
) -> dict[str, Any]:
    return {
        "id": sa_id,
        "question_id": question_id,
        "answer_content": answer_content,
    }


class FakeSubmissionStore:
    def __init__(
        self,
        answers: list[dict[str, Any]],
        questions: dict[str, dict[str, Any]],
    ) -> None:
        self._answers = answers
        self._questions = questions

    def get_submission_answers(self, submission_id: str) -> list[dict[str, Any]]:
        return self._answers

    def get_question(self, question_id: str) -> dict[str, Any]:
        return self._questions[question_id]


class FakeGemini:
    def __init__(self, responses: list[str]) -> None:
        self._responses = list(responses)
        self._call_count = 0
        self.prompts: list[str] = []

    def call_gemini(self, *, prompt: str) -> str:
        self.prompts.append(prompt)
        index = min(self._call_count, len(self._responses) - 1)
        self._call_count += 1
        return self._responses[index]


# ---------------------------------------------------------------------------
# LLM response fixtures
# ---------------------------------------------------------------------------


def _correct_response() -> str:
    return json.dumps({
        "correctness_label": "correct",
        "score_value": 1.0,
        "diagnostic_explanation": "The student correctly applied the power rule to find f'(x) = 6x + 2.",
        "concept_label": "power rule differentiation",
        "error_classifications": [],
    })


def _partial_with_formula_misuse() -> str:
    return json.dumps({
        "correctness_label": "partial",
        "score_value": 0.5,
        "diagnostic_explanation": (
            "The student attempted the power rule but misapplied the formula for the "
            "second term, writing 2 instead of 2x^0 = 2. The derivative of the first "
            "term was correct."
        ),
        "concept_label": "power rule differentiation",
        "error_classifications": [
            {
                "error_type": "formula_misuse",
                "description": "Applied the power rule incorrectly to the linear term 2x, omitting the coefficient.",
            },
        ],
    })


def _incorrect_response() -> str:
    return json.dumps({
        "correctness_label": "incorrect",
        "score_value": 0.0,
        "diagnostic_explanation": "The student integrated instead of differentiating.",
        "concept_label": "differentiation vs integration",
        "error_classifications": [
            {
                "error_type": "wrong_method",
                "description": "Student performed integration instead of differentiation.",
            },
            {
                "error_type": "interpretation_error",
                "description": "Misread 'derivative' as 'antiderivative'.",
            },
        ],
    })


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGradeSubmissionSuccess:
    def test_correct_answer_grades_full_marks(self) -> None:
        store = FakeSubmissionStore(
            answers=[_make_answer_row()],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini([_correct_response()])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        result = service.grade_submission(_SUBMISSION_ID)

        assert isinstance(result, GradingPipelineResult)
        assert len(result.graded_answers) == 1
        assert result.graded_answers[0].correctness_label == "correct"
        assert result.graded_answers[0].points_awarded == 1.0
        assert result.total_score == 1.0
        assert result.max_score == 1.0
        assert result.graded_answers[0].error_classifications == []

    def test_partial_with_formula_misuse_parses(self) -> None:
        store = FakeSubmissionStore(
            answers=[_make_answer_row(answer_content="f'(x) = 6x")],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini([_partial_with_formula_misuse()])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        result = service.grade_submission(_SUBMISSION_ID)

        ga = result.graded_answers[0]
        assert ga.correctness_label == "partial"
        assert ga.points_awarded == 0.5
        assert len(ga.error_classifications) == 1
        assert ga.error_classifications[0].error_type == "formula_misuse"
        assert ga.feedback  # diagnostic_explanation mapped to feedback

    def test_incorrect_with_multiple_errors(self) -> None:
        store = FakeSubmissionStore(
            answers=[_make_answer_row(answer_content="x^3 + x^2 + C")],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini([_incorrect_response()])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        result = service.grade_submission(_SUBMISSION_ID)

        ga = result.graded_answers[0]
        assert ga.correctness_label == "incorrect"
        assert ga.points_awarded == 0.0
        assert len(ga.error_classifications) == 2
        error_types = {e.error_type for e in ga.error_classifications}
        assert error_types == {"wrong_method", "interpretation_error"}


class TestMultipleAnswers:
    def test_grades_all_answers_and_sums_scores(self) -> None:
        store = FakeSubmissionStore(
            answers=[
                _make_answer_row(sa_id=_SA1_ID, question_id=_Q1_ID),
                _make_answer_row(sa_id=_SA2_ID, question_id=_Q2_ID, answer_content="wrong"),
            ],
            questions={
                _Q1_ID: _make_question(question_id=_Q1_ID),
                _Q2_ID: _make_question(
                    question_id=_Q2_ID,
                    question_text="What is the integral of 1/x?",
                    answer_key="ln|x| + C",
                ),
            },
        )
        gemini = FakeGemini([_correct_response(), _incorrect_response()])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        result = service.grade_submission(_SUBMISSION_ID)

        assert len(result.graded_answers) == 2
        assert result.total_score == 1.0  # 1.0 + 0.0
        assert result.max_score == 2.0


class TestScoreClamping:
    def test_llm_score_above_max_is_clamped(self) -> None:
        """If the LLM returns score_value > points_possible, clamp it."""
        over_scored = json.dumps({
            "correctness_label": "correct",
            "score_value": 99.0,
            "diagnostic_explanation": "Perfect.",
            "concept_label": "derivatives",
            "error_classifications": [],
        })
        store = FakeSubmissionStore(
            answers=[_make_answer_row()],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini([over_scored])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        result = service.grade_submission(_SUBMISSION_ID)

        assert result.graded_answers[0].points_awarded == 1.0  # clamped to points_possible


class TestErrorHandling:
    def test_invalid_json_raises_grading_error(self) -> None:
        store = FakeSubmissionStore(
            answers=[_make_answer_row()],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini(["this is not json {{{"])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        with pytest.raises(GradingError, match="invalid JSON"):
            service.grade_submission(_SUBMISSION_ID)

    def test_invalid_schema_raises_grading_error(self) -> None:
        bad_schema = json.dumps({
            "correctness_label": "GREAT",
            "score_value": 1.0,
            "diagnostic_explanation": "ok",
            "concept_label": "test",
            "error_classifications": [],
        })
        store = FakeSubmissionStore(
            answers=[_make_answer_row()],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini([bad_schema])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        with pytest.raises(GradingError, match="schema validation"):
            service.grade_submission(_SUBMISSION_ID)

    def test_invalid_error_type_raises_grading_error(self) -> None:
        bad_error_type = json.dumps({
            "correctness_label": "incorrect",
            "score_value": 0.0,
            "diagnostic_explanation": "Wrong.",
            "concept_label": "test",
            "error_classifications": [
                {"error_type": "spelling_mistake", "description": "Bad spelling."},
            ],
        })
        store = FakeSubmissionStore(
            answers=[_make_answer_row()],
            questions={_Q1_ID: _make_question()},
        )
        gemini = FakeGemini([bad_error_type])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        with pytest.raises(GradingError, match="schema validation"):
            service.grade_submission(_SUBMISSION_ID)

    def test_no_answers_raises_not_found(self) -> None:
        store = FakeSubmissionStore(answers=[], questions={})
        gemini = FakeGemini([])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        from backend.models.errors import NotFoundError

        with pytest.raises(NotFoundError):
            service.grade_submission(_SUBMISSION_ID)


class TestPromptContent:
    def test_prompt_includes_question_and_answer(self) -> None:
        store = FakeSubmissionStore(
            answers=[_make_answer_row(answer_content="my answer")],
            questions={_Q1_ID: _make_question(answer_key="the real answer")},
        )
        gemini = FakeGemini([_correct_response()])
        service = GradingService(gemini_caller=gemini, submission_store=store)

        service.grade_submission(_SUBMISSION_ID)

        prompt = gemini.prompts[0]
        assert "my answer" in prompt
        assert "the real answer" in prompt
        assert "Compute the derivative" in prompt
        assert "partial" in prompt.lower()  # prompt must mention partial grading
