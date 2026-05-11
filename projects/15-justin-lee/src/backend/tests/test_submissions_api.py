from __future__ import annotations

import datetime as dt
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest

from backend.models.submission import (
    SubmissionCreatedResponse,
    SubmissionRead,
)
from backend.routes.submissions import (
    _require_list,
    _require_single,
    _run_grading_job,
)
from backend.services.grading.grader import build_grading_service
from backend.services.grading.service import SupabaseSubmissionStore


# --- Fake Gemini for grading tests ---


class _FakeGemini:
    def __init__(self, responses: list[str]) -> None:
        self._responses = responses
        self._idx = 0

    def call_gemini(self, *, prompt: str) -> str:
        resp = self._responses[min(self._idx, len(self._responses) - 1)]
        self._idx += 1
        return resp


def _correct_llm_response() -> str:
    import json
    return json.dumps({
        "correctness_label": "correct",
        "score_value": 1.0,
        "diagnostic_explanation": (
            "The student selected option A, which is the correct answer. "
            "The reasoning is sound and the concept is well understood."
        ),
        "concept_label": "mcq evaluation",
        "error_classifications": [],
    })


def _incorrect_llm_response() -> str:
    import json
    return json.dumps({
        "correctness_label": "incorrect",
        "score_value": 0.0,
        "diagnostic_explanation": (
            "The student selected option C, but the correct answer is A. "
            "This indicates a misunderstanding of the underlying concept."
        ),
        "concept_label": "mcq evaluation",
        "error_classifications": [
            {
                "error_type": "wrong_method",
                "description": "Selected the wrong answer choice; correct answer was A.",
            },
        ],
    })


# --- Fake Supabase (same pattern as test_generation_routes.py) ---


class FakeTableQuery:
    def __init__(self, tables: dict[str, list[dict[str, Any]]], table_name: str) -> None:
        self._tables = tables
        self._table_name = table_name
        self._operation = "select"
        self._payload: dict[str, Any] | list[dict[str, Any]] | None = None
        self._filters: list[tuple[str, Any]] = []
        self._in_filters: list[tuple[str, list[Any]]] = []
        self._limit: int | None = None

    def select(self, _: str = "*", count: str | None = None) -> FakeTableQuery:
        self._operation = "select"
        return self

    def insert(self, payload: dict[str, Any] | list[dict[str, Any]]) -> FakeTableQuery:
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> FakeTableQuery:
        self._operation = "update"
        self._payload = payload
        return self

    def eq(self, field: str, value: Any) -> FakeTableQuery:
        self._filters.append((field, value))
        return self

    def in_(self, field: str, values: list[Any]) -> FakeTableQuery:
        self._in_filters.append((field, values))
        return self

    def limit(self, value: int) -> FakeTableQuery:
        self._limit = value
        return self

    def order(self, field: str, desc: bool = False) -> FakeTableQuery:
        return self

    def execute(self) -> SimpleNamespace:
        if self._operation == "select":
            rows = [row.copy() for row in self._matching_rows()]
            if self._limit is not None:
                rows = rows[: self._limit]
            return SimpleNamespace(data=rows)

        if self._operation == "insert":
            timestamp = dt.datetime.now(dt.UTC).isoformat()
            if isinstance(self._payload, list):
                for item in self._payload:
                    item.setdefault("created_at", timestamp)
                    self._tables[self._table_name].append(item)
                return SimpleNamespace(data=[item.copy() for item in self._payload])
            payload = dict(self._payload or {})
            payload.setdefault("created_at", timestamp)
            self._tables[self._table_name].append(payload)
            return SimpleNamespace(data=[payload.copy()])

        if self._operation == "update":
            updated_rows: list[dict[str, Any]] = []
            for row in self._matching_rows():
                row.update(self._payload or {})
                updated_rows.append(row.copy())
            return SimpleNamespace(data=updated_rows)

        raise AssertionError(f"Unsupported operation: {self._operation}")

    def _matching_rows(self) -> list[dict[str, Any]]:
        rows = self._tables.setdefault(self._table_name, [])
        result = []
        for row in rows:
            if not all(row.get(field) == value for field, value in self._filters):
                continue
            if not all(row.get(field) in values for field, values in self._in_filters):
                continue
            result.append(row)
        return result


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, Any]]]) -> None:
        self._tables = tables

    def table(self, name: str) -> FakeTableQuery:
        self._tables.setdefault(name, [])
        return FakeTableQuery(self._tables, name)

    @property
    def tables(self) -> dict[str, list[dict[str, Any]]]:
        return self._tables


