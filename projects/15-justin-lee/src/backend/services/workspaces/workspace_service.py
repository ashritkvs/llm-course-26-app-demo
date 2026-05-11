from __future__ import annotations

from typing import Any
from uuid import UUID

from supabase import Client

from backend.models.errors import BadRequestError, ForbiddenError, NotFoundError
from backend.models.workspace import (
    WorkspaceCreateRequest,
    WorkspaceDetailResponse,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)


def _require_single(data: Any, *, not_found_message: str) -> dict[str, Any]:
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise NotFoundError(not_found_message)


def _require_optional_single(data: Any) -> dict[str, Any] | None:
    if isinstance(data, list):
        if not data:
            return None
        if len(data) == 1 and isinstance(data[0], dict):
            return data[0]
    if isinstance(data, dict):
        return data
    raise BadRequestError("Unexpected response from database")


class WorkspaceService:
    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def create(self, *, user_id: UUID, req: WorkspaceCreateRequest) -> WorkspaceResponse:
        payload = {"user_id": str(user_id), **req.model_dump(exclude_none=True)}
        resp = self._supabase.table("workspaces").insert(payload).execute()
        record = _require_single(resp.data, not_found_message="Workspace not created")
        return WorkspaceResponse.model_validate(record)

    def list(self, *, user_id: UUID) -> list[WorkspaceResponse]:
        resp = (
            self._supabase.table("workspaces")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .execute()
        )
        if not isinstance(resp.data, list):
            raise BadRequestError("Unexpected response from database")
        return [WorkspaceResponse.model_validate(row) for row in resp.data]

    def get_or_forbidden(
        self,
        *,
        user_id: UUID,
        workspace_id: UUID,
        admin_supabase: Client,
    ) -> WorkspaceResponse:
        """Return workspace if user owns it.

        Uses admin client to check existence without RLS interference:
        - 404 if workspace does not exist
        - 403 if workspace exists but belongs to a different user
        - workspace record if user is the owner
        """
        admin_resp = (
            admin_supabase.table("workspaces")
            .select("*")
            .eq("id", str(workspace_id))
            .limit(1)
            .execute()
        )
        admin_record = _require_optional_single(admin_resp.data)
        if admin_record is None:
            raise NotFoundError("Workspace not found")
        if admin_record["user_id"] != str(user_id):
            raise ForbiddenError("You don't have permission to access this workspace.")
        return WorkspaceResponse.model_validate(admin_record)

    def get(self, *, user_id: UUID, workspace_id: UUID) -> WorkspaceResponse:
        resp = (
            self._supabase.table("workspaces")
            .select("*")
            .eq("id", str(workspace_id))
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        record = _require_single(resp.data, not_found_message="Workspace not found")
        return WorkspaceResponse.model_validate(record)

    def get_detail(self, *, user_id: UUID, workspace_id: UUID) -> WorkspaceDetailResponse:
        workspace = self.get(user_id=user_id, workspace_id=workspace_id)
        count_resp = (
            self._supabase.table("documents")
            .select("id", count="exact")
            .eq("workspace_id", str(workspace_id))
            .execute()
        )
        count = int(getattr(count_resp, "count", 0) or 0)
        profile_resp = (
            self._supabase.table("professor_profiles")
            .select("id")
            .eq("workspace_id", str(workspace_id))
            .limit(1)
            .execute()
        )
        profile_status = "built" if _require_single_or_none(profile_resp.data) is not None else "not_built"
        return WorkspaceDetailResponse(
            **workspace.model_dump(), document_count=count, profile_status=profile_status
        )

    def update(
        self, *, user_id: UUID, workspace_id: UUID, req: WorkspaceUpdateRequest
    ) -> WorkspaceResponse:
        payload = req.model_dump(exclude_none=True)
        if not payload:
            raise BadRequestError("No fields to update")
        resp = (
            self._supabase.table("workspaces")
            .update(payload)
            .eq("id", str(workspace_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        record = _require_single(resp.data, not_found_message="Workspace not found")
        return WorkspaceResponse.model_validate(record)

    def delete(self, *, user_id: UUID, workspace_id: UUID) -> None:
        self.get(user_id=user_id, workspace_id=workspace_id)
        # Filter by both id AND user_id on the actual delete — not just in the pre-check.
        # Prevents TOCTOU race where ownership could change between check and delete.
        (
            self._supabase.table("workspaces")
            .delete()
            .eq("id", str(workspace_id))
            .eq("user_id", str(user_id))
            .execute()
        )


def _require_single_or_none(data: Any) -> dict[str, Any] | None:
    if isinstance(data, list):
        if not data:
            return None
        if len(data) == 1 and isinstance(data[0], dict):
            return data[0]
    if isinstance(data, dict):
        return data
    raise BadRequestError("Unexpected response from database")
