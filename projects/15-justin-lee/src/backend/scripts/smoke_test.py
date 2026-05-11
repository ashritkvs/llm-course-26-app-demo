"""
Standalone end-to-end smoke test for ExamProfile AI.

Usage examples:

    python backend/scripts/smoke_test.py \
      --base-url http://localhost:8000 \
      --test-email smoke@example.com \
      --test-password 'password123'

    BASE_URL=https://your-backend.onrender.com \
    TEST_EMAIL=smoke@example.com \
    TEST_PASSWORD='password123' \
    SUPABASE_URL=https://your-project.supabase.co \
    SUPABASE_ANON_KEY=your-anon-key \
    python backend/scripts/smoke_test.py

    python backend/scripts/smoke_test.py --base-url http://localhost:8000 --token <jwt>

Notes:
- If `--token` or `TEST_TOKEN` is supplied, the script skips Supabase sign-in.
- If no token is supplied, the script signs in through Supabase using
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_EMAIL`, and `TEST_PASSWORD`.
- The script auto-uploads a small plain-text seed document unless `--sample-file`
  is provided. That keeps the generation path runnable on a clean workspace.
- Exit code is `0` only if all 17 tracked steps pass.
"""

from __future__ import annotations

import argparse
import os
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import httpx
from supabase import create_client

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_POLL_TIMEOUT_SECONDS = 90
DEFAULT_REQUEST_TIMEOUT_SECONDS = 30

SEED_DOCUMENT_CONTENT = """Calculus I review notes

Topic: derivatives
- Power rule
- Product rule
- Chain rule

Topic: optimization
- Use the derivative to locate critical points
- Check endpoints and domain constraints

Topic: integrals
- Basic antiderivatives
- u-substitution

Practice prompts:
1. Differentiate composite functions.
2. Solve an optimization word problem.
3. Evaluate a definite integral and explain the setup.
"""


