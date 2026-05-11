from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

from backend.config.settings import Settings
from backend.models.document import SourceType
from backend.models.errors import AppError, ConfigError, NotFoundError
from backend.models.retrieval import (
    AppliedRetrievalFilters,
    ProfileGenerationRetrievalRequest,
    QuestionGenerationRetrievalRequest,
    RetrievalResponse,
    RetrievalScope,
    RetrievedChunk,
)
from backend.services.document_processing.embedding_service import (
    EmbeddingService,
    build_embedding_service,
)

logger = logging.getLogger(__name__)

_ASSESSMENT_SOURCES: set[SourceType] = {"prior_exam", "practice_test"}
_CONCEPT_SOURCES: set[SourceType] = {"lecture_slides", "notes"}
_SOURCE_WEIGHTS: dict[SourceType, float] = {
    "prior_exam": 1.35,
    "practice_test": 1.25,
    "homework": 1.05,
    "lecture_slides": 0.95,
    "notes": 0.9,
}


@dataclass(frozen=True)
class _CandidateChunk:
    chunk: RetrievedChunk


class RetrievalService:
    def __init__(
        self,
        *,
        embedding_service: EmbeddingService,
        persist_directory: str,
        collection_name: str,
        service_logger: logging.Logger | None = None,
    ) -> None:
        self._embedding_service = embedding_service
        self._persist_directory = str(Path(persist_directory).expanduser().resolve())
        self._collection_name = collection_name
        self._logger = service_logger or logger
        self._vector_store: Any | None = None

    def retrieve_for_profile_generation(
        self,
        request: ProfileGenerationRetrievalRequest,
    ) -> RetrievalResponse:
        candidates = self._retrieve_candidates(
            workspace_id=request.workspace_id,
            query_text=request.query_text,
            scope=request.scope,
            candidate_limit=max(request.max_chunks * 4, 24),
        )
        selected = self._select_profile_candidates(
            candidates=candidates,
            limit=request.max_chunks,
        )
        return RetrievalResponse(
            task_type="profile_generation",
            query_text=request.query_text,
            applied_filters=self._applied_filters(
                workspace_id=request.workspace_id,
                scope=request.scope,
            ),
            results=self._rank_selected(selected),
        )

    def retrieve_for_question_generation(
        self,
        request: QuestionGenerationRetrievalRequest,
    ) -> RetrievalResponse:
        candidates = self._retrieve_candidates(
            workspace_id=request.workspace_id,
            query_text=request.resolved_query_text,
            scope=request.scope,
            candidate_limit=max(request.max_chunks * 3, 18),
        )
        selected = self._select_top_candidates(candidates=candidates, limit=request.max_chunks)
        return RetrievalResponse(
            task_type="question_generation",
            query_text=request.resolved_query_text,
            applied_filters=self._applied_filters(
                workspace_id=request.workspace_id,
                scope=request.scope,
            ),
            results=self._rank_selected(selected),
        )

    def _retrieve_candidates(
        self,
        *,
        workspace_id: UUID,
        query_text: str,
        scope: RetrievalScope,
        candidate_limit: int,
    ) -> list[_CandidateChunk]:
        from llama_index.core.vector_stores import (
            FilterCondition,
            FilterOperator,
            MetadataFilter,
            MetadataFilters,
            VectorStoreQuery,
        )

        metadata_filters = self._build_metadata_filters(
            workspace_id=workspace_id,
            scope=scope,
            filter_condition=FilterCondition.AND,
            filter_operator=FilterOperator,
            metadata_filter_type=MetadataFilter,
            metadata_filters_type=MetadataFilters,
        )
        result = self._llama_vector_store().query(
            VectorStoreQuery(
                query_embedding=self._embedding_service.embed_text(text=query_text),
                query_str=query_text,
                similarity_top_k=candidate_limit,
                filters=metadata_filters,
            )
        )

        candidates = self._to_candidates(
            nodes=getattr(result, "nodes", None),
            similarities=getattr(result, "similarities", None),
        )
        if not candidates:
            raise NotFoundError("No indexed chunks matched the retrieval request")
        return candidates

    def _select_profile_candidates(
        self,
        *,
        candidates: list[_CandidateChunk],
        limit: int,
    ) -> list[_CandidateChunk]:
        ordered = self._sorted_candidates(candidates)
        selected: list[_CandidateChunk] = []
        selected_chunk_ids: set[UUID] = set()
        selected_document_ids: set[UUID] = set()

        self._append_first_matching(
            ordered=ordered,
            selected=selected,
            selected_chunk_ids=selected_chunk_ids,
            selected_document_ids=selected_document_ids,
            source_types=_ASSESSMENT_SOURCES,
        )
        self._append_first_matching(
            ordered=ordered,
            selected=selected,
            selected_chunk_ids=selected_chunk_ids,
            selected_document_ids=selected_document_ids,
            source_types=_CONCEPT_SOURCES,
        )
        self._append_document_diverse(
            ordered=ordered,
            selected=selected,
            selected_chunk_ids=selected_chunk_ids,
            selected_document_ids=selected_document_ids,
            limit=limit,
        )
        self._append_remaining(
            ordered=ordered,
            selected=selected,
            selected_chunk_ids=selected_chunk_ids,
            limit=limit,
        )
        return selected[:limit]

    def _select_top_candidates(
        self,
        *,
        candidates: list[_CandidateChunk],
        limit: int,
    ) -> list[_CandidateChunk]:
        return self._sorted_candidates(candidates)[:limit]

    def _append_first_matching(
        self,
        *,
        ordered: list[_CandidateChunk],
        selected: list[_CandidateChunk],
        selected_chunk_ids: set[UUID],
        selected_document_ids: set[UUID],
        source_types: set[SourceType],
    ) -> None:
        for candidate in ordered:
            if candidate.chunk.source_type not in source_types:
                continue
            if candidate.chunk.chunk_id in selected_chunk_ids:
                continue
            selected.append(candidate)
            selected_chunk_ids.add(candidate.chunk.chunk_id)
            selected_document_ids.add(candidate.chunk.document_id)
            return

    def _append_document_diverse(
        self,
        *,
        ordered: list[_CandidateChunk],
        selected: list[_CandidateChunk],
        selected_chunk_ids: set[UUID],
        selected_document_ids: set[UUID],
        limit: int,
    ) -> None:
        for candidate in ordered:
            if len(selected) >= limit:
                return
            if candidate.chunk.chunk_id in selected_chunk_ids:
                continue
            if candidate.chunk.document_id in selected_document_ids:
                continue
            selected.append(candidate)
            selected_chunk_ids.add(candidate.chunk.chunk_id)
            selected_document_ids.add(candidate.chunk.document_id)

    def _append_remaining(
        self,
        *,
        ordered: list[_CandidateChunk],
        selected: list[_CandidateChunk],
        selected_chunk_ids: set[UUID],
        limit: int,
    ) -> None:
        for candidate in ordered:
            if len(selected) >= limit:
                return
            if candidate.chunk.chunk_id in selected_chunk_ids:
                continue
            selected.append(candidate)
            selected_chunk_ids.add(candidate.chunk.chunk_id)

    def _sorted_candidates(self, candidates: list[_CandidateChunk]) -> list[_CandidateChunk]:
        return sorted(
            candidates,
            key=lambda candidate: (
                candidate.chunk.weighted_score,
                candidate.chunk.similarity_score,
                -candidate.chunk.position,
            ),
            reverse=True,
        )

    def _rank_selected(self, candidates: list[_CandidateChunk]) -> list[RetrievedChunk]:
        ranked_chunks: list[RetrievedChunk] = []
        for index, candidate in enumerate(candidates, start=1):
            ranked_chunks.append(candidate.chunk.model_copy(update={"rank": index}))
        return ranked_chunks

    def _to_candidates(
        self,
        *,
        nodes: Any,
        similarities: list[float] | None,
    ) -> list[_CandidateChunk]:
        if not nodes:
            return []

        candidates: list[_CandidateChunk] = []
        similarity_values = similarities or []
        for index, node in enumerate(nodes):
            metadata = node.metadata if isinstance(getattr(node, "metadata", None), dict) else {}
            similarity_score = similarity_values[index] if index < len(similarity_values) else 0.0
            source_type = self._require_source_type(metadata.get("source_type"))
            candidates.append(
                _CandidateChunk(
                    chunk=RetrievedChunk(
                        chunk_id=self._require_uuid(metadata, "chunk_id"),
                        document_id=self._require_uuid(metadata, "document_id"),
                        workspace_id=self._require_uuid(metadata, "workspace_id"),
                        source_type=source_type,
                        upload_label=self._optional_string(metadata.get("upload_label")),
                        position=self._require_int(metadata, "position"),
                        chunk_type_label=self._require_string(metadata, "chunk_type_label"),
                        topic_label=self._optional_string(metadata.get("topic_label")),
                        content=self._node_content(node),
                        similarity_score=similarity_score,
                        weighted_score=similarity_score * _SOURCE_WEIGHTS[source_type],
                        rank=1,
                    )
                )
            )

        return candidates

    def _node_content(self, node: Any) -> str:
        try:
            from llama_index.core.schema import MetadataMode

            return str(node.get_content(metadata_mode=MetadataMode.NONE))
        except Exception:
            return str(getattr(node, "text", ""))

    def _applied_filters(
        self,
        *,
        workspace_id: UUID,
        scope: RetrievalScope,
    ) -> AppliedRetrievalFilters:
        return AppliedRetrievalFilters(
            workspace_id=workspace_id,
            document_ids=scope.document_ids,
            source_types=scope.source_types,
            upload_labels=scope.upload_labels,
            chunk_type_labels=scope.chunk_type_labels,
            topic_label=scope.topic_label,
        )

    def _build_metadata_filters(
        self,
        *,
        workspace_id: UUID,
        scope: RetrievalScope,
        filter_condition: Any,
        filter_operator: Any,
        metadata_filter_type: Any,
        metadata_filters_type: Any,
    ) -> Any:
        filters = [
            metadata_filter_type(
                key="workspace_id",
                value=str(workspace_id),
                operator=filter_operator.EQ,
            )
        ]
        self._append_collection_filter(
            filters=filters,
            key="document_id",
            values=[str(document_id) for document_id in scope.document_ids],
            filter_operator=filter_operator,
            metadata_filter_type=metadata_filter_type,
        )
        self._append_collection_filter(
            filters=filters,
            key="source_type",
            values=list(scope.source_types),
            filter_operator=filter_operator,
            metadata_filter_type=metadata_filter_type,
        )
        self._append_collection_filter(
            filters=filters,
            key="upload_label",
            values=scope.upload_labels,
            filter_operator=filter_operator,
            metadata_filter_type=metadata_filter_type,
        )
        self._append_collection_filter(
            filters=filters,
            key="chunk_type_label",
            values=scope.chunk_type_labels,
            filter_operator=filter_operator,
            metadata_filter_type=metadata_filter_type,
        )
        if scope.topic_label:
            filters.append(
                metadata_filter_type(
                    key="topic_label",
                    value=scope.topic_label,
                    operator=filter_operator.EQ,
                )
            )
        return metadata_filters_type(filters=filters, condition=filter_condition)

    def _append_collection_filter(
        self,
        *,
        filters: list[Any],
        key: str,
        values: list[str],
        filter_operator: Any,
        metadata_filter_type: Any,
    ) -> None:
        if not values:
            return

        if len(values) == 1:
            filters.append(
                metadata_filter_type(
                    key=key,
                    value=values[0],
                    operator=filter_operator.EQ,
                )
            )
            return

        filters.append(
            metadata_filter_type(
                key=key,
                value=values,
                operator=filter_operator.IN,
            )
        )

    def _llama_vector_store(self) -> Any:
        if self._vector_store is not None:
            return self._vector_store

        try:
            import chromadb
            from llama_index.vector_stores.chroma import ChromaVectorStore
        except ImportError as exc:
            raise ConfigError(
                "LlamaIndex Chroma integration is not installed. Add 'llama-index-core' and "
                "'llama-index-vector-stores-chroma' to enable retrieval."
            ) from exc

        chroma_client = chromadb.PersistentClient(path=self._persist_directory)
        chroma_collection = chroma_client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._vector_store = ChromaVectorStore(
            chroma_collection=chroma_collection,
            collection_name=self._collection_name,
        )
        return self._vector_store

    def _require_uuid(self, metadata: dict[str, Any], key: str) -> UUID:
        value = metadata.get(key)
        if not isinstance(value, str):
            raise AppError(f"Retrieved vector entry is missing required metadata: {key}")
        return UUID(value)

    def _require_int(self, metadata: dict[str, Any], key: str) -> int:
        value = metadata.get(key)
        if isinstance(value, bool) or not isinstance(value, int):
            raise AppError(f"Retrieved vector entry is missing required integer metadata: {key}")
        return value

    def _require_string(self, metadata: dict[str, Any], key: str) -> str:
        value = metadata.get(key)
        if not isinstance(value, str) or not value:
            raise AppError(f"Retrieved vector entry is missing required string metadata: {key}")
        return value

    def _optional_string(self, value: Any) -> str | None:
        return value if isinstance(value, str) and value else None

    def _require_source_type(self, value: Any) -> SourceType:
        if value in _SOURCE_WEIGHTS:
            return value
        raise AppError("Retrieved vector entry has an unsupported source_type")


def build_retrieval_service(settings: Settings) -> RetrievalService:
    return RetrievalService(
        embedding_service=build_embedding_service(settings),
        persist_directory=settings.chroma_persist_directory,
        collection_name=settings.chroma_collection_name,
    )
