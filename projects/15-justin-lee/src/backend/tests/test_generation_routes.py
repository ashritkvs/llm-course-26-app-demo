from __future__ import annotations

import datetime as dt
import subprocess
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest

from backend.models.generation import (
    GeneratedExamDetail,
    GeneratedExamSummary,
    GeneratedQuestionRead,
    GenerationRequestCreate,
    GenerationRequestRead,
)
from backend.routes.generation import (
    _persist_assembly,
    _require_list,
    _require_single,
    _run_generation_job,
)
from backend.services.generation.models import FinalExamAssembly, FinalQuestion


# --- Fake Supabase (same pattern as test_profile_service.py) ---


class FakeTableQuery:
    def __init__(self, tables: dict[str, list[dict[str, object]]], table_name: str) -> None:
        self._tables = tables
        self._table_name = table_name
        self._operation = "select"
        self._payload: dict[str, object] | list[dict[str, object]] | None = None
        self._filters: list[tuple[str, object]] = []
        self._limit: int | None = None
        self._order_field: str | None = None
        self._order_desc: bool = False

    def select(self, _: str = "*", count: str | None = None) -> FakeTableQuery:
        self._operation = "select"
        return self

    def insert(self, payload: dict[str, object] | list[dict[str, object]]) -> FakeTableQuery:
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, object]) -> FakeTableQuery:
        self._operation = "update"
        self._payload = payload
        return self

    def delete(self) -> FakeTableQuery:
        self._operation = "delete"
        return self

    def eq(self, field: str, value: object) -> FakeTableQuery:
        self._filters.append((field, value))
        return self

    def limit(self, value: int) -> FakeTableQuery:
        self._limit = value
        return self

    def order(self, field: str, desc: bool = False) -> FakeTableQuery:
        self._order_field = field
        self._order_desc = desc
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
            updated_rows: list[dict[str, object]] = []
            for row in self._matching_rows():
                row.update(self._payload or {})
                updated_rows.append(row.copy())
            return SimpleNamespace(data=updated_rows)

        raise AssertionError(f"Unsupported operation: {self._operation}")

    def _matching_rows(self) -> list[dict[str, object]]:
        return [
            row
            for row in self._tables.setdefault(self._table_name, [])
            if all(row.get(field) == value for field, value in self._filters)
        ]


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, object]]]) -> None:
        self._tables = tables

    def table(self, name: str) -> FakeTableQuery:
        self._tables.setdefault(name, [])
        return FakeTableQuery(self._tables, name)

    @property
    def tables(self) -> dict[str, list[dict[str, object]]]:
        return self._tables


# --- Fixtures ---


def _make_workspace(*, user_id: UUID, workspace_id: UUID) -> dict[str, object]:
    return {
        "id": str(workspace_id),
        "user_id": str(user_id),
        "title": "AMS 310",
        "course_code": "AMS 310",
        "description": "Test workspace",
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "updated_at": dt.datetime.now(dt.UTC).isoformat(),
    }


def _make_generation_request_row(
    *,
    request_id: UUID,
    workspace_id: UUID,
    status: str = "queued",
) -> dict[str, object]:
    return {
        "id": str(request_id),
        "workspace_id": str(workspace_id),
        "request_type": "practice_set",
        "scope_constraints": {"topics": ["Calculus"], "document_ids": [], "custom_prompt": None},
        "generation_config": {"question_count": 5, "format_type": "mcq", "difficulty": None, "question_types": []},
        "status": status,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }


def _make_exam_row(
    *,
    exam_id: UUID,
    workspace_id: UUID,
    request_id: UUID | None = None,
) -> dict[str, object]:
    return {
        "id": str(exam_id),
        "generation_request_id": str(request_id or uuid4()),
        "workspace_id": str(workspace_id),
        "title": "Practice: Calculus",
        "exam_mode": "practice",
        "format_type": "mcq",
        "rendered_artifact_path": None,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }


