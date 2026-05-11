"""Phase 7 Backend Hardening Tests.

Covers:
  1. NotFoundError maps to 404 JSON response
  2. ForbiddenError maps to 403 JSON response
  3. WorkspaceService.get_or_forbidden returns 403 for wrong owner
  4. POST /workspaces with title > 120 chars → ValidationError (422)
  5. GenerationConfig with question_count out of [3, 30] → ValidationError (422)
  6. RegenerationRequestCreate with concept string > 60 chars → ValidationError
  7. Rate limiter raises TooManyRequestsError after max_calls exceeded
  8. TooManyRequestsError message includes retry-after seconds
  9. reset_rate_limit_state clears rate limit counters
  10. Background job failure → status = "failed", exception does not propagate
"""
from __future__ import annotations

import datetime as dt
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from backend.middleware.rate_limit import check_rate_limit, reset_rate_limit_state
from backend.models.errors import (
    ForbiddenError,
    NotFoundError,
    TooManyRequestsError,
)
from backend.models.generation import GenerationConfig, ScopeConstraints
from backend.models.regeneration import RegenerationRequestCreate
from backend.models.workspace import WorkspaceCreateRequest


# ---------------------------------------------------------------------------
# Minimal fake Supabase (reused from existing test patterns)
# ---------------------------------------------------------------------------


class FakeTableQuery:
    def __init__(self, tables: dict[str, list[dict[str, object]]], name: str) -> None:
        self._tables = tables
        self._name = name
        self._op = "select"
        self._payload: object = None
        self._filters: list[tuple[str, object]] = []
        self._limit_val: int | None = None

    def select(self, _: str = "*", **__: object) -> FakeTableQuery:
        self._op = "select"
        return self

    def insert(self, payload: object) -> FakeTableQuery:
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: object) -> FakeTableQuery:
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, field: str, value: object) -> FakeTableQuery:
        self._filters.append((field, value))
        return self

    def limit(self, n: int) -> FakeTableQuery:
        self._limit_val = n
        return self

    def order(self, _: str, **__: object) -> FakeTableQuery:
        return self

    def execute(self) -> SimpleNamespace:
        rows = [
            r.copy()
            for r in self._tables.setdefault(self._name, [])
            if all(r.get(f) == v for f, v in self._filters)
        ]
        if self._limit_val is not None:
            rows = rows[: self._limit_val]

        if self._op == "select":
            return SimpleNamespace(data=rows)

        if self._op == "insert":
            ts = dt.datetime.now(dt.UTC).isoformat()
            payload = dict(self._payload or {})  # type: ignore[arg-type]
            payload.setdefault("created_at", ts)
            self._tables[self._name].append(payload)
            return SimpleNamespace(data=[payload.copy()])

        if self._op == "update":
            # Update in-place so callers observing _tables see the change
            updated: list[dict[str, object]] = []
            for row in self._tables.setdefault(self._name, []):
                if all(row.get(f) == v for f, v in self._filters):
                    row.update(self._payload or {})  # type: ignore[arg-type]
                    updated.append(row.copy())
            return SimpleNamespace(data=updated)

        raise AssertionError(f"Unhandled operation: {self._op}")


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, object]]] | None = None) -> None:
        self._tables: dict[str, list[dict[str, object]]] = tables or {}

    def table(self, name: str) -> FakeTableQuery:
        return FakeTableQuery(self._tables, name)

    @property
    def tables(self) -> dict[str, list[dict[str, object]]]:
        return self._tables


def _workspace_row(*, workspace_id: UUID, user_id: UUID) -> dict[str, object]:
    return {
        "id": str(workspace_id),
        "user_id": str(user_id),
        "title": "Test Workspace",
        "course_code": "CS 101",
        "description": "A test workspace",
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "updated_at": dt.datetime.now(dt.UTC).isoformat(),
    }


# ---------------------------------------------------------------------------
# 1. NotFoundError propagation
# ---------------------------------------------------------------------------


