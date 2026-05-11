from __future__ import annotations

import logging
import pathlib
import tempfile
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import UUID, uuid4

from supabase import Client

from backend.models.errors import AppError, ConfigError, NotFoundError
from backend.services.document_processing.chunking_service import ChunkingService, StoredChunk
from backend.services.document_processing.embedding_service import EmbeddingService
from backend.services.retrieval.vector_store import VectorStore, VectorStoreRecord
from backend.services.storage.file_storage import FileStorage

logger = logging.getLogger(__name__)

_MARKDOWN_EXTENSIONS = {".md", ".markdown"}
_TEXT_EXTENSIONS = {".txt"}


def _require_single(data: Any, *, not_found_message: str) -> dict[str, Any]:
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    raise NotFoundError(not_found_message)


@dataclass(frozen=True)
class ParseResult:
    markdown: str
    parser_used: str
    confidence_score: float | None = None
    structural_metadata: dict[str, Any] = field(default_factory=dict)


class DocumentParser(Protocol):
    def parse(self, *, filename: str, content: bytes) -> ParseResult: ...


class DefaultDocumentParser:
    def parse(self, *, filename: str, content: bytes) -> ParseResult:
        extension = pathlib.Path(filename).suffix.lower()
        if extension in _MARKDOWN_EXTENSIONS:
            markdown = content.decode("utf-8", errors="replace")
            return ParseResult(
                markdown=markdown,
                parser_used="native_markdown",
                confidence_score=1.0,
                structural_metadata={"file_extension": extension},
            )

        if extension in _TEXT_EXTENSIONS:
            markdown = content.decode("utf-8", errors="replace")
            return ParseResult(
                markdown=markdown,
                parser_used="plain_text",
                confidence_score=1.0,
                structural_metadata={"file_extension": extension},
            )

        return self._parse_with_layout_aware_parser(filename=filename, content=content)

    def _parse_with_layout_aware_parser(self, *, filename: str, content: bytes) -> ParseResult:
        extension = pathlib.Path(filename).suffix.lower()
        with tempfile.NamedTemporaryFile(suffix=extension, delete=True) as tmp:
            tmp.write(content)
            tmp.flush()
            docling_result = self._try_docling(tmp.name)
            if docling_result and self._is_usable(docling_result.markdown):
                return docling_result

            if extension == ".pdf":
                marker_result = self._try_marker(tmp.name)
                if marker_result:
                    return marker_result

        if docling_result:
            return docling_result
        raise AppError("No supported parser is available for this document type")

    def _try_docling(self, file_path: str) -> ParseResult | None:
        try:
            from docling.document_converter import DocumentConverter
        except ImportError:
            return None

        converter = DocumentConverter()
        result = converter.convert(file_path)
        markdown = result.document.export_to_markdown().strip()
        return ParseResult(
            markdown=markdown,
            parser_used="docling",
            confidence_score=self._estimate_confidence(markdown),
            structural_metadata={"fallback_used": False},
        )

    def _try_marker(self, file_path: str) -> ParseResult | None:
        try:
            from marker.converters.pdf import PdfConverter
            from marker.models import create_model_dict
            from marker.output import text_from_rendered
        except ImportError:
            return None

        converter = PdfConverter(artifact_dict=create_model_dict())
        rendered = converter(file_path)
        markdown, _, _ = text_from_rendered(rendered)
        cleaned_markdown = markdown.strip()
        if not self._is_usable(cleaned_markdown):
            return None

        return ParseResult(
            markdown=cleaned_markdown,
            parser_used="marker",
            confidence_score=self._estimate_confidence(cleaned_markdown),
            structural_metadata={"fallback_used": True},
        )

    def _estimate_confidence(self, markdown: str) -> float:
        length = len(markdown.strip())
        if length == 0:
            return 0.0
        if length < 200:
            return 0.5
        if length < 1000:
            return 0.75
        return 0.9

    def _is_usable(self, markdown: str) -> bool:
        return bool(markdown.strip())