# --- Fixtures ---


def _make_workspace(*, user_id: UUID, workspace_id: UUID) -> dict[str, Any]:
    return {
        "id": str(workspace_id),
        "user_id": str(user_id),
        "title": "Test Workspace",
        "course_code": "CS 101",
        "description": "Test workspace",
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "updated_at": dt.datetime.now(dt.UTC).isoformat(),
    }


def _make_exam_row(*, exam_id: UUID, workspace_id: UUID) -> dict[str, Any]:
    return {
        "id": str(exam_id),
        "generation_request_id": str(uuid4()),
        "workspace_id": str(workspace_id),
        "title": "Practice: Calculus",
        "exam_mode": "practice",
        "format_type": "mcq",
        "rendered_artifact_path": None,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }


def _make_question_row(
    *, exam_id: UUID, question_order: int, question_id: UUID | None = None,
    answer_key: str = "A", question_type: str = "mcq",
) -> dict[str, Any]:
    return {
        "id": str(question_id or uuid4()),
        "generated_exam_id": str(exam_id),
        "question_order": question_order,
        "question_text": f"Question {question_order}?",
        "question_type": question_type,
        "difficulty_label": "moderate",
        "topic_label": "calculus",
        "answer_key": answer_key,
        "explanation": f"Answer is {answer_key}.",
        "options": ["A", "B", "C", "D"],
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }


# --- Tests ---


def test_post_submission_returns_201() -> None:
    """POST creates a submission + answers and returns status 'submitted'."""
    user_id = uuid4()
    workspace_id = uuid4()
    exam_id = uuid4()
    q1_id = uuid4()
    q2_id = uuid4()

    supabase = FakeSupabase({
        "workspaces": [_make_workspace(user_id=user_id, workspace_id=workspace_id)],
        "generated_exams": [_make_exam_row(exam_id=exam_id, workspace_id=workspace_id)],
        "generated_questions": [
            _make_question_row(exam_id=exam_id, question_order=1, question_id=q1_id, answer_key="A"),
            _make_question_row(exam_id=exam_id, question_order=2, question_id=q2_id, answer_key="B"),
        ],
        "submissions": [],
        "submission_answers": [],
    })

    # Simulate what the route does
    submission_id = uuid4()
    submission_payload = {
        "id": str(submission_id),
        "workspace_id": str(workspace_id),
        "user_id": str(user_id),
        "generated_exam_id": str(exam_id),
        "status": "submitted",
    }
    sub_resp = supabase.table("submissions").insert(submission_payload).execute()
    record = _require_single(sub_resp.data, not_found_message="Failed")

    answer_payloads = [
        {
            "id": str(uuid4()),
            "submission_id": str(submission_id),
            "generated_question_id": str(q1_id),
            "answer_content": "A",
        },
        {
            "id": str(uuid4()),
            "submission_id": str(submission_id),
            "generated_question_id": str(q2_id),
            "answer_content": "C",
        },
    ]
    supabase.table("submission_answers").insert(answer_payloads).execute()

    result = SubmissionCreatedResponse.model_validate(record)
    assert result.status == "submitted"
    assert result.id == submission_id
    assert len(supabase.tables["submissions"]) == 1
    assert len(supabase.tables["submission_answers"]) == 2


