from __future__ import annotations

import logging
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import FileResponse
from supabase import Client

from backend.config.settings import Settings, get_settings
from backend.config.supabase_client import get_admin_client, get_user_client
from backend.middleware.auth import AuthenticatedUser, get_current_user
from backend.middleware.rate_limit import check_rate_limit
from backend.models.errors import NotFoundError
from backend.models.generation import (
    GeneratedExamDetail,
    GeneratedExamSummary,
    GeneratedQuestionRead,
    GenerationRequestCreate,
    GenerationRequestRead,
)
from backend.models.professor_profile import ProfessorProfileBase
from backend.services.generation.models import FinalExamAssembly
from backend.services.generation.pdf_export import export_exam_to_pdf
from backend.services.generation.service import GenerationService, build_generation_service
from backend.services.workspaces.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)

# Auth summary: router-level Depends(get_current_user) enforces Supabase JWT validation.
# Handlers request AuthenticatedUser for cached identity access and authorize workspace ownership before generation resources are read or written.
router = APIRouter(tags=["generation"], dependencies=[Depends(get_current_user)])


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


def _run_generation_job(
    *,
    request_id: UUID,
    workspace_id: UUID,
    body: GenerationRequestCreate,
    settings: Settings,
    supabase: Client,
) -> None:
    try:
        supabase.table("generation_requests").update(
            {"status": "running"}
        ).eq("id", str(request_id)).execute()

        profile_row = (
            supabase.table("professor_profiles")
            .select("*")
            .eq("workspace_id", str(workspace_id))
            .limit(1)
            .execute()
        )
        profile_data = _require_single(
            profile_row.data, not_found_message="Professor profile not found for workspace"
        )
        professor_profile = ProfessorProfileBase.model_validate(profile_data)

        generation_service = build_generation_service(settings=settings)
        logger.info("Generation job %s: starting pipeline (workspace %s)", request_id, workspace_id)
        assembly = generation_service.run_pipeline(
            generation_config=body.generation_config,
            scope_constraints=body.scope_constraints,
            workspace_id=workspace_id,
            professor_profile=professor_profile,
        )
        logger.info("Generation job %s: pipeline complete — %d questions", request_id, len(assembly.questions))

        _persist_assembly(
            supabase=supabase,
            request_id=request_id,
            workspace_id=workspace_id,
            assembly=assembly,
        )

        supabase.table("generation_requests").update(
            {"status": "completed"}
        ).eq("id", str(request_id)).execute()

        logger.info("Generation request %s completed successfully", request_id)

    except Exception as exc:
        logger.error(
            "Generation request %s failed with %s: %s",
            request_id,
            exc.__class__.__name__,
            str(exc),
            exc_info=True,
        )
        supabase.table("generation_requests").update(
            {"status": "failed"}
        ).eq("id", str(request_id)).execute()


def _persist_assembly(
    *,
    supabase: Client,
    request_id: UUID,
    workspace_id: UUID,
    assembly: FinalExamAssembly,
) -> None:
    exam_id = uuid4()
    exam_payload = {
        "id": str(exam_id),
        "generation_request_id": str(request_id),
        "workspace_id": str(workspace_id),
        "title": assembly.title,
        "exam_mode": assembly.exam_mode,
        "format_type": assembly.format_type,
    }
    supabase.table("generated_exams").insert(exam_payload).execute()

    question_payloads = [
        {
            "id": str(uuid4()),
            "generated_exam_id": str(exam_id),
            "question_order": q.question_order,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "difficulty_label": q.difficulty_label,
            "topic_label": q.topic_label,
            "answer_key": q.answer_key,
            "explanation": q.explanation,
            "options": q.options,
        }
        for q in assembly.questions
    ]
    if question_payloads:
        supabase.table("generated_questions").insert(question_payloads).execute()


# --- Routes ---


