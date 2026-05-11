from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Protocol
from uuid import UUID, uuid4

from supabase import Client

from backend.config.settings import Settings
from backend.models.document import SourceType
from backend.models.errors import AppError, BadRequestError, ConfigError, NotFoundError
from backend.models.professor_profile import (
    EvidenceSummary,
    ProfessorProfileBase,
    ProfessorProfileResponse,
    SourceEvidenceCount,
)
from backend.models.retrieval import ProfileGenerationRetrievalRequest, RetrievalResponse
from backend.services.professor_profile.gemini_client import (
    GeminiProfessorProfileClient,
    ProfessorProfileLlmClient,
)
from backend.services.retrieval.retrieval_service import RetrievalService, build_retrieval_service
from backend.services.workspaces.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)


class ProfessorProfileRetriever(Protocol):
    def retrieve_for_profile_generation(
        self,
        request: ProfileGenerationRetrievalRequest,
    ) -> RetrievalResponse:
        ...


def _require_single(data: Any, *, not_found_message: str) -> dict[str, Any]:
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise NotFoundError(not_found_message)


class ProfessorProfileService:
    def __init__(
        self,
        supabase: Client,
        *,
        retrieval_service: ProfessorProfileRetriever | None = None,
        llm_client: ProfessorProfileLlmClient | None = None,
        service_logger: logging.Logger | None = None,
    ) -> None:
        self._supabase = supabase
        self._workspaces = WorkspaceService(supabase)
        self._retrieval_service = retrieval_service
        self._llm_client = llm_client
        self._logger = service_logger or logger

    def get_latest(self, *, user_id: UUID, workspace_id: UUID) -> ProfessorProfileResponse:
        self._workspaces.get(user_id=user_id, workspace_id=workspace_id)
        response = (
            self._supabase.table("professor_profiles")
            .select("*")
            .eq("workspace_id", str(workspace_id))
            .limit(1)
            .execute()
        )
        record = _require_single(response.data, not_found_message="Professor profile not found")
        return ProfessorProfileResponse.model_validate(record)

    def generate(self, *, user_id: UUID, workspace_id: UUID) -> ProfessorProfileResponse:
        if self._retrieval_service is None or self._llm_client is None:
            raise ConfigError("Professor profile generation dependencies are not configured")

        workspace = self._workspaces.get(user_id=user_id, workspace_id=workspace_id)
        retrieval = self._retrieval_service.retrieve_for_profile_generation(
            ProfileGenerationRetrievalRequest(workspace_id=workspace_id)
        )
        llm_profile = self._llm_client.generate_profile(workspace=workspace, retrieval=retrieval)
        finalized_profile = llm_profile.model_copy(
            update={"evidence_summary": self._build_evidence_summary(retrieval, llm_profile)}
        )
        return self._persist_profile(
            user_id=user_id,
            workspace_id=workspace_id,
            profile=finalized_profile,
        )

    def _persist_profile(
        self,
        *,
        user_id: UUID,
        workspace_id: UUID,
        profile: ProfessorProfileBase,
    ) -> ProfessorProfileResponse:
        existing_profile = self._find_existing_profile(workspace_id=workspace_id)
        profile_payload = profile.model_dump(mode="json")

        if existing_profile is None:
            profile_id = uuid4()
            version = 1
            insert_payload = {
                "id": str(profile_id),
                "workspace_id": str(workspace_id),
                "version": version,
                **profile_payload,
            }
            try:
                (
                    self._supabase.table("professor_profiles")
                    .insert(insert_payload)
                    .execute()
                )
                self._insert_profile_version(
                    professor_profile_id=profile_id,
                    version=version,
                    profile=profile,
                )
            except Exception as exc:
                raise AppError("Failed to persist professor profile") from exc
        else:
            profile_id = UUID(str(existing_profile["id"]))
            current_version = int(existing_profile.get("version", 0))
            version = current_version + 1
            try:
                self._insert_profile_version(
                    professor_profile_id=profile_id,
                    version=version,
                    profile=profile,
                )
                (
                    self._supabase.table("professor_profiles")
                    .update({"version": version, **profile_payload})
                    .eq("id", str(profile_id))
                    .eq("workspace_id", str(workspace_id))
                    .execute()
                )
            except Exception as exc:
                raise AppError("Failed to update professor profile") from exc

        return self.get_latest(user_id=user_id, workspace_id=workspace_id)

    def _insert_profile_version(
        self,
        *,
        professor_profile_id: UUID,
        version: int,
        profile: ProfessorProfileBase,
    ) -> None:
        payload = {
            "id": str(uuid4()),
            "professor_profile_id": str(professor_profile_id),
            "version": version,
            **profile.model_dump(mode="json"),
        }
        self._supabase.table("professor_profile_versions").insert(payload).execute()

    def _find_existing_profile(self, *, workspace_id: UUID) -> dict[str, Any] | None:
        response = (
            self._supabase.table("professor_profiles")
            .select("*")
            .eq("workspace_id", str(workspace_id))
            .limit(1)
            .execute()
        )
        data = response.data
        if isinstance(data, list):
            if not data:
                return None
            first_row = data[0]
            if isinstance(first_row, dict):
                return first_row
        if isinstance(data, dict):
            return data
        raise BadRequestError("Unexpected response from database")

    def _build_evidence_summary(
        self,
        retrieval: RetrievalResponse,
        llm_profile: ProfessorProfileBase,
    ) -> EvidenceSummary:
        document_ids: list[UUID] = []
        chunk_ids: list[UUID] = []
        seen_document_ids: set[UUID] = set()
        source_document_ids: dict[SourceType, set[UUID]] = defaultdict(set)
        source_chunk_counts: dict[SourceType, int] = defaultdict(int)

        for chunk in retrieval.results:
            chunk_ids.append(chunk.chunk_id)
            source_chunk_counts[chunk.source_type] += 1
            source_document_ids[chunk.source_type].add(chunk.document_id)
            if chunk.document_id not in seen_document_ids:
                seen_document_ids.add(chunk.document_id)
                document_ids.append(chunk.document_id)

        source_counts = [
            SourceEvidenceCount(
                source_type=source_type,
                document_count=len(source_document_ids[source_type]),
                chunk_count=source_chunk_counts[source_type],
            )
            for source_type in sorted(source_chunk_counts.keys())
        ]

        return EvidenceSummary(
            total_documents=len(document_ids),
            total_chunks=len(chunk_ids),
            source_counts=source_counts,
            retrieved_document_ids=document_ids,
            retrieved_chunk_ids=chunk_ids,
            retrieval_query=retrieval.query_text,
            evidence_characterization=llm_profile.evidence_summary.evidence_characterization,
        )


def build_professor_profile_service(
    *,
    settings: Settings,
    supabase: Client,
) -> ProfessorProfileService:
    retrieval_service: RetrievalService = build_retrieval_service(settings)
    llm_client = GeminiProfessorProfileClient(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_model,
        api_base_url=settings.gemini_api_base_url,
        timeout_seconds=settings.gemini_timeout_seconds,
    )
    return ProfessorProfileService(
        supabase,
        retrieval_service=retrieval_service,
        llm_client=llm_client,
    )
