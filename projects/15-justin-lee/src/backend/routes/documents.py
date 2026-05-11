from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from supabase import Client

from backend.config.settings import Settings, get_settings
from backend.config.supabase_client import get_admin_client, get_user_client
from backend.middleware.auth import AuthenticatedUser, get_current_user
from backend.models.document import DocumentResponse, SourceType
from backend.models.errors import PayloadTooLargeError, UnsupportedMediaTypeError
from backend.services.document_processing.embedding_service import build_embedding_service
from backend.services.document_processing.parser_service import DocumentProcessingService
from backend.services.documents.document_service import DocumentService
from backend.services.retrieval.vector_store import ChromaVectorStore
from backend.services.storage.file_storage import FileStorage, build_file_storage
from backend.services.workspaces.workspace_service import WorkspaceService

_ALLOWED_UPLOAD_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024

# Auth summary: router-level Depends(get_current_user) enforces Supabase JWT validation.
# Handlers request AuthenticatedUser for cached identity access and authorize workspace ownership before nested document access.
router = APIRouter(
    prefix="/workspaces/{workspace_id}/documents",
    tags=["documents"],
    dependencies=[Depends(get_current_user)],
)


def _storage(settings: Settings, supabase: Client) -> FileStorage:
    return build_file_storage(
        backend=settings.storage_backend,
        local_root=settings.local_storage_root,
        bucket=settings.supabase_storage_bucket,
        supabase=supabase,
    )


def _service(supabase: Client) -> DocumentService:
    return DocumentService(supabase)


def _workspace_service(supabase: Client) -> WorkspaceService:
    return WorkspaceService(supabase)


def _vector_store(settings: Settings) -> ChromaVectorStore:
    return ChromaVectorStore(
        persist_directory=settings.chroma_persist_directory,
        collection_name=settings.chroma_collection_name,
    )


def _processing_service(settings: Settings, supabase: Client) -> DocumentProcessingService:
    return DocumentProcessingService(
        supabase,
        _storage(settings, supabase),
        embedding_service=build_embedding_service(settings),
        vector_store=_vector_store(settings),
    )


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


async def _validate_upload_security(upload: UploadFile) -> None:
    content_type = (upload.content_type or "").split(";", maxsplit=1)[0].strip().lower()
    if content_type not in _ALLOWED_UPLOAD_MIME_TYPES:
        raise UnsupportedMediaTypeError(
            "Unsupported file type. Allowed types: PDF, TXT, Markdown, DOCX."
        )

    total_size = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > _MAX_UPLOAD_SIZE_BYTES:
            await upload.seek(0)
            raise PayloadTooLargeError("File size exceeds the 25MB upload limit.")

    await upload.seek(0)


@router.post("", status_code=201, response_model=DocumentResponse)
async def upload_document(
    workspace_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_type: SourceType = Form(...),
    upload_label: str | None = Form(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> DocumentResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    await _validate_upload_security(file)
    storage = _storage(settings, supabase)
    document = await _service(supabase).create(
        user_id=user.id,
        workspace_id=workspace_id,
        source_type=source_type,
        upload_label=upload_label,
        upload=file,
        storage=storage,
    )
    processing_service = _processing_service(settings, admin_supabase)
    job_id = processing_service.enqueue_document(document_id=document.id)
    background_tasks.add_task(processing_service.process_job, job_id=job_id)
    return document


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    workspace_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> list[DocumentResponse]:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    return _service(supabase).list(user_id=user.id, workspace_id=workspace_id)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    workspace_id: UUID,
    document_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> DocumentResponse:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    return _service(supabase).get(
        user_id=user.id, workspace_id=workspace_id, document_id=document_id
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    workspace_id: UUID,
    document_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    supabase: Client = Depends(get_user_client),
    admin_supabase: Client = Depends(get_admin_client),
) -> None:
    _authorize_workspace_access(
        workspace_id=workspace_id,
        user=user,
        supabase=supabase,
        admin_supabase=admin_supabase,
    )
    storage = _storage(settings, supabase)
    DocumentService(supabase, vector_store=_vector_store(settings)).delete(
        user_id=user.id, workspace_id=workspace_id, document_id=document_id, storage=storage
    )