@router.post(
    "/workspaces/{workspace_id}/generation-requests",
    status_code=202,
    response_model=GenerationRequestRead,
)
async def create_generation_request(
    workspace_id: UUID,
    body: GenerationRequestCreate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> GenerationRequestRead:
    check_rate_limit(user_id=user.id, endpoint="generation", max_calls=5)
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

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
    record = _require_single(resp.data, not_found_message="Failed to create generation request")

    background_tasks.add_task(
        _run_generation_job,
        request_id=request_id,
        workspace_id=workspace_id,
        body=body,
        settings=settings,
        supabase=admin_supabase,
    )

    return GenerationRequestRead.model_validate(record)


@router.get(
    "/workspaces/{workspace_id}/generation-requests/{request_id}",
    response_model=GenerationRequestRead,
)
async def get_generation_request(
    workspace_id: UUID,
    request_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> GenerationRequestRead:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    resp = (
        supabase.table("generation_requests")
        .select("*")
        .eq("id", str(request_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    record = _require_single(resp.data, not_found_message="Generation request not found")
    return GenerationRequestRead.model_validate(record)


@router.get(
    "/workspaces/{workspace_id}/exams",
    response_model=list[GeneratedExamSummary],
)
async def list_exams(
    workspace_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> list[GeneratedExamSummary]:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    resp = (
        supabase.table("generated_exams")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .order("created_at", desc=True)
        .execute()
    )
    rows = _require_list(resp.data)
    return [GeneratedExamSummary.model_validate(row) for row in rows]


@router.get(
    "/workspaces/{workspace_id}/exams/{exam_id}",
    response_model=GeneratedExamDetail,
)
async def get_exam_detail(
    workspace_id: UUID,
    exam_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> GeneratedExamDetail:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    exam_resp = (
        supabase.table("generated_exams")
        .select("*")
        .eq("id", str(exam_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    exam_record = _require_single(exam_resp.data, not_found_message="Exam not found")

    questions_resp = (
        supabase.table("generated_questions")
        .select("*")
        .eq("generated_exam_id", str(exam_id))
        .order("question_order")
        .execute()
    )
    question_rows = _require_list(questions_resp.data)
    questions = [GeneratedQuestionRead.model_validate(row) for row in question_rows]

    return GeneratedExamDetail(
        **GeneratedExamSummary.model_validate(exam_record).model_dump(),
        questions=questions,
    )


@router.get("/workspaces/{workspace_id}/exams/{exam_id}/export")
async def export_exam_pdf(
    workspace_id: UUID,
    exam_id: UUID,
    mode: Literal["questions", "solutions"] = Query(
        default="questions",
        description="'questions' omits answers; 'solutions' includes full worked solutions.",
    ),
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> FileResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    exam_detail = await get_exam_detail(
        workspace_id=workspace_id,
        exam_id=exam_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    assembly = FinalExamAssembly(
        title=exam_detail.title,
        exam_mode=exam_detail.exam_mode,
        format_type=exam_detail.format_type,
        questions=[
            _question_read_to_final(q) for q in exam_detail.questions
        ],
    )

    output_dir = f"{settings.local_storage_root}/exports/{workspace_id}"
    filename = f"{exam_id}.pdf" if mode == "questions" else f"{exam_id}_solutions.pdf"
    pdf_path = export_exam_to_pdf(
        assembly=assembly,
        output_dir=output_dir,
        filename=filename,
        mode=mode,
    )

    if mode == "questions":
        supabase.table("generated_exams").update(
            {"rendered_artifact_path": str(pdf_path)}
        ).eq("id", str(exam_id)).execute()

    download_filename = "exam.pdf" if mode == "questions" else "exam_solutions.pdf"
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=download_filename,
    )


def _question_read_to_final(q: GeneratedQuestionRead) -> Any:
    from backend.services.generation.models import FinalQuestion

    return FinalQuestion(
        question_order=q.question_order,
        question_text=q.question_text,
        question_type=q.question_type,
        difficulty_label=q.difficulty_label or "moderate",
        topic_label=q.topic_label or "general",
        answer_key=q.answer_key or "",
        explanation=q.explanation or "",
        options=q.options,
    )
