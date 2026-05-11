from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.models.grading import (
    AnswerItem,
    ErrorClassificationCreate,
    GradingResultCreate,
    SubmissionAnswersPayload,
)

# ---------------------------------------------------------------------------
# CorrectnessLabel validation
# ---------------------------------------------------------------------------


class TestCorrectnessLabel:
    @pytest.mark.parametrize("label", ["correct", "partial", "incorrect"])
    def test_valid_correctness_labels(self, label: str) -> None:
        result = GradingResultCreate(
            submission_answer_id="00000000-0000-0000-0000-000000000001",
            correctness_label=label,
            score_value=1,
            points_possible=1,
        )
        assert result.correctness_label == label

    @pytest.mark.parametrize("label", ["wrong", "CORRECT", "Partial", "", "unknown", "true", "yes", "right"])
    def test_invalid_correctness_labels(self, label: str) -> None:
        with pytest.raises(ValidationError):
            GradingResultCreate(
                submission_answer_id="00000000-0000-0000-0000-000000000001",
                correctness_label=label,
                score_value=1,
                points_possible=1,
            )


# ---------------------------------------------------------------------------
# ErrorType validation
# ---------------------------------------------------------------------------


class TestErrorType:
    @pytest.mark.parametrize(
        "error_type",
        [
            "wrong_method",
            "formula_misuse",
            "computation_error",
            "interpretation_error",
            "incomplete_reasoning",
        ],
    )
    def test_valid_error_types(self, error_type: str) -> None:
        ec = ErrorClassificationCreate(
            grading_result_id="00000000-0000-0000-0000-000000000001",
            error_type=error_type,
        )
        assert ec.error_type == error_type

    @pytest.mark.parametrize(
        "error_type",
        ["typo", "WRONG_METHOD", "computation", "", "other", "incorrect_answer"],
    )
    def test_invalid_error_types(self, error_type: str) -> None:
        with pytest.raises(ValidationError):
            ErrorClassificationCreate(
                grading_result_id="00000000-0000-0000-0000-000000000001",
                error_type=error_type,
            )


# ---------------------------------------------------------------------------
# GradingResultCreate field constraints
# ---------------------------------------------------------------------------


class TestGradingResultConstraints:
    def test_negative_score_value_rejected(self) -> None:
        with pytest.raises(ValidationError):
            GradingResultCreate(
                submission_answer_id="00000000-0000-0000-0000-000000000001",
                correctness_label="correct",
                score_value=-1,
                points_possible=1,
            )

    def test_zero_points_possible_rejected(self) -> None:
        with pytest.raises(ValidationError):
            GradingResultCreate(
                submission_answer_id="00000000-0000-0000-0000-000000000001",
                correctness_label="correct",
                score_value=0,
                points_possible=0,
            )


# ---------------------------------------------------------------------------
# SubmissionAnswersPayload validation
# ---------------------------------------------------------------------------


class TestSubmissionAnswersPayload:
    def test_valid_payload(self) -> None:
        payload = SubmissionAnswersPayload(
            answers=[
                AnswerItem(
                    question_id="00000000-0000-0000-0000-000000000001",
                    answer_content="42",
                ),
            ]
        )
        assert len(payload.answers) == 1

    def test_empty_answers_rejected(self) -> None:
        with pytest.raises(ValidationError):
            SubmissionAnswersPayload(answers=[])

    def test_empty_answer_content_rejected(self) -> None:
        with pytest.raises(ValidationError):
            SubmissionAnswersPayload(
                answers=[
                    AnswerItem(
                        question_id="00000000-0000-0000-0000-000000000001",
                        answer_content="",
                    ),
                ]
            )
