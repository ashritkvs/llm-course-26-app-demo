from __future__ import annotations

import pathlib
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

from backend.models.errors import ConfigError


@dataclass(frozen=True)
class VectorStoreRecord:
    vector_store_id: str
    chunk_id: UUID
    document_id: UUID
    content: str
    embedding: list[float]
    metadata: dict[str, str | int | float | bool]


@dataclass(frozen=True)
class VectorSearchResult:
    vector_store_id: str
    chunk_id: str | None
    document_id: str | None
    content: str
    distance: float | None
    metadata: dict[str, Any]


class VectorStore(Protocol):
    @property
    def collection_name(self) -> str: ...

    def upsert(self, *, records: Sequence[VectorStoreRecord]) -> None: ...

    def query(
        self,
        *,
        query_embedding: Sequence[float],
        limit: int = 5,
        document_id: UUID | None = None,
    ) -> list[VectorSearchResult]: ...

    def delete_document(self, *, document_id: UUID) -> None: ...


class ChromaVectorStore:
    def __init__(self, *, persist_directory: str, collection_name: str) -> None:
        self._persist_directory = pathlib.Path(persist_directory).expanduser().resolve()
        self._persist_directory.mkdir(parents=True, exist_ok=True)
        self._collection_name = collection_name
        self._client = self._create_client()
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    @property
    def collection_name(self) -> str:
        return self._collection_name

    @property
    def persist_directory(self) -> str:
        return str(self._persist_directory)

    def upsert(self, *, records: Sequence[VectorStoreRecord]) -> None:
        if not records:
            return

        self._collection.upsert(
            ids=[record.vector_store_id for record in records],
            embeddings=[record.embedding for record in records],
            documents=[record.content for record in records],
            metadatas=[self._clean_metadata(record.metadata) for record in records],
        )

    def query(
        self,
        *,
        query_embedding: Sequence[float],
        limit: int = 5,
        document_id: UUID | None = None,
    ) -> list[VectorSearchResult]:
        response = self._collection.query(
            query_embeddings=[list(query_embedding)],
            n_results=limit,
            where={"document_id": str(document_id)} if document_id else None,
            include=["documents", "metadatas", "distances"],
        )

        ids = response.get("ids", [[]])[0]
        documents = response.get("documents", [[]])[0]
        metadatas = response.get("metadatas", [[]])[0]
        distances = response.get("distances", [[]])[0]

        results: list[VectorSearchResult] = []
        for vector_store_id, content, metadata, distance in zip(
            ids,
            documents,
            metadatas,
            distances,
            strict=False,
        ):
            normalized_metadata = metadata if isinstance(metadata, dict) else {}
            results.append(
                VectorSearchResult(
                    vector_store_id=vector_store_id,
                    chunk_id=self._optional_string(normalized_metadata.get("chunk_id")),
                    document_id=self._optional_string(normalized_metadata.get("document_id")),
                    content=content or "",
                    distance=distance,
                    metadata=normalized_metadata,
                )
            )

        return results

    def delete_document(self, *, document_id: UUID) -> None:
        self._collection.delete(where={"document_id": str(document_id)})

    def _create_client(self) -> Any:
        try:
            import chromadb
        except ImportError as exc:
            raise ConfigError(
                "ChromaDB is not installed. Add the 'chromadb' dependency to run indexing."
            ) from exc

        return chromadb.PersistentClient(path=str(self._persist_directory))

    def _clean_metadata(self, metadata: dict[str, str | int | float | bool]) -> dict[str, Any]:
        return {key: value for key, value in metadata.items() if value is not None}

    def _optional_string(self, value: Any) -> str | None:
        return value if isinstance(value, str) else None
