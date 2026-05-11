from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from supabase import Client

from backend.config.settings import Settings, get_settings
from backend.config.supabase_client import get_admin_client, get_user_client
from backend.middleware.auth import AuthenticatedUser, get_current_user
from backend.middleware.rate_limit import check_rate_limit
from backend.models.professor_profile import ProfessorProfileResponse
from backend.services.professor_profile.profile_service import (
    ProfessorProfileService,
    build_professor_profile_service,
)
from backend.services.workspaces.workspace_service import WorkspaceService

# Auth summary: router-level Depends(get_current_user) enforces Supabase JWT validation.
# Handlers request AuthenticatedUser for cached identity access and authorize workspace ownership before profile access.
router = APIRouter(
    prefix="/workspaces/{workspace_id}/profile",
    tags=["professor-profile"],
    dependencies=[Depends(get_current_user)],
)


def _service(settings: Settings, supabase: Client) -> ProfessorProfileService:
    return build_professor_profile_service(settings=settings, supabase=supabase)


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


@router.post("/generate", response_model=ProfessorProfileResponse)
async def generate_professor_profile(
    workspace_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> ProfessorProfileResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    check_rate_limit(user_id=user.id, endpoint="profile_generate", max_calls=3)
    return _service(settings, supabase).generate(user_id=user.id, workspace_id=workspace_id)


@router.get("", response_model=ProfessorProfileResponse)
async def get_professor_profile(
    workspace_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> ProfessorProfileResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    return ProfessorProfileService(supabase).get_latest(user_id=user.id, workspace_id=workspace_id)