def test_get_submission_returns_status_submitted() -> None:
    """GET returns the submission with answers when status is 'submitted'."""
    workspace_id = uuid4()
    submission_id = uuid4()
    exam_id = uuid4()
    q1_id = uuid4()
    answer_id = uuid4()

    supabase = FakeSupabase({
        "submissions": [{
            "id": str(submission_id),
            "workspace_id": str(workspace_id),
            "generated_exam_id": str(exam_id),
            "status": "submitted",
            "overall_score": None,
            "total_possible": None,
            "submitted_at": None,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
        "submission_answers": [{
            "id": str(answer_id),
            "submission_id": str(submission_id),
            "generated_question_id": str(q1_id),
            "answer_content": "A",
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
    })

    # Fetch submission
    sub_resp = (
        supabase.table("submissions")
        .select("*")
        .eq("id", str(submission_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    sub_record = _require_single(sub_resp.data, not_found_message="Not found")

    # Fetch answers
    answers_resp = (
        supabase.table("submission_answers")
        .select("*")
        .eq("submission_id", str(submission_id))
        .execute()
    )
    answer_rows = _require_list(answers_resp.data)

    from backend.models.submission import SubmissionAnswerRead

    result = SubmissionRead(
        id=sub_record["id"],
        workspace_id=sub_record["workspace_id"],
        generated_exam_id=sub_record["generated_exam_id"],
        status=sub_record["status"],
        overall_score=sub_record.get("overall_score"),
        total_possible=sub_record.get("total_possible"),
        submitted_at=sub_record.get("submitted_at"),
        created_at=sub_record["created_at"],
        answers=[
            SubmissionAnswerRead(
                id=a["id"],
                question_id=a["generated_question_id"],
                answer_content=a["answer_content"],
            )
            for a in answer_rows
        ],
    )

    assert result.status == "submitted"
    assert len(result.answers) == 1
    assert result.answers[0].grading_result is None
    assert result.overall_score is None


def test_get_submission_graded_includes_results_and_errors() -> None:
    """GET for a graded submission returns nested grading_results and error_classifications."""
    workspace_id = uuid4()
    submission_id = uuid4()
    exam_id = uuid4()
    q1_id = uuid4()
    q2_id = uuid4()
    answer1_id = uuid4()
    answer2_id = uuid4()
    gr1_id = uuid4()
    gr2_id = uuid4()
    ec1_id = uuid4()

    supabase = FakeSupabase({
        "submissions": [{
            "id": str(submission_id),
            "workspace_id": str(workspace_id),
            "generated_exam_id": str(exam_id),
            "status": "graded",
            "overall_score": 1.0,
            "total_possible": 2.0,
            "submitted_at": None,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
        "submission_answers": [
            {
                "id": str(answer1_id),
                "submission_id": str(submission_id),
                "generated_question_id": str(q1_id),
                "answer_content": "A",
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            },
            {
                "id": str(answer2_id),
                "submission_id": str(submission_id),
                "generated_question_id": str(q2_id),
                "answer_content": "C",
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            },
        ],
        "grading_results": [
            {
                "id": str(gr1_id),
                "submission_answer_id": str(answer1_id),
                "correctness_label": "correct",
                "score_value": 1.0,
                "points_possible": 1.0,
                "diagnostic_explanation": "Correct!",
                "concept_label": "calculus",
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            },
            {
                "id": str(gr2_id),
                "submission_answer_id": str(answer2_id),
                "correctness_label": "incorrect",
                "score_value": 0.0,
                "points_possible": 1.0,
                "diagnostic_explanation": "Expected: B",
                "concept_label": "calculus",
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            },
        ],
        "error_classifications": [
            {
                "id": str(ec1_id),
                "grading_result_id": str(gr2_id),
                "error_type": "wrong_method",
                "description": "Student answered 'C' but expected 'B'",
                "severity": "moderate",
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            },
        ],
    })

    # Simulate GET route logic
    sub_resp = (
        supabase.table("submissions")
        .select("*")
        .eq("id", str(submission_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    sub_record = _require_single(sub_resp.data, not_found_message="Not found")

    answers_resp = (
        supabase.table("submission_answers")
        .select("*")
        .eq("submission_id", str(submission_id))
        .execute()
    )
    answer_rows = _require_list(answers_resp.data)

    answer_ids = [row["id"] for row in answer_rows]
    gr_resp = (
        supabase.table("grading_results")
        .select("*")
        .in_("submission_answer_id", answer_ids)
        .execute()
    )
    gr_rows = _require_list(gr_resp.data)
    gr_by_answer = {row["submission_answer_id"]: row for row in gr_rows}

    gr_ids = [row["id"] for row in gr_rows]
    ec_resp = (
        supabase.table("error_classifications")
        .select("*")
        .in_("grading_result_id", gr_ids)
        .execute()
    )
    ec_by_gr: dict[str, list[dict[str, Any]]] = {}
    for ec_row in _require_list(ec_resp.data):
        ec_by_gr.setdefault(ec_row["grading_result_id"], []).append(ec_row)

    from backend.models.submission import (
        ErrorClassificationRead,
        GradingResultRead,
        SubmissionAnswerRead,
    )

    answers = []
    for a_row in answer_rows:
        gr_row = gr_by_answer.get(a_row["id"])
        grading_result = None
        if gr_row:
            ec_rows = ec_by_gr.get(gr_row["id"], [])
            grading_result = GradingResultRead(
                id=gr_row["id"],
                question_id=a_row["generated_question_id"],
                correctness_label=gr_row["correctness_label"],
                score_value=gr_row["score_value"],
                points_possible=gr_row["points_possible"],
                diagnostic_explanation=gr_row.get("diagnostic_explanation"),
                concept_label=gr_row.get("concept_label"),
                error_classifications=[
                    ErrorClassificationRead.model_validate(ec) for ec in ec_rows
                ],
            )
        answers.append(SubmissionAnswerRead(
            id=a_row["id"],
            question_id=a_row["generated_question_id"],
            answer_content=a_row["answer_content"],
            grading_result=grading_result,
        ))

    result = SubmissionRead(
        id=sub_record["id"],
        workspace_id=sub_record["workspace_id"],
        generated_exam_id=sub_record["generated_exam_id"],
        status=sub_record["status"],
        overall_score=sub_record.get("overall_score"),
        total_possible=sub_record.get("total_possible"),
        submitted_at=sub_record.get("submitted_at"),
        created_at=sub_record["created_at"],
        answers=answers,
    )

    assert result.status == "graded"
    assert result.overall_score == 1.0
    assert result.total_possible == 2.0
    assert len(result.answers) == 2

    # First answer: correct, no error classifications
    correct_answer = next(a for a in result.answers if a.question_id == q1_id)
    assert correct_answer.grading_result is not None
    assert correct_answer.grading_result.correctness_label == "correct"
    assert correct_answer.grading_result.score_value == 1.0
    assert correct_answer.grading_result.error_classifications == []

    # Second answer: incorrect, has error classification
    incorrect_answer = next(a for a in result.answers if a.question_id == q2_id)
    assert incorrect_answer.grading_result is not None
    assert incorrect_answer.grading_result.correctness_label == "incorrect"
    assert incorrect_answer.grading_result.score_value == 0.0
    assert len(incorrect_answer.grading_result.error_classifications) == 1
    assert incorrect_answer.grading_result.error_classifications[0].error_type == "wrong_method"
    assert incorrect_answer.grading_result.error_classifications[0].severity == "moderate"


def test_grading_job_sets_status_to_graded() -> None:
    """The background grading job transitions status from submitted -> grading -> graded."""
    workspace_id = uuid4()
    submission_id = uuid4()
    exam_id = uuid4()
    q1_id = uuid4()
    answer_id = uuid4()

    supabase = FakeSupabase({
        "submissions": [{
            "id": str(submission_id),
            "workspace_id": str(workspace_id),
            "generated_exam_id": str(exam_id),
            "status": "submitted",
            "overall_score": None,
            "total_possible": None,
            "submitted_at": None,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
        "submission_answers": [{
            "id": str(answer_id),
            "submission_id": str(submission_id),
            "generated_question_id": str(q1_id),
            "answer_content": "A",
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
        "generated_questions": [
            _make_question_row(exam_id=exam_id, question_order=1, question_id=q1_id, answer_key="A"),
        ],
        "grading_results": [],
        "error_classifications": [],
    })

    grading_service = build_grading_service(
        gemini_caller=_FakeGemini([_correct_llm_response()]),
        submission_store=SupabaseSubmissionStore(supabase),
    )
    _run_grading_job(
        submission_id=submission_id,
        supabase=supabase,
        _grading_service=grading_service,
    )

    # Verify final status is graded
    sub_row = supabase.tables["submissions"][0]
    assert sub_row["status"] == "graded"
    assert sub_row["overall_score"] == 1.0
    assert sub_row["total_possible"] == 1.0

    # Verify grading results were created with canonical column names
    assert len(supabase.tables["grading_results"]) == 1
    gr = supabase.tables["grading_results"][0]
    assert gr["correctness_label"] == "correct"
    assert gr["score_value"] == 1.0
    assert gr["points_possible"] == 1.0
    assert gr["diagnostic_explanation"]  # LLM-produced — non-empty

    # No error classifications for correct answers
    assert len(supabase.tables["error_classifications"]) == 0


def test_grading_job_handles_incorrect_answer() -> None:
    """The grading job creates error classifications for incorrect answers."""
    workspace_id = uuid4()
    submission_id = uuid4()
    exam_id = uuid4()
    q1_id = uuid4()
    answer_id = uuid4()

    supabase = FakeSupabase({
        "submissions": [{
            "id": str(submission_id),
            "workspace_id": str(workspace_id),
            "generated_exam_id": str(exam_id),
            "status": "submitted",
            "overall_score": None,
            "total_possible": None,
            "submitted_at": None,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
        "submission_answers": [{
            "id": str(answer_id),
            "submission_id": str(submission_id),
            "generated_question_id": str(q1_id),
            "answer_content": "C",
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
        }],
        "generated_questions": [
            _make_question_row(exam_id=exam_id, question_order=1, question_id=q1_id, answer_key="A"),
        ],
        "grading_results": [],
        "error_classifications": [],
    })

    grading_service = build_grading_service(
        gemini_caller=_FakeGemini([_incorrect_llm_response()]),
        submission_store=SupabaseSubmissionStore(supabase),
    )
    _run_grading_job(
        submission_id=submission_id,
        supabase=supabase,
        _grading_service=grading_service,
    )

    sub_row = supabase.tables["submissions"][0]
    assert sub_row["status"] == "graded"
    assert sub_row["overall_score"] == 0.0
    assert sub_row["total_possible"] == 1.0

    assert len(supabase.tables["grading_results"]) == 1
    gr = supabase.tables["grading_results"][0]
    assert gr["correctness_label"] == "incorrect"
    assert gr["score_value"] == 0.0

    assert len(supabase.tables["error_classifications"]) == 1
    ec = supabase.tables["error_classifications"][0]
    assert ec["error_type"] == "wrong_method"
    assert ec["severity"] == "moderate"


def test_submission_not_found_raises_error() -> None:
    """Requesting a non-existent submission raises NotFoundError."""
    from backend.models.errors import NotFoundError

    supabase = FakeSupabase({"submissions": []})

    resp = (
        supabase.table("submissions")
        .select("*")
        .eq("id", str(uuid4()))
        .eq("workspace_id", str(uuid4()))
        .limit(1)
        .execute()
    )

    with pytest.raises(NotFoundError):
        _require_single(resp.data, not_found_message="Submission not found")
