from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

from backend.services.document_processing.embedding_service import EmbeddingService
from backend.services.document_processing.parser_service import (
    DocumentProcessingService,
    ParseResult,
)
from backend.services.retrieval.vector_store import VectorStoreRecord
from backend.services.storage.file_storage import LocalFileStorage


class FakeTableQuery:
    def __init__(self, tables: dict[str, list[dict[str, object]]], table_name: str) -> None:
        self._tables = tables
        self._table_name = table_name
        self._operation = "select"
        self._payload: dict[str, object] | None = None
        self._filters: list[tuple[str, object]] = []
        self._limit: int | None = None
        self._order_field: str | None = None
        self._order_desc = False

    def select(self, _: str) -> FakeTableQuery:
        self._operation = "select"
        return self

    def insert(self, payload: dict[str, object]) -> FakeTableQuery:
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, object]) -> FakeTableQuery:
        self._operation = "update"
        self._payload = payload
        return self

    def delete(self) -> FakeTableQuery:
        self._operation = "delete"
        return self

    def eq(self, field: str, value: object) -> FakeTableQuery:
        self._filters.append((field, value))
        return self

    def limit(self, value: int) -> FakeTableQuery:
        self._limit = value
        return self

    def order(self, field: str, *, desc: bool = False) -> FakeTableQuery:
        self._order_field = field
        self._order_desc = desc
        return self

    def execute(self) -> SimpleNamespace:
        if self._operation == "select":
            return SimpleNamespace(data=self._select_rows())
        if self._operation == "insert":
            return SimpleNamespace(data=self._insert_row())
        if self._operation == "update":
            return SimpleNamespace(data=self._update_rows())
        if self._operation == "delete":
            return SimpleNamespace(data=self._delete_rows())
        raise AssertionError(f"Unsupported operation: {self._operation}")

    def _select_rows(self) -> list[dict[str, object]]:
        rows = [row.copy() for row in self._matching_rows()]
        if self._order_field:
            rows.sort(key=lambda row: row[self._order_field], reverse=self._order_desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def _insert_row(self) -> list[dict[str, object]]:
        payload = dict(self._payload or {})
        payload.setdefault("id", str(uuid4()))
        self._tables[self._table_name].append(payload)
        return [payload.copy()]

    def _update_rows(self) -> list[dict[str, object]]:
        updated_rows: list[dict[str, object]] = []
        for row in self._matching_rows():
            row.update(self._payload or {})
            updated_rows.append(row.copy())
        return updated_rows

    def _delete_rows(self) -> list[dict[str, object]]:
        existing_rows = self._tables[self._table_name]
        kept_rows: list[dict[str, object]] = []
        deleted_rows: list[dict[str, object]] = []

        for row in existing_rows:
            if self._matches(row):
                deleted_rows.append(row.copy())
            else:
                kept_rows.append(row)

        self._tables[self._table_name] = kept_rows
        return deleted_rows

    def _matching_rows(self) -> list[dict[str, object]]:
        return [row for row in self._tables[self._table_name] if self._matches(row)]

    def _matches(self, row: dict[str, object]) -> bool:
        return all(row.get(field) == value for field, value in self._filters)


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, object]]]) -> None:
        self._tables = tables

    def table(self, name: str) -> FakeTableQuery:
        self._tables.setdefault(name, [])
        return FakeTableQuery(self._tables, name)

    @property
    def tables(self) -> dict[str, list[dict[str, object]]]:
        return self._tables


@dataclass
class FakeParser:
    should_fail: bool = False

    def parse(self, *, filename: str, content: bytes) -> ParseResult:
        if self.should_fail:
            raise RuntimeError("parser exploded")
        markdown = content.decode("utf-8")
        return ParseResult(
            markdown=markdown,
            parser_used="fake-parser",
            confidence_score=0.99,
            structural_metadata={"section_count": 1},
        )


class FakeEmbeddingProvider:
    @property
    def model_name(self) -> str:
        return "fake-embedding-model"

    def embed_texts(self, *, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), float(index + 1)] for index, text in enumerate(texts)]


class FakeVectorStore:
    def __init__(self) -> None:
        self.records: list[VectorStoreRecord] = []
        self.deleted_document_ids: list[UUID] = []

    @property
    def collection_name(self) -> str:
        return "test_chunks"

    def upsert(self, *, records: list[VectorStoreRecord]) -> None:
        self.records.extend(records)

    def query(
        self, *, query_embedding: list[float], limit: int = 5, document_id: UUID | None = None
    ) -> list[object]:
        raise AssertionError("Query is not expected in document processing tests")

    def delete_document(self, *, document_id: UUID) -> None:
        self.deleted_document_ids.append(document_id)