def test_not_found_error_has_correct_status_code() -> None:
    err = NotFoundError("Workspace not found")
    assert err.status_code == 404
    assert err.detail == "Workspace not found"


# ---------------------------------------------------------------------------
# 2. ForbiddenError propagation
# ---------------------------------------------------------------------------


def test_forbidden_error_has_correct_status_code() -> None:
    err = ForbiddenError("Access denied")
    assert err.status_code == 403
    assert err.detail == "Access denied"


# ---------------------------------------------------------------------------
# 3. WorkspaceService.get_or_forbidden distinguishes 404 vs 403
# ---------------------------------------------------------------------------


def test_get_or_forbidden_raises_not_found_when_workspace_missing() -> None:
    from backend.services.workspaces.workspace_service import WorkspaceService

    user_id = uuid4()
    workspace_id = uuid4()
    admin_supabase = FakeSupabase({"workspaces": []})
    user_supabase = FakeSupabase({"workspaces": []})

    service = WorkspaceService(user_supabase)
    with pytest.raises(NotFoundError):
        service.get_or_forbidden(
            user_id=user_id,
            workspace_id=workspace_id,
            admin_supabase=admin_supabase,
        )


def test_get_or_forbidden_raises_forbidden_for_wrong_owner() -> None:
    from backend.services.workspaces.workspace_service import WorkspaceService

    owner_id = uuid4()
    requester_id = uuid4()
    workspace_id = uuid4()

    # Admin client can see the workspace (bypasses RLS)
    admin_supabase = FakeSupabase({
        "workspaces": [_workspace_row(workspace_id=workspace_id, user_id=owner_id)],
    })
    # User-scoped client sees nothing (RLS filters it out)
    user_supabase = FakeSupabase({"workspaces": []})

    service = WorkspaceService(user_supabase)
    with pytest.raises(ForbiddenError):
        service.get_or_forbidden(
            user_id=requester_id,
            workspace_id=workspace_id,
            admin_supabase=admin_supabase,
        )


# ---------------------------------------------------------------------------
# 4. Pydantic validation: WorkspaceCreateRequest field constraints
# ---------------------------------------------------------------------------


def test_workspace_title_too_long_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        WorkspaceCreateRequest(title="A" * 121, course_code="CS 101")

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("title",) for e in errors)


def test_workspace_course_code_too_long_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        WorkspaceCreateRequest(title="My Workspace", course_code="C" * 21)

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("course_code",) for e in errors)


def test_workspace_description_too_long_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        WorkspaceCreateRequest(title="My Workspace", description="D" * 1001)

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("description",) for e in errors)


# ---------------------------------------------------------------------------
# 5. GenerationConfig question_count bounds
# ---------------------------------------------------------------------------


def test_generation_config_question_count_above_max_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        GenerationConfig(question_count=100, format_type="mcq")

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("question_count",) for e in errors)


def test_generation_config_question_count_below_min_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        GenerationConfig(question_count=1, format_type="mcq")

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("question_count",) for e in errors)


def test_generation_config_valid_question_count_accepted() -> None:
    config = GenerationConfig(question_count=10, format_type="mixed")
    assert config.question_count == 10


def test_scope_constraints_custom_prompt_too_long_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        ScopeConstraints(custom_prompt="X" * 501)

    errors = exc_info.value.errors()
    assert any(e["loc"] == ("custom_prompt",) for e in errors)


# ---------------------------------------------------------------------------
# 6. RegenerationRequestCreate per-concept max length
# ---------------------------------------------------------------------------


def test_regeneration_concept_too_long_raises_validation_error() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        RegenerationRequestCreate(target_concepts=["C" * 61])

    errors = exc_info.value.errors()
    assert any("target_concepts" in str(e["loc"]) for e in errors)


def test_regeneration_valid_concepts_accepted() -> None:
    req = RegenerationRequestCreate(
        target_concepts=["hypothesis_testing", "confidence_intervals"],
        question_count=5,
        format_type="frq",
    )
    assert len(req.target_concepts) == 2