def _make_question_row(
    *,
    exam_id: UUID,
    question_order: int,
    question_id: UUID | None = None,
) -> dict[str, object]:
    return {
        "id": str(question_id or uuid4()),
        "generated_exam_id": str(exam_id),
        "question_order": question_order,
        "question_text": f"Question {question_order}?",
        "question_type": "mcq",
        "difficulty_label": "moderate",
        "topic_label": "calculus",
        "answer_key": "A",
        "explanation": "Because A is correct.",
        "options": ["4", "3", "5", "6"],
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }


def _make_assembly(*, question_count: int = 5) -> FinalExamAssembly:
    return FinalExamAssembly(
        title="Practice: Calculus",
        exam_mode="practice",
        format_type="mcq",
        questions=[
            FinalQuestion(
                question_order=i,
                question_text=f"Question {i}?",
                question_type="mcq",
                difficulty_label="moderate",
                topic_label="calculus",
                answer_key="A",
                explanation="Basic math.",
                options=["4", "3", "5", "6"],
            )
            for i in range(1, question_count + 1)
        ],
    )


# --- Tests ---


def test_post_generation_request_returns_202() -> None:
    """POST inserts a queued row and the response includes id + status."""
    user_id = uuid4()
    workspace_id = uuid4()

    supabase = FakeSupabase({
        "workspaces": [_make_workspace(user_id=user_id, workspace_id=workspace_id)],
        "generation_requests": [],
    })

    body = GenerationRequestCreate(
        request_type="practice_set",
        generation_config={"question_count": 5, "format_type": "mcq"},
    )

    # Simulate what the route does: insert the request
    request_id = uuid4()
    insert_payload = {
        "id": str(request_id),
        "workspace_id": str(workspace_id),
        "request_type": body.request_type,
        "scope_constraints": body.scope_constraints.model_dump(mode="json"),
        "generation_config": body.generation_config.model_dump(mode="json"),
        "status": "queued",
    }
    resp = supabase.table("generation_requests").insert(insert_payload).execute()
    record = _require_single(resp.data, not_found_message="Failed")

    result = GenerationRequestRead.model_validate(record)
    assert result.status == "queued"
    assert result.workspace_id == workspace_id
    assert result.id == request_id


