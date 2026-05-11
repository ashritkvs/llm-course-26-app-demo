from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from supabase import Client

from backend.config.supabase_client import get_admin_client, get_user_client
from backend.middleware.auth import AuthenticatedUser, get_current_user
from backend.models.workspace import (
    WorkspaceCreateRequest,
    WorkspaceDetailResponse,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from backend.services.workspaces.workspace_service import WorkspaceService

# Auth summary: router-level Depends(get_current_user) enforces Supabase JWT validation.
# Handlers request AuthenticatedUser for cached identity access and scope every DB query by user ID.
router = APIRouter(
    prefix="/workspaces",
    tags=["workspaces"],
    dependencies=[Depends(get_current_user)],
)


def _service(supabase: Client) -> WorkspaceService:
    return WorkspaceService(supabase)


def _authorize_workspace_access(
    *,
    workspace_id: UUID,
    user: AuthenticatedUser,
    supabase: Client,
    admin_supabase: Client,
) -> None:
    _service(supabase).get_or_forbidden(
        user_id=user.id,
        workspace_id=workspace_id,
        admin_supabase=admin_supabase,
    )


@router.post("", status_code=201, response_model=WorkspaceResponse)
async def create_workspace(
    req: WorkspaceCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
) -> WorkspaceResponse:
    return _service(supabase).create(user_id=user.id, req=req)


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
) -> list[WorkspaceResponse]:
    return _service(supabase).list(user_id=user.id)


@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
async def get_workspace(
    workspace_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> WorkspaceDetailResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    return _service(supabase).get_detail(user_id=user.id, workspace_id=workspace_id)


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    req: WorkspaceUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> WorkspaceResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    return _service(supabase).update(user_id=user.id, workspace_id=workspace_id, req=req)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> None:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    _service(supabase).delete(user_id=user.id, workspace_id=workspace_id)
