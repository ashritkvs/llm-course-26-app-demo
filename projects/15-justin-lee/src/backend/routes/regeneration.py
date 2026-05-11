from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends
from supabase import Client

from backend.config.settings import Settings, get_settings
from backend.config.supabase_client import get_admin_client, get_user_client
from backend.middleware.auth import AuthenticatedUser, get_current_user
from backend.middleware.rate_limit import check_rate_limit
from backend.models.errors import NotFoundError
from backend.models.regeneration import RegenerationRequestCreate, RegenerationRequestResponse
from backend.services.analytics.service import build_analytics_service
from backend.services.analytics.snapshot import persist_analytics_snapshot
from backend.services.regeneration.service import run_regeneration_pipeline
from backend.services.workspaces.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)

# Auth summary: router-level Depends(get_current_user) enforces Supabase JWT validation.
# Handlers request AuthenticatedUser for cached identity access and authorize workspace ownership before regeneration resources are read or written.
router = APIRouter(tags=["regeneration"], dependencies=[Depends(get_current_user)])


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


def _ensure_analytics_snapshot(
    admin_supabase: Client,
    workspace_id: str,
    user_id: str,
) -> str:
    """Return the ID of the latest analytics snapshot, creating one if none exists."""
    resp = (
        admin_supabase.table("analytics_snapshots")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]["id"]

    # No snapshot yet — compute and persist a fresh one
    analytics_service = build_analytics_service(admin_supabase)
    result = analytics_service.compute_analytics(workspace_id, user_id)
    return persist_analytics_snapshot(admin_supabase, workspace_id, user_id, result)


@router.post(
    "/workspaces/{workspace_id}/regeneration-requests",
    status_code=202,
    response_model=RegenerationRequestResponse,
)
async def create_regeneration_request(
    workspace_id: UUID,
    body: RegenerationRequestCreate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> RegenerationRequestResponse:
    """Request targeted practice generation biased toward weak concepts.

    Links the new request to the latest analytics snapshot (creating one if absent).
    The generation pipeline runs asynchronously; poll GET to check status.
    """
    check_rate_limit(user_id=user.id, endpoint="regeneration", max_calls=5)
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    snapshot_id = _ensure_analytics_snapshot(
        admin_supabase, str(workspace_id), str(user.id)
    )

    regen_id = uuid4()
    payload = {
        "id": str(regen_id),
        "workspace_id": str(workspace_id),
        "user_id": str(user.id),
        "source_analytics_snapshot_id": snapshot_id,
        "target_concepts": body.target_concepts,
        "request_status": "queued",
    }
    resp = admin_supabase.table("regeneration_requests").insert(payload).execute()
    record = _require_single(resp.data, not_found_message="Failed to create regeneration request")

    background_tasks.add_task(
        run_regeneration_pipeline,
        supabase=admin_supabase,
        settings=settings,
        workspace_id=str(workspace_id),
        regen_request_id=str(regen_id),
        target_concepts=body.target_concepts,
        question_count=body.question_count,
        format_type=body.format_type,
    )

    return RegenerationRequestResponse(
        id=record["id"],
        workspace_id=record["workspace_id"],
        status=record["request_status"],
        target_concepts=record["target_concepts"],
        generated_exam_id=record.get("generated_exam_id"),
        created_at=record["created_at"],
    )


@router.get(
    "/workspaces/{workspace_id}/regeneration-requests/{request_id}",
    response_model=RegenerationRequestResponse,
)
async def get_regeneration_request(
    workspace_id: UUID,
    request_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> RegenerationRequestResponse:
    """Check the status of a regeneration request.

    When status is 'completed', generated_exam_id is populated and the exam
    can be fetched via GET /api/workspaces/{workspace_id}/exams/{generated_exam_id}.
    """
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )

    resp = (
        admin_supabase.table("regeneration_requests")
        .select("*")
        .eq("id", str(request_id))
        .eq("workspace_id", str(workspace_id))
        .limit(1)
        .execute()
    )
    record = _require_single(resp.data, not_found_message="Regeneration request not found")

    return RegenerationRequestResponse(
        id=record["id"],
        workspace_id=record["workspace_id"],
        status=record["request_status"],
        target_concepts=record["target_concepts"],
        generated_exam_id=record.get("generated_exam_id"),
        created_at=record["created_at"],
    )
