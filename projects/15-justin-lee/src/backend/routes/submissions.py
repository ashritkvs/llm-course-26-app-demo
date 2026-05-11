from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends
from supabase import Client

from backend.config.settings import Settings, get_settings
from backend.config.supabase_client import get_admin_client, get_user_client
from backend.middleware.auth import AuthenticatedUser, get_current_user
from backend.models.errors import NotFoundError
from backend.models.submission import (
    ErrorClassificationRead,
    GradingResultRead,
    SubmissionAnswerRead,
    SubmissionCreate,
    SubmissionCreatedResponse,
    SubmissionRead,
)
from backend.services.grading.grader import GradingService
from backend.services.grading.service import build_grading_service_from_supabase
from backend.services.workspaces.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)

# Auth summary: router-level Depends(get_current_user) enforces Supabase JWT validation.
# Handlers request AuthenticatedUser for cached identity access and authorize workspace ownership before submission resources are read or written.
router = APIRouter(tags=["submissions"], dependencies=[Depends(get_current_user)])


# --- Helpers ---


def _workspace_service(supabase: Client) -> WorkspaceService:
    return WorkspaceService(supabase)


def _authorize_workspace_access(
    *,
    workspace_id: UUID,
    user: AuthenticatedUser,
    supabase: Client,
    admin_supabase: Client,
) -> None:
    _workspace_service(supabase).get_or_forbidden(
        user_id=user.id,
        workspace_id=workspace_id,
        admin_supabase=admin_supabase,
    )


def _require_single(data: Any, *, not_found_message: str) -> dict[str, Any]:
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise NotFoundError(not_found_message)


def _require_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return data
    return []


# --- Background job ---


def _run_grading_job(
    *,
    submission_id: UUID,
    supabase: Client,
    settings: Settings | None = None,
    _grading_service: GradingService | None = None,
) -> None:
    """Run the grading pipeline for a submitted exam.

    ``_grading_service`` may be injected by tests to avoid real Gemini calls.
    When omitted, a real service is built from ``supabase`` and ``settings``.
    """
    try:
        supabase.table("submissions").update(
            {"status": "grading"}
        ).eq("id", str(submission_id)).execute()

        if _grading_service is not None:
            grading_service: GradingService = _grading_service
        else:
            if settings is None:
                raise ValueError("settings is required when _grading_service is not provided")
            grading_service = build_grading_service_from_supabase(
                supabase=supabase,
                settings=settings,
            )
        result = grading_service.grade_submission(str(submission_id))

        # Persist grading results to DB
        for ga in result.graded_answers:
            gr_id = uuid4()
            grading_payload = {
                "id": str(gr_id),
                "submission_answer_id": str(ga.submission_answer_id),
                "correctness_label": ga.correctness_label,
                "score_value": ga.points_awarded,
                "points_possible": ga.points_possible,
                "diagnostic_explanation": ga.feedback,
                "concept_label": ga.concept_label,
            }
            supabase.table("grading_results").insert(grading_payload).execute()

            for ec in ga.error_classifications:
                supabase.table("error_classifications").insert({
                    "grading_result_id": str(gr_id),
                    "error_type": ec.error_type,
                    "description": ec.description,
                    "severity": "moderate",
                }).execute()

        supabase.table("submissions").update({
            "status": "graded",
            "overall_score": result.total_score,
            "total_possible": result.max_score,
        }).eq("id", str(submission_id)).execute()

        logger.info("Submission %s graded successfully", submission_id)

    except Exception as exc:
        logger.error(
            "Grading failed for submission %s with %s",
            submission_id,
            exc.__class__.__name__,
        )
        supabase.table("submissions").update(
            {"status": "failed"}
        ).eq("id", str(submission_id)).execute()


# --- Routes ---


@router.post(
    "/workspaces/{workspace_id}/exams/{exam_id}/submissions",
    status_code=201,
    response_model=SubmissionCreatedResponse,
)
async def create_submission(
    workspace_id: UUID,
    exam_id: UUID,
    body: SubmissionCreate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> SubmissionCreatedResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    # Verify the exam exists in this workspace
    exam_resp = (
        supabase.table("generated_exams")
        .select("id")
        .eq("id", str(exam_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    _require_single(exam_resp.data, not_found_message="Exam not found")

    submission_id = uuid4()
    submission_payload = {
        "id": str(submission_id),
        "workspace_id": str(workspace_id),
        "user_id": str(user.id),
        "generated_exam_id": str(exam_id),
        "status": "submitted",
    }
    sub_resp = supabase.table("submissions").insert(submission_payload).execute()
    submission_record = _require_single(
        sub_resp.data, not_found_message="Failed to create submission"
    )

    answer_payloads = [
        {
            "id": str(uuid4()),
            "submission_id": str(submission_id),
            "generated_question_id": str(a.question_id),
            "answer_content": a.answer_content,
        }
        for a in body.answers
    ]
    supabase.table("submission_answers").insert(answer_payloads).execute()

    background_tasks.add_task(
        _run_grading_job,
        submission_id=submission_id,
        supabase=admin_supabase,
        settings=settings,
    )

    return SubmissionCreatedResponse.model_validate(submission_record)


@router.get(
    "/workspaces/{workspace_id}/submissions/{submission_id}",
    response_model=SubmissionRead,
)
async def get_submission(
    workspace_id: UUID,
    submission_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> SubmissionRead:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    # Fetch submission
    sub_resp = (
        supabase.table("submissions")
        .select("*")
        .eq("id", str(submission_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    sub_record = _require_single(sub_resp.data, not_found_message="Submission not found")

    # Fetch answers
    answers_resp = (
        supabase.table("submission_answers")
        .select("*")
        .eq("submission_id", str(submission_id))
        .execute()
    )
    answer_rows = _require_list(answers_resp.data)

    # Build answer list, joining grading results if graded
    answers: list[SubmissionAnswerRead] = []
    if sub_record.get("status") == "graded":
        # Fetch all grading results for this submission's answers
        answer_ids = [row["id"] for row in answer_rows]
        gr_rows: list[dict[str, Any]] = []
        if answer_ids:
            gr_resp = (
                supabase.table("grading_results")
                .select("*")
                .in_("submission_answer_id", answer_ids)
                .execute()
            )
            gr_rows = _require_list(gr_resp.data)
        gr_by_answer: dict[str, dict[str, Any]] = {
            row["submission_answer_id"]: row for row in gr_rows
        }

        # Fetch all error classifications for these grading results
        gr_ids = [row["id"] for row in gr_rows]
        ec_by_gr: dict[str, list[dict[str, Any]]] = {}
        if gr_ids:
            ec_resp = (
                supabase.table("error_classifications")
                .select("*")
                .in_("grading_result_id", gr_ids)
                .execute()
            )
            for ec_row in _require_list(ec_resp.data):
                ec_by_gr.setdefault(ec_row["grading_result_id"], []).append(ec_row)

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
    else:
        for a_row in answer_rows:
            answers.append(SubmissionAnswerRead(
                id=a_row["id"],
                question_id=a_row["generated_question_id"],
                answer_content=a_row["answer_content"],
            ))

    return SubmissionRead(
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