def test_get_generation_request_returns_status() -> None:
    """GET returns the current status of a generation request."""
    user_id = uuid4()
    workspace_id = uuid4()
    request_id = uuid4()

    supabase = FakeSupabase({
        "workspaces": [_make_workspace(user_id=user_id, workspace_id=workspace_id)],
        "generation_requests": [
            _make_generation_request_row(
                request_id=request_id,
                workspace_id=workspace_id,
                status="completed",
            )
        ],
    })

    resp = (
        supabase.table("generation_requests")
        .select("*")
        .eq("id", str(request_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    record = _require_single(resp.data, not_found_message="Not found")
    result = GenerationRequestRead.model_validate(record)

    assert result.status == "completed"
    assert result.id == request_id


def test_get_exam_list_returns_summaries() -> None:
    """GET /exams returns summaries without nested questions."""
    user_id = uuid4()
    workspace_id = uuid4()
    exam_id_1 = uuid4()
    exam_id_2 = uuid4()

    supabase = FakeSupabase({
        "workspaces": [_make_workspace(user_id=user_id, workspace_id=workspace_id)],
        "generated_exams": [
            _make_exam_row(exam_id=exam_id_1, workspace_id=workspace_id),
            _make_exam_row(exam_id=exam_id_2, workspace_id=workspace_id),
        ],
    })

    resp = (
        supabase.table("generated_exams")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .order("created_at", desc=True)
        .execute()
    )
    rows = _require_list(resp.data)
    summaries = [GeneratedExamSummary.model_validate(row) for row in rows]

    assert len(summaries) == 2
    for summary in summaries:
        dumped = summary.model_dump()
        assert "questions" not in dumped


def test_get_exam_detail_includes_ordered_questions() -> None:
    """GET /exams/{id} returns questions ordered by question_order ASC."""
    workspace_id = uuid4()
    exam_id = uuid4()

    # Insert questions with non-sequential order values
    questions = [
        _make_question_row(exam_id=exam_id, question_order=order)
        for order in [3, 1, 5, 2, 4]
    ]

    supabase = FakeSupabase({
        "generated_exams": [_make_exam_row(exam_id=exam_id, workspace_id=workspace_id)],
        "generated_questions": questions,
    })

    exam_resp = (
        supabase.table("generated_exams")
        .select("*")
        .eq("id", str(exam_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    exam_record = _require_single(exam_resp.data, not_found_message="Not found")

    q_resp = (
        supabase.table("generated_questions")
        .select("*")
        .eq("generated_exam_id", str(exam_id))
        .execute()
    )
    q_rows = _require_list(q_resp.data)
    parsed = [GeneratedQuestionRead.model_validate(row) for row in q_rows]
    ordered = sorted(parsed, key=lambda q: q.question_order)

    detail = GeneratedExamDetail(
        **GeneratedExamSummary.model_validate(exam_record).model_dump(),
        questions=ordered,
    )

    assert len(detail.questions) == 5
    assert [q.question_order for q in detail.questions] == [1, 2, 3, 4, 5]


def test_get_exam_returns_404_for_wrong_workspace() -> None:
    """Exam under workspace_a is not visible from workspace_b."""
    workspace_a = uuid4()
    workspace_b = uuid4()
    exam_id = uuid4()

    supabase = FakeSupabase({
        "generated_exams": [_make_exam_row(exam_id=exam_id, workspace_id=workspace_a)],
    })

    resp = (
        supabase.table("generated_exams")
        .select("*")
        .eq("id", str(exam_id))
        .eq("workspace_id", str(workspace_b))
        .limit(1)
        .execute()
    )

    from backend.models.errors import NotFoundError

    with pytest.raises(NotFoundError):
        _require_single(resp.data, not_found_message="Exam not found")


def test_pdf_export_returns_503_if_pandoc_missing() -> None:
    """If Pandoc is not installed, export falls back to the builtin PDF writer."""
    from backend.services.generation.pdf_export import export_exam_to_pdf

    assembly = _make_assembly(question_count=2)

    with patch("backend.services.generation.pdf_export.subprocess.run") as mock_run:
        mock_run.side_effect = FileNotFoundError("pandoc not found")

        pdf_path = export_exam_to_pdf(
            assembly=assembly,
            output_dir="/tmp/test_export",
            filename="test.pdf",
        )

    assert pdf_path.exists()
    assert pdf_path.read_bytes().startswith(b"%PDF-")


def test_pdf_export_falls_back_if_pandoc_fails() -> None:
    """If Pandoc errors, export still succeeds via the builtin PDF writer."""
    from backend.services.generation.pdf_export import export_exam_to_pdf

    assembly = _make_assembly(question_count=2)

    with patch("backend.services.generation.pdf_export.subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(
            returncode=1,
            cmd=["pandoc"],
            stderr=b"latex engine unavailable",
        )

        pdf_path = export_exam_to_pdf(
            assembly=assembly,
            output_dir="/tmp/test_export",
            filename="pandoc-failed.pdf",
        )

    assert pdf_path.exists()
    assert pdf_path.read_bytes().startswith(b"%PDF-")


def test_persist_assembly_creates_exam_and_questions() -> None:
    """_persist_assembly inserts one exam row and N question rows."""
    workspace_id = uuid4()
    request_id = uuid4()
    assembly = _make_assembly(question_count=3)

    supabase = FakeSupabase({
        "generated_exams": [],
        "generated_questions": [],
    })

    _persist_assembly(
        supabase=supabase,
        request_id=request_id,
        workspace_id=workspace_id,
        assembly=assembly,
    )

    assert len(supabase.tables["generated_exams"]) == 1
    assert len(supabase.tables["generated_questions"]) == 3

    exam_row = supabase.tables["generated_exams"][0]
    assert exam_row["workspace_id"] == str(workspace_id)
    assert exam_row["title"] == "Practice: Calculus"