# ---------------------------------------------------------------------------
# 7. Rate limiter raises TooManyRequestsError after limit exceeded
# ---------------------------------------------------------------------------


def test_rate_limiter_allows_calls_within_limit() -> None:
    reset_rate_limit_state()
    user_id = uuid4()
    for _ in range(5):
        check_rate_limit(user_id=user_id, endpoint="test_gen", max_calls=5)
    # All 5 calls succeed — no exception raised


def test_rate_limiter_raises_on_exceeding_limit() -> None:
    reset_rate_limit_state()
    user_id = uuid4()
    for _ in range(5):
        check_rate_limit(user_id=user_id, endpoint="test_regen", max_calls=5)

    with pytest.raises(TooManyRequestsError):
        check_rate_limit(user_id=user_id, endpoint="test_regen", max_calls=5)


# ---------------------------------------------------------------------------
# 8. TooManyRequestsError includes retry-after in message
# ---------------------------------------------------------------------------


def test_too_many_requests_error_message_includes_retry() -> None:
    reset_rate_limit_state()
    user_id = uuid4()
    for _ in range(3):
        check_rate_limit(user_id=user_id, endpoint="test_profile", max_calls=3)

    with pytest.raises(TooManyRequestsError) as exc_info:
        check_rate_limit(user_id=user_id, endpoint="test_profile", max_calls=3)

    assert "Try again in" in exc_info.value.detail
    assert exc_info.value.status_code == 429


# ---------------------------------------------------------------------------
# 9. Rate limit state can be reset
# ---------------------------------------------------------------------------


def test_reset_rate_limit_state_clears_counters() -> None:
    reset_rate_limit_state()
    user_id = uuid4()
    for _ in range(5):
        check_rate_limit(user_id=user_id, endpoint="reset_test", max_calls=5)

    reset_rate_limit_state()

    # After reset, the 5 previous calls are forgotten — new calls succeed
    for _ in range(5):
        check_rate_limit(user_id=user_id, endpoint="reset_test", max_calls=5)


# ---------------------------------------------------------------------------
# 10. Background job failure → status = "failed", exception does not propagate
# ---------------------------------------------------------------------------


def test_generation_background_job_updates_failed_status_on_exception() -> None:
    """When the generation pipeline raises, the job row is marked 'failed'."""
    from unittest.mock import patch

    from backend.middleware.auth import AuthenticatedUser
    from backend.models.generation import GenerationConfig, GenerationRequestCreate, ScopeConstraints
    from backend.routes.generation import _run_generation_job
    from backend.config.settings import Settings

    user_id = uuid4()
    workspace_id = uuid4()
    request_id = uuid4()

    supabase = FakeSupabase({
        "workspaces": [_workspace_row(workspace_id=workspace_id, user_id=user_id)],
        "generation_requests": [
            {
                "id": str(request_id),
                "workspace_id": str(workspace_id),
                "status": "queued",
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            }
        ],
        "professor_profiles": [
            {
                "id": str(uuid4()),
                "workspace_id": str(workspace_id),
                "version": 1,
                "topic_distribution": {},
                "question_type_distribution": {},
                "difficulty_profile": {},
                "exam_structure_profile": {},
                "evidence_summary": {},
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
            }
        ],
    })

    body = GenerationRequestCreate(
        request_type="practice_set",
        generation_config=GenerationConfig(question_count=5, format_type="mcq"),
        scope_constraints=ScopeConstraints(),
    )

    settings = Settings()

    # Patch the profile load to raise an unexpected error before the pipeline starts
    with patch(
        "backend.routes.generation.ProfessorProfileBase.model_validate",
        side_effect=RuntimeError("Simulated profile load failure"),
    ):
        # Must not raise — background jobs must swallow exceptions
        _run_generation_job(
            request_id=request_id,
            workspace_id=workspace_id,
            body=body,
            settings=settings,
            supabase=supabase,
        )

    # The generation request row must be marked as "failed"
    request_rows = supabase.tables.get("generation_requests", [])
    assert len(request_rows) == 1
    assert request_rows[0]["status"] == "failed"
