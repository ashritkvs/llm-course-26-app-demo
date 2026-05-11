from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from fastapi import UploadFile
from supabase import Client

from backend.models.document import DocumentResponse, SourceType
from backend.models.errors import AppError, BadRequestError, NotFoundError
from backend.services.retrieval.vector_store import VectorStore
from backend.services.storage.file_storage import FileStorage
from backend.services.workspaces.workspace_service import WorkspaceService


def _require_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list) and all(isinstance(item, dict) for item in data):
        return data
    raise BadRequestError("Unexpected response from database")


def _require_single(data: Any, *, not_found_message: str) -> dict[str, Any]:
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise NotFoundError(not_found_message)


class DocumentService:
    def __init__(self, supabase: Client, *, vector_store: VectorStore | None = None) -> None:
        self._supabase = supabase
        self._workspaces = WorkspaceService(supabase)
        self._vector_store = vector_store

    def list(self, *, user_id: UUID, workspace_id: UUID) -> list[DocumentResponse]:
        self._workspaces.get(user_id=user_id, workspace_id=workspace_id)
        resp = (
            self._supabase.table("documents")
            .select("*")
            .eq("workspace_id", str(workspace_id))
            .order("created_at", desc=True)
            .execute()
        )
        return [DocumentResponse.model_validate(row) for row in _require_list(resp.data)]

    def get(self, *, user_id: UUID, workspace_id: UUID, document_id: UUID) -> DocumentResponse:
        self._workspaces.get(user_id=user_id, workspace_id=workspace_id)
        resp = (
            self._supabase.table("documents")
            .select("*")
            .eq("id", str(document_id))
            .eq("workspace_id", str(workspace_id))
            .limit(1)
            .execute()
        )
        record = _require_single(resp.data, not_found_message="Document not found")
        return DocumentResponse.model_validate(record)

    async def create(
        self,
        *,
        user_id: UUID,
        workspace_id: UUID,
        source_type: SourceType,
        upload_label: str | None,
        upload: UploadFile,
        storage: FileStorage,
    ) -> DocumentResponse:
        self._workspaces.get(user_id=user_id, workspace_id=workspace_id)
        document_id = uuid4()
        # STUB: reads entire file into memory. Replace with streaming in Phase 7 for large file support.
        content = await upload.read()
        file_path = storage.save_bytes(
            workspace_id=workspace_id,
            document_id=document_id,
            filename=upload.filename or "upload.bin",
            content=content,
            content_type=upload.content_type,
        )

        try:
            payload = {
                "id": str(document_id),
                "workspace_id": str(workspace_id),
                "source_type": source_type,
                "file_name": upload.filename or "upload.bin",
                "upload_label": upload_label,
                "file_path": file_path,
                "processing_status": "uploaded",
            }
            resp = self._supabase.table("documents").insert(payload).execute()
            record = _require_single(resp.data, not_found_message="Document not created")
            return DocumentResponse.model_validate(record)
        except (BadRequestError, NotFoundError):
            storage.delete(file_path=file_path)
            raise
        except Exception as exc:
            # Unexpected DB/storage error — clean up the file and surface as 500.
            storage.delete(file_path=file_path)
            raise AppError("Unexpected error creating document record") from exc

    def delete(
        self, *, user_id: UUID, workspace_id: UUID, document_id: UUID, storage: FileStorage
    ) -> None:
        doc = self.get(user_id=user_id, workspace_id=workspace_id, document_id=document_id)
        if self._vector_store is not None:
            self._vector_store.delete_document(document_id=document_id)
        self._supabase.table("documents").delete().eq("id", str(document_id)).execute()
        storage.delete(file_path=doc.file_path)