class DocumentProcessingService:
    def __init__(
        self,
        supabase: Client,
        storage: FileStorage,
        *,
        parser: DocumentParser | None = None,
        chunking_service: ChunkingService | None = None,
        embedding_service: EmbeddingService | None = None,
        vector_store: VectorStore | None = None,
        service_logger: logging.Logger | None = None,
    ) -> None:
        self._supabase = supabase
        self._storage = storage
        self._parser = parser or DefaultDocumentParser()
        self._logger = service_logger or logger
        self._embedding_service = embedding_service
        self._vector_store = vector_store
        self._chunking_service = chunking_service or ChunkingService(
            supabase,
            service_logger=self._logger,
        )

    def enqueue_document(self, *, document_id: UUID) -> UUID:
        self._get_document(document_id=document_id)
        payload = {"document_id": str(document_id), "status": "queued"}
        try:
            response = self._supabase.table("document_processing_jobs").insert(payload).execute()
        except Exception as exc:
            self._logger.error(
                "Failed to enqueue parsing job for document %s with %s",
                document_id,
                exc.__class__.__name__,
            )
            self._update_document_status(document_id=document_id, status="failed")
            raise AppError("Failed to enqueue document processing") from exc

        record = _require_single(response.data, not_found_message="Processing job not created")
        job_id = UUID(record["id"])
        self._logger.info("Queued parsing job %s for document %s", job_id, document_id)
        return job_id

    def process_job(self, *, job_id: UUID) -> None:
        job = self._get_job(job_id=job_id)
        document_id = UUID(job["document_id"])
        self._mark_job_running(job_id=job_id, document_id=document_id)

        try:
            document = self._get_document(document_id=document_id)
            content = self._storage.read_bytes(file_path=document["file_path"])
            parsed = self._parser.parse(filename=document["file_name"], content=content)
            self._save_parsed_document(document=document, parsed=parsed, job_id=job_id)
            chunks = self._chunking_service.save_chunks(
                document_id=document_id,
                markdown=parsed.markdown,
            )
            self._index_chunks(document=document, parsed=parsed, chunks=chunks)
            self._mark_job_completed(job_id=job_id, parsed=parsed)
            self._update_document_status(document_id=document_id, status="indexed")
            self._logger.info(
                "Completed parsing, chunking, and indexing job %s for document %s using %s",
                job_id,
                document_id,
                parsed.parser_used,
            )
        except Exception as exc:
            self._mark_job_failed(job_id=job_id, document_id=document_id, exc=exc)

    def _get_document(self, *, document_id: UUID) -> dict[str, Any]:
        response = (
            self._supabase.table("documents")
            .select("*")
            .eq("id", str(document_id))
            .limit(1)
            .execute()
        )
        return _require_single(response.data, not_found_message="Document not found")

    def _get_job(self, *, job_id: UUID) -> dict[str, Any]:
        response = (
            self._supabase.table("document_processing_jobs")
            .select("*")
            .eq("id", str(job_id))
            .limit(1)
            .execute()
        )
        return _require_single(response.data, not_found_message="Processing job not found")

    def _mark_job_running(self, *, job_id: UUID, document_id: UUID) -> None:
        self._logger.info("Starting parsing job %s for document %s", job_id, document_id)
        self._update_job(job_id=job_id, payload={"status": "running", "error_message": None})
        self._update_document_status(document_id=document_id, status="parsing")

    def _save_parsed_document(
        self,
        *,
        document: dict[str, Any],
        parsed: ParseResult,
        job_id: UUID,
    ) -> None:
        document_id = UUID(document["id"])
        (
            self._supabase.table("parsed_documents")
            .delete()
            .eq("document_id", str(document_id))
            .execute()
        )
        metadata = {
            "job_id": str(job_id),
            "file_name": document["file_name"],
            "file_path": document["file_path"],
            "source_type": document["source_type"],
            "parser_used": parsed.parser_used,
            "confidence_score": parsed.confidence_score,
            **parsed.structural_metadata,
        }
        payload = {
            "document_id": str(document_id),
            "normalized_content": parsed.markdown,
            "structural_metadata": metadata,
        }
        self._supabase.table("parsed_documents").insert(payload).execute()

    def _mark_job_completed(self, *, job_id: UUID, parsed: ParseResult) -> None:
        payload = {
            "status": "completed",
            "parser_used": parsed.parser_used,
            "confidence_score": parsed.confidence_score,
            "error_message": None,
        }
        self._update_job(job_id=job_id, payload=payload)

    def _mark_job_failed(self, *, job_id: UUID, document_id: UUID, exc: Exception) -> None:
        self._logger.error(
            "Parsing job %s failed for document %s with %s",
            job_id,
            document_id,
            exc.__class__.__name__,
        )
        self._update_job(
            job_id=job_id,
            payload={
                "status": "failed",
                "error_message": "Document processing failed. Review server logs for details.",
            },
        )
        self._update_document_status(document_id=document_id, status="failed")

    def _update_document_status(self, *, document_id: UUID, status: str) -> None:
        self._supabase.table("documents").update({"processing_status": status}).eq(
            "id", str(document_id)
        ).execute()

    def _update_job(self, *, job_id: UUID, payload: dict[str, Any]) -> None:
        (
            self._supabase.table("document_processing_jobs")
            .update(payload)
            .eq("id", str(job_id))
            .execute()
        )

    def _index_chunks(
        self,
        *,
        document: dict[str, Any],
        parsed: ParseResult,
        chunks: list[StoredChunk],
    ) -> None:
        if not chunks:
            self._logger.info("Document %s produced no chunks to index", document["id"])
            return

        if self._embedding_service is None or self._vector_store is None:
            raise ConfigError("Embedding pipeline is not configured")

        document_id = UUID(str(document["id"]))
        self._vector_store.delete_document(document_id=document_id)
        embeddings = self._embedding_service.embed_texts(
            texts=[chunk.content for chunk in chunks],
        )

        records: list[VectorStoreRecord] = []
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            records.append(
                VectorStoreRecord(
                    vector_store_id=str(chunk.chunk_id),
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    content=chunk.content,
                    embedding=embedding,
                    metadata=self._build_chunk_metadata(
                        document=document,
                        parsed=parsed,
                        chunk=chunk,
                    ),
                )
            )

        self._vector_store.upsert(records=records)

        for record in records:
            self._supabase.table("chunk_embeddings").insert(
                {
                    "id": str(uuid4()),
                    "chunk_id": str(record.chunk_id),
                    "vector_store_id": record.vector_store_id,
                    "vector_store_collection": self._vector_store.collection_name,
                    "embedding_model": self._embedding_service.model_name,
                }
            ).execute()

        self._logger.info(
            "Indexed %s chunks for document %s into Chroma collection %s",
            len(records),
            document_id,
            self._vector_store.collection_name,
        )

    def _build_chunk_metadata(
        self,
        *,
        document: dict[str, Any],
        parsed: ParseResult,
        chunk: StoredChunk,
    ) -> dict[str, str | int | float | bool]:
        metadata: dict[str, str | int | float | bool] = {
            "chunk_id": str(chunk.chunk_id),
            "document_id": str(chunk.document_id),
            "workspace_id": str(document["workspace_id"]),
            "source_type": str(document["source_type"]),
            "position": chunk.position,
            "chunk_type_label": chunk.chunk_type_label,
            "parser_used": parsed.parser_used,
        }
        if document.get("upload_label"):
            metadata["upload_label"] = str(document["upload_label"])
        if chunk.topic_label:
            metadata["topic_label"] = chunk.topic_label
        if parsed.confidence_score is not None:
            metadata["confidence_score"] = parsed.confidence_score
        return metadata