def _document_row(file_path: str) -> dict[str, object]:
    document_id = str(uuid4())
    workspace_id = str(uuid4())
    timestamp = dt.datetime.now(dt.UTC).isoformat()
    return {
        "id": document_id,
        "workspace_id": workspace_id,
        "source_type": "notes",
        "file_name": "lecture.md",
        "upload_label": "Lecture 1",
        "file_path": file_path,
        "processing_status": "uploaded",
        "created_at": timestamp,
        "updated_at": timestamp,
    }


def _build_service(
    tmp_path: Path,
    *,
    parser: FakeParser,
) -> tuple[DocumentProcessingService, FakeSupabase, UUID, FakeVectorStore]:
    storage = LocalFileStorage(root=str(tmp_path))
    workspace_id = uuid4()
    document_uuid = uuid4()
    file_path = storage.save_bytes(
        workspace_id=workspace_id,
        document_id=document_uuid,
        filename="lecture.md",
        content=b"## Week 1\n\nLimits and continuity.",
        content_type="text/markdown",
    )
    document_row = _document_row(file_path)
    document_row["id"] = str(document_uuid)
    document_row["workspace_id"] = str(workspace_id)

    supabase = FakeSupabase(
        {
            "documents": [document_row],
            "document_processing_jobs": [],
            "parsed_documents": [],
            "chunks": [],
            "chunk_embeddings": [],
        }
    )
    vector_store = FakeVectorStore()
    service = DocumentProcessingService(
        supabase,
        storage,
        parser=parser,
        embedding_service=EmbeddingService(FakeEmbeddingProvider()),
        vector_store=vector_store,
    )
    return service, supabase, document_uuid, vector_store


def test_processing_job_saves_markdown_and_marks_document_indexed(tmp_path: Path) -> None:
    service, supabase, document_id, vector_store = _build_service(tmp_path, parser=FakeParser())

    job_id = service.enqueue_document(document_id=document_id)
    service.process_job(job_id=job_id)

    document_row = supabase.tables["documents"][0]
    job_row = supabase.tables["document_processing_jobs"][0]
    parsed_row = supabase.tables["parsed_documents"][0]
    chunk_rows = supabase.tables["chunks"]
    chunk_embedding_rows = supabase.tables["chunk_embeddings"]

    assert document_row["processing_status"] == "indexed"
    assert job_row["status"] == "completed"
    assert job_row["parser_used"] == "fake-parser"
    assert parsed_row["document_id"] == str(document_id)
    assert "Limits and continuity." in str(parsed_row["normalized_content"])
    assert parsed_row["structural_metadata"]["job_id"] == str(job_id)
    assert len(chunk_rows) == 1
    assert chunk_rows[0]["document_id"] == str(document_id)
    assert chunk_rows[0]["chunk_type_label"] == "section"
    assert "Limits and continuity." in str(chunk_rows[0]["content"])
    assert vector_store.deleted_document_ids == [document_id]
    assert len(vector_store.records) == 1
    assert vector_store.records[0].metadata["document_id"] == str(document_id)
    assert len(chunk_embedding_rows) == 1
    assert chunk_embedding_rows[0]["chunk_id"] == chunk_rows[0]["chunk_id"]
    assert chunk_embedding_rows[0]["vector_store_id"] == chunk_rows[0]["chunk_id"]
    assert chunk_embedding_rows[0]["embedding_model"] == "fake-embedding-model"
    assert chunk_embedding_rows[0]["vector_store_collection"] == "test_chunks"


def test_processing_job_marks_document_failed_when_parser_raises(tmp_path: Path) -> None:
    service, supabase, document_id, vector_store = _build_service(
        tmp_path,
        parser=FakeParser(should_fail=True),
    )

    job_id = service.enqueue_document(document_id=document_id)
    service.process_job(job_id=job_id)

    document_row = supabase.tables["documents"][0]
    job_row = supabase.tables["document_processing_jobs"][0]

    assert document_row["processing_status"] == "failed"
    assert job_row["status"] == "failed"
    assert job_row["error_message"] == "Document processing failed. Review server logs for details."
    assert supabase.tables["parsed_documents"] == []
    assert supabase.tables["chunks"] == []
    assert supabase.tables["chunk_embeddings"] == []
    assert vector_store.records == []