@dataclass
class SmokeContext:
    base_url: str
    token: str | None
    test_email: str | None
    test_password: str | None
    supabase_url: str | None
    supabase_anon_key: str | None
    sample_file: Path | None
    create_user_if_missing: bool
    request_timeout_seconds: int
    poll_timeout_seconds: int
    workspace_id: str | None = None
    seed_document_id: str | None = None
    generation_request_id: str | None = None
    exam_id: str | None = None
    submission_id: str | None = None
    deleted_workspace: bool = False
    exam_detail: dict[str, Any] | None = None
    temp_sample_path: Path | None = None
    results: list[bool] = field(default_factory=list)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the ExamProfile AI smoke test.")
    parser.add_argument("--base-url", default=os.getenv("BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--test-email", default=os.getenv("TEST_EMAIL"))
    parser.add_argument("--test-password", default=os.getenv("TEST_PASSWORD"))
    parser.add_argument("--token", default=os.getenv("TEST_TOKEN"))
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL"))
    parser.add_argument("--supabase-anon-key", default=os.getenv("SUPABASE_ANON_KEY"))
    parser.add_argument("--sample-file", default=os.getenv("SAMPLE_FILE"))
    parser.add_argument(
        "--create-user-if-missing",
        action="store_true",
        default=os.getenv("SMOKE_TEST_CREATE_USER_IF_MISSING") == "1",
    )
    parser.add_argument(
        "--request-timeout-seconds",
        type=int,
        default=int(os.getenv("SMOKE_TEST_REQUEST_TIMEOUT_SECONDS", DEFAULT_REQUEST_TIMEOUT_SECONDS)),
    )
    parser.add_argument(
        "--poll-timeout-seconds",
        type=int,
        default=int(os.getenv("SMOKE_TEST_POLL_TIMEOUT_SECONDS", DEFAULT_POLL_TIMEOUT_SECONDS)),
    )
    return parser.parse_args()


def build_context(args: argparse.Namespace) -> SmokeContext:
    sample_file = Path(args.sample_file).expanduser().resolve() if args.sample_file else None
    return SmokeContext(
        base_url=args.base_url.rstrip("/"),
        token=args.token,
        test_email=args.test_email,
        test_password=args.test_password,
        supabase_url=args.supabase_url,
        supabase_anon_key=args.supabase_anon_key,
        sample_file=sample_file,
        create_user_if_missing=args.create_user_if_missing,
        request_timeout_seconds=args.request_timeout_seconds,
        poll_timeout_seconds=args.poll_timeout_seconds,
    )


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def require_workspace_id(context: SmokeContext) -> str:
    expect(context.workspace_id is not None, "Workspace ID is not available")
    return context.workspace_id


def require_exam_id(context: SmokeContext) -> str:
    expect(context.exam_id is not None, "Exam ID is not available")
    return context.exam_id


def require_submission_id(context: SmokeContext) -> str:
    expect(context.submission_id is not None, "Submission ID is not available")
    return context.submission_id


def ensure_success(response: httpx.Response, *, expected_status: int, label: str) -> dict[str, Any]:
    if response.status_code != expected_status:
        snippet = response.text.strip()
        if len(snippet) > 200:
            snippet = f"{snippet[:200]}..."
        raise RuntimeError(f"{label} returned {response.status_code}: {snippet}")

    if not response.content:
        return {}

    payload = response.json()
    expect(isinstance(payload, dict), f"{label} returned a non-object payload")
    return payload


def get_token(context: SmokeContext) -> tuple[str, str]:
    if context.token:
        return context.token, "provided token"

    expect(context.supabase_url is not None, "SUPABASE_URL is required when --token is not used")
    expect(
        context.supabase_anon_key is not None,
        "SUPABASE_ANON_KEY is required when --token is not used",
    )
    expect(context.test_email is not None, "TEST_EMAIL is required when --token is not used")
    expect(
        context.test_password is not None,
        "TEST_PASSWORD is required when --token is not used",
    )

    supabase = create_client(context.supabase_url, context.supabase_anon_key)
    credentials = {"email": context.test_email, "password": context.test_password}

    try:
        auth_response = supabase.auth.sign_in_with_password(credentials)
    except Exception as exc:
        if not context.create_user_if_missing:
            raise RuntimeError(f"Supabase sign-in failed: {exc}") from exc
        supabase.auth.sign_up(credentials)
        auth_response = supabase.auth.sign_in_with_password(credentials)

    session = getattr(auth_response, "session", None)
    access_token = getattr(session, "access_token", None)
    expect(isinstance(access_token, str) and access_token.strip(), "Supabase sign-in did not return a JWT")
    return access_token, "Supabase password sign-in"


def create_seed_file(context: SmokeContext) -> Path:
    if context.sample_file is not None:
        expect(context.sample_file.exists(), f"Sample file not found: {context.sample_file}")
        return context.sample_file

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as handle:
        handle.write(SEED_DOCUMENT_CONTENT)
        temp_path = Path(handle.name)

    context.temp_sample_path = temp_path
    return temp_path


def wait_for_document_ready(client: httpx.Client, context: SmokeContext, document_id: str) -> None:
    workspace_id = require_workspace_id(context)
    deadline = time.monotonic() + context.poll_timeout_seconds

    while time.monotonic() < deadline:
        response = client.get(
            f"/api/workspaces/{workspace_id}/documents",
            timeout=context.request_timeout_seconds,
        )
        expect(response.status_code == 200, f"Document poll failed with {response.status_code}")
        documents = response.json()
        expect(isinstance(documents, list), "Document poll returned a non-list payload")

        for document in documents:
            if document.get("id") != document_id:
                continue

            status = document.get("processing_status")
            if status in {"indexed", "ready"}:
                return
            if status == "failed":
                raise RuntimeError("Seed document processing failed")

        time.sleep(2)

    raise RuntimeError("Timed out waiting for the seed document to finish indexing")


def ensure_seed_document(client: httpx.Client, context: SmokeContext) -> str:
    if context.seed_document_id is not None:
        return context.seed_document_id

    workspace_id = require_workspace_id(context)
    sample_path = create_seed_file(context)

    with sample_path.open("rb") as file_handle:
        response = client.post(
            f"/api/workspaces/{workspace_id}/documents",
            data={"source_type": "notes", "upload_label": "Smoke Test Seed"},
            files={"file": (sample_path.name, file_handle, "text/plain")},
            timeout=context.request_timeout_seconds,
        )

    payload = ensure_success(response, expected_status=201, label="Seed document upload")
    document_id = str(payload["id"])
    context.seed_document_id = document_id
    print(f"SETUP: uploaded seed document {document_id}")
    wait_for_document_ready(client, context, document_id)
    print("SETUP: seed document indexed")
    return document_id


def poll_until_status(
    client: httpx.Client,
    context: SmokeContext,
    *,
    url: str,
    success_status: str,
    failure_status: str,
    label: str,
) -> dict[str, Any]:
    deadline = time.monotonic() + context.poll_timeout_seconds

    while time.monotonic() < deadline:
        response = client.get(url, timeout=context.request_timeout_seconds)
        payload = ensure_success(response, expected_status=200, label=label)
        status = payload.get("status")

        if status == success_status:
            return payload
        if status == failure_status:
            raise RuntimeError(f"{label} reached terminal failure status '{failure_status}'")

        time.sleep(3)

    raise RuntimeError(f"{label} timed out waiting for status '{success_status}'")


def build_submission_answers(exam_detail: dict[str, Any]) -> list[dict[str, str]]:
    questions = exam_detail.get("questions")
    expect(isinstance(questions, list) and questions, "Exam detail did not include any questions")

    answers: list[dict[str, str]] = []
    for question in questions:
        question_id = question.get("id")
        answer_key = question.get("answer_key")
        options = question.get("options") or []
        answer_text = answer_key or (options[0] if options else "Smoke test answer")

        expect(isinstance(question_id, str) and question_id, "Question ID is missing")
        expect(isinstance(answer_text, str) and answer_text.strip(), "Answer content is missing")
        answers.append({"question_id": question_id, "answer_content": answer_text.strip()})

    return answers


def run_step(number: int, description: str, fn: Callable[[], str | None]) -> bool:
    try:
        detail = fn()
        suffix = f" - {detail}" if detail else ""
        print(f"PASS {number}/17 {description}{suffix}")
        return True
    except Exception as exc:
        print(f"FAIL {number}/17 {description} - {exc}")
        return False


def cleanup_temp_file(context: SmokeContext) -> None:
    if context.temp_sample_path is not None and context.temp_sample_path.exists():
        context.temp_sample_path.unlink(missing_ok=True)


def main() -> int:
    args = parse_args()
    context = build_context(args)
    unauth_client = httpx.Client(base_url=context.base_url, follow_redirects=True)
    auth_client: httpx.Client | None = None

    try:
        context.results.append(
            run_step(
                1,
                "GET /api/health",
                lambda: _step_health(unauth_client, context),
            )
        )

        context.results.append(run_step(2, "Obtain JWT token", lambda: _step_auth(context)))

        if context.token:
            auth_client = httpx.Client(
                base_url=context.base_url,
                headers={"Authorization": f"Bearer {context.token}"},
                follow_redirects=True,
            )

        context.results.append(run_step(3, "POST /api/workspaces", lambda: _step_create_workspace(auth_client, context)))
        context.results.append(run_step(4, "GET /api/workspaces", lambda: _step_list_workspaces(auth_client, context)))
        context.results.append(run_step(5, "GET /api/workspaces/{workspace_id}", lambda: _step_get_workspace(auth_client, context)))
        context.results.append(run_step(6, "GET /api/workspaces/{workspace_id}/analytics", lambda: _step_empty_analytics(auth_client, context)))
        context.results.append(run_step(7, "POST /api/workspaces/{workspace_id}/profile/generate", lambda: _step_generate_profile(auth_client, context)))
        context.results.append(run_step(8, "POST /api/workspaces/{workspace_id}/generation-requests", lambda: _step_create_generation_request(auth_client, context)))
        context.results.append(run_step(9, "Poll generation request until completed", lambda: _step_poll_generation(auth_client, context)))
        context.results.append(run_step(10, "GET /api/workspaces/{workspace_id}/exams", lambda: _step_list_exams(auth_client, context)))
        context.results.append(run_step(11, "GET /api/workspaces/{workspace_id}/exams/{exam_id}", lambda: _step_get_exam(auth_client, context)))
        context.results.append(run_step(12, "POST /api/workspaces/{workspace_id}/exams/{exam_id}/submissions", lambda: _step_create_submission(auth_client, context)))
        context.results.append(run_step(13, "Poll submission until graded", lambda: _step_poll_submission(auth_client, context)))
        context.results.append(run_step(14, "Verify grading results payload", lambda: _step_verify_grading(auth_client, context)))
        context.results.append(run_step(15, "GET /api/workspaces/{workspace_id}/analytics after grading", lambda: _step_non_empty_analytics(auth_client, context)))
        context.results.append(run_step(16, "DELETE /api/workspaces/{workspace_id}", lambda: _step_delete_workspace(auth_client, context)))
        context.results.append(run_step(17, "GET deleted workspace returns 404", lambda: _step_verify_workspace_deleted(auth_client, context)))
    finally:
        if auth_client is not None:
            auth_client.close()
        unauth_client.close()
        cleanup_temp_file(context)

    passed = sum(1 for result in context.results if result)
    print(f"Summary: {passed}/17 steps passed")
    return 0 if passed == 17 else 1


def _step_health(client: httpx.Client, context: SmokeContext) -> str:
    response = client.get("/api/health", timeout=context.request_timeout_seconds)
    payload = ensure_success(response, expected_status=200, label="Health check")
    expect(payload.get("status") == "ok", "Health endpoint did not return status=ok")
    return "status=ok"


def _step_auth(context: SmokeContext) -> str:
    token, method = get_token(context)
    context.token = token
    return method


def _step_create_workspace(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    payload = {
        "title": "Smoke Test Workspace",
        "course_code": "SMOKE-101",
        "description": "Temporary workspace created by backend/scripts/smoke_test.py",
    }
    response = client.post("/api/workspaces", json=payload, timeout=context.request_timeout_seconds)
    data = ensure_success(response, expected_status=201, label="Create workspace")
    context.workspace_id = str(data["id"])
    return context.workspace_id


def _step_list_workspaces(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    response = client.get("/api/workspaces", timeout=context.request_timeout_seconds)
    expect(response.status_code == 200, f"List workspaces returned {response.status_code}")
    payload = response.json()
    expect(isinstance(payload, list), "List workspaces returned a non-list payload")
    expect(any(item.get("id") == workspace_id for item in payload), "Created workspace was not listed")
    return "workspace listed"


def _step_get_workspace(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    response = client.get(
        f"/api/workspaces/{workspace_id}",
        timeout=context.request_timeout_seconds,
    )
    payload = ensure_success(response, expected_status=200, label="Get workspace")
    expect(str(payload.get("id")) == workspace_id, "Workspace detail ID did not match")
    return "workspace detail loaded"


def _step_empty_analytics(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    response = client.get(
        f"/api/workspaces/{workspace_id}/analytics",
        timeout=context.request_timeout_seconds,
    )
    payload = ensure_success(response, expected_status=200, label="Initial analytics")
    concept_mastery = payload.get("concept_mastery", {})
    expect(isinstance(concept_mastery, dict) and not concept_mastery, "Initial analytics were not empty")
    return "empty analytics confirmed"


def _step_generate_profile(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    ensure_seed_document(client, context)
    workspace_id = require_workspace_id(context)
    response = client.post(
        f"/api/workspaces/{workspace_id}/profile/generate",
        timeout=context.request_timeout_seconds,
    )
    payload = ensure_success(response, expected_status=200, label="Generate professor profile")
    expect(str(payload.get("workspace_id")) == workspace_id, "Profile response workspace_id mismatch")
    return f"profile version {payload.get('version')}"


def _step_create_generation_request(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    payload = {
        "request_type": "practice_set",
        "scope_constraints": {"topics": [], "document_ids": []},
        "generation_config": {
            "question_count": 3,
            "format_type": "mcq",
            "difficulty": "moderate",
            "question_types": ["mcq"],
        },
    }
    response = client.post(
        f"/api/workspaces/{workspace_id}/generation-requests",
        json=payload,
        timeout=context.request_timeout_seconds,
    )
    data = ensure_success(response, expected_status=202, label="Create generation request")
    context.generation_request_id = str(data["id"])
    return context.generation_request_id


def _step_poll_generation(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    request_id = context.generation_request_id
    expect(request_id is not None, "Generation request ID is not available")
    payload = poll_until_status(
        client,
        context,
        url=f"/api/workspaces/{workspace_id}/generation-requests/{request_id}",
        success_status="completed",
        failure_status="failed",
        label="Generation request",
    )
    return f"status={payload.get('status')}"


def _step_list_exams(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    response = client.get(
        f"/api/workspaces/{workspace_id}/exams",
        timeout=context.request_timeout_seconds,
    )
    expect(response.status_code == 200, f"List exams returned {response.status_code}")
    payload = response.json()
    expect(isinstance(payload, list) and payload, "No generated exams were returned")
    context.exam_id = str(payload[0]["id"])
    return f"exam_id={context.exam_id}"


def _step_get_exam(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    exam_id = require_exam_id(context)
    response = client.get(
        f"/api/workspaces/{workspace_id}/exams/{exam_id}",
        timeout=context.request_timeout_seconds,
    )
    payload = ensure_success(response, expected_status=200, label="Get exam detail")
    questions = payload.get("questions")
    expect(isinstance(questions, list) and questions, "Exam detail did not include questions")
    context.exam_detail = payload
    return f"{len(questions)} questions"


def _step_create_submission(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    exam_id = require_exam_id(context)
    expect(context.exam_detail is not None, "Exam detail payload is not available")
    payload = {"answers": build_submission_answers(context.exam_detail)}
    response = client.post(
        f"/api/workspaces/{workspace_id}/exams/{exam_id}/submissions",
        json=payload,
        timeout=context.request_timeout_seconds,
    )
    data = ensure_success(response, expected_status=201, label="Create submission")
    context.submission_id = str(data["id"])
    return context.submission_id


def _step_poll_submission(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    submission_id = require_submission_id(context)
    payload = poll_until_status(
        client,
        context,
        url=f"/api/workspaces/{workspace_id}/submissions/{submission_id}",
        success_status="graded",
        failure_status="failed",
        label="Submission grading",
    )
    expect(payload.get("answers"), "Graded submission did not include answers")
    return f"status={payload.get('status')}"


def _step_verify_grading(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    submission_id = require_submission_id(context)
    response = client.get(
        f"/api/workspaces/{workspace_id}/submissions/{submission_id}",
        timeout=context.request_timeout_seconds,
    )
    payload = ensure_success(response, expected_status=200, label="Get graded submission")
    answers = payload.get("answers")
    expect(isinstance(answers, list) and answers, "Submission answers were missing")
    graded_answers = [answer for answer in answers if answer.get("grading_result")]
    expect(graded_answers, "Submission did not contain grading results")
    first_result = graded_answers[0]["grading_result"]
    expect(first_result.get("correctness_label"), "Missing correctness_label")
    expect(first_result.get("score_value") is not None, "Missing score_value")
    expect(first_result.get("diagnostic_explanation"), "Missing diagnostic_explanation")
    return f"{len(graded_answers)} graded answers"


def _step_non_empty_analytics(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    response = client.get(
        f"/api/workspaces/{workspace_id}/analytics",
        timeout=context.request_timeout_seconds,
    )
    payload = ensure_success(response, expected_status=200, label="Post-grading analytics")
    concept_mastery = payload.get("concept_mastery", {})
    expect(isinstance(concept_mastery, dict) and concept_mastery, "Analytics remained empty after grading")
    return f"{len(concept_mastery)} concepts"


def _step_delete_workspace(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    response = client.delete(
        f"/api/workspaces/{workspace_id}",
        timeout=context.request_timeout_seconds,
    )
    expect(response.status_code == 204, f"Delete workspace returned {response.status_code}")
    context.deleted_workspace = True
    return "workspace deleted"


def _step_verify_workspace_deleted(client: httpx.Client | None, context: SmokeContext) -> str:
    expect(client is not None, "Authenticated HTTP client is not available")
    workspace_id = require_workspace_id(context)
    expect(context.deleted_workspace, "Workspace delete step did not complete")
    response = client.get(
        f"/api/workspaces/{workspace_id}",
        timeout=context.request_timeout_seconds,
    )
    expect(response.status_code == 404, f"Deleted workspace returned {response.status_code} instead of 404")
    return "404 confirmed"


if __name__ == "__main__":
    raise SystemExit(main())
