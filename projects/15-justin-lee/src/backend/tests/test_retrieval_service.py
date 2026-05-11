from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from backend.models.retrieval import (
    ProfileGenerationRetrievalRequest,
    QuestionGenerationRetrievalRequest,
    RetrievalScope,
)
from backend.services.document_processing.embedding_service import (
    EmbeddingService,
    HashingEmbeddingProvider,
)
from backend.services.retrieval.retrieval_service import RetrievalService
from backend.services.retrieval.vector_store import ChromaVectorStore, VectorStoreRecord

pytest.importorskip("llama_index.core")


def test_question_generation_retrieval_filters_to_exact_topic(tmp_path) -> None:
    workspace_id = uuid4()
    other_workspace_id = uuid4()
    embedding_service = EmbeddingService(HashingEmbeddingProvider(dimensions=64))
    vector_store = _build_vector_store(tmp_path)

    matching_chunks = [
        _chunk_input(
            workspace_id=workspace_id,
            source_type="prior_exam",
            upload_label="Midterm 1",
            topic_label="Hypothesis Testing",
            content="Hypothesis testing exam problem about p-values and rejection regions.",
            position=0,
        ),
        _chunk_input(
            workspace_id=workspace_id,
            source_type="notes",
            upload_label="Week 5 Notes",
            topic_label="Hypothesis Testing",
            content="Lecture notes covering null hypotheses, p-values, and test statistics.",
            position=1,
        ),
    ]
    non_matching_chunks = [
        _chunk_input(
            workspace_id=workspace_id,
            source_type="lecture_slides",
            upload_label="Week 6 Slides",
            topic_label="Confidence Intervals",
            content="Confidence interval formulas and interpretation examples.",
            position=0,
        ),
        _chunk_input(
            workspace_id=other_workspace_id,
            source_type="prior_exam",
            upload_label="Other Workspace Exam",
            topic_label="Hypothesis Testing",
            content="A different workspace exam chunk that should never be retrieved.",
            position=0,
        ),
    ]

    _index_chunks(
        vector_store=vector_store,
        embedding_service=embedding_service,
        chunks=matching_chunks + non_matching_chunks,
    )

    service = RetrievalService(
        embedding_service=embedding_service,
        persist_directory=str(tmp_path / "chroma"),
        collection_name="retrieval_test_chunks",
    )

    response = service.retrieve_for_question_generation(
        QuestionGenerationRetrievalRequest(
            workspace_id=workspace_id,
            topic_label="Hypothesis Testing",
            query_text="p-values and test statistics",
            max_chunks=5,
        )
    )

    assert len(response.results) == 2
    assert response.applied_filters.topic_label == "Hypothesis Testing"
    assert all(result.workspace_id == workspace_id for result in response.results)
    assert all(result.topic_label == "Hypothesis Testing" for result in response.results)


def test_profile_generation_retrieval_preserves_assessment_and_concept_coverage(tmp_path) -> None:
    workspace_id = uuid4()
    embedding_service = EmbeddingService(HashingEmbeddingProvider(dimensions=64))
    vector_store = _build_vector_store(tmp_path)

    _index_chunks(
        vector_store=vector_store,
        embedding_service=embedding_service,
        chunks=[
            _chunk_input(
                workspace_id=workspace_id,
                source_type="prior_exam",
                upload_label="Midterm 1",
                topic_label="Derivatives",
                content="Prior exam free-response derivative problem with chain rule and product rule.",
                position=0,
            ),
            _chunk_input(
                workspace_id=workspace_id,
                source_type="practice_test",
                upload_label="Practice Test 1",
                topic_label="Derivatives",
                content="Practice test question about derivative applications and optimization.",
                position=0,
            ),
            _chunk_input(
                workspace_id=workspace_id,
                source_type="lecture_slides",
                upload_label="Week 2 Slides",
                topic_label="Derivatives",
                content="Lecture slides summarizing derivative rules and conceptual interpretation.",
                position=0,
            ),
            _chunk_input(
                workspace_id=workspace_id,
                source_type="homework",
                upload_label="HW 3",
                topic_label="Derivatives",
                content="Homework problems on implicit differentiation and related rates.",
                position=0,
            ),
        ],
    )

    service = RetrievalService(
        embedding_service=embedding_service,
        persist_directory=str(tmp_path / "chroma"),
        collection_name="retrieval_test_chunks",
    )

    response = service.retrieve_for_profile_generation(
        ProfileGenerationRetrievalRequest(
            workspace_id=workspace_id,
            max_chunks=3,
        )
    )

    retrieved_source_types = {result.source_type for result in response.results}
    assert "prior_exam" in retrieved_source_types or "practice_test" in retrieved_source_types
    assert "lecture_slides" in retrieved_source_types or "notes" in retrieved_source_types
    assert len({result.document_id for result in response.results}) == len(response.results)


def test_profile_generation_retrieval_honors_upload_label_scope(tmp_path) -> None:
    workspace_id = uuid4()
    embedding_service = EmbeddingService(HashingEmbeddingProvider(dimensions=64))
    vector_store = _build_vector_store(tmp_path)

    _index_chunks(
        vector_store=vector_store,
        embedding_service=embedding_service,
        chunks=[
            _chunk_input(
                workspace_id=workspace_id,
                source_type="prior_exam",
                upload_label="Midterm 1",
                topic_label="Series",
                content="Prior exam series convergence question.",
                position=0,
            ),
            _chunk_input(
                workspace_id=workspace_id,
                source_type="prior_exam",
                upload_label="Midterm 2",
                topic_label="Series",
                content="Another prior exam series question from a different upload label.",
                position=0,
            ),
        ],
    )

    service = RetrievalService(
        embedding_service=embedding_service,
        persist_directory=str(tmp_path / "chroma"),
        collection_name="retrieval_test_chunks",
    )

    response = service.retrieve_for_profile_generation(
        ProfileGenerationRetrievalRequest(
            workspace_id=workspace_id,
            max_chunks=5,
            scope=RetrievalScope(upload_labels=["Midterm 1"]),
        )
    )

    assert len(response.results) == 1
    assert response.results[0].upload_label == "Midterm 1"


def _build_vector_store(tmp_path) -> ChromaVectorStore:
    return ChromaVectorStore(
        persist_directory=str(tmp_path / "chroma"),
        collection_name="retrieval_test_chunks",
    )


def _chunk_input(
    *,
    workspace_id: UUID,
    source_type: str,
    upload_label: str,
    topic_label: str,
    content: str,
    position: int,
) -> dict[str, object]:
    chunk_id = uuid4()
    document_id = uuid4()
    return {
        "chunk_id": chunk_id,
        "document_id": document_id,
        "workspace_id": workspace_id,
        "source_type": source_type,
        "upload_label": upload_label,
        "topic_label": topic_label,
        "content": content,
        "position": position,
        "chunk_type_label": "problem",
    }


def _index_chunks(
    *,
    vector_store: ChromaVectorStore,
    embedding_service: EmbeddingService,
    chunks: list[dict[str, object]],
) -> None:
    embeddings = embedding_service.embed_texts(
        texts=[str(chunk["content"]) for chunk in chunks],
    )
    records: list[VectorStoreRecord] = []
    for chunk, embedding in zip(chunks, embeddings, strict=True):
        records.append(
            VectorStoreRecord(
                vector_store_id=str(chunk["chunk_id"]),
                chunk_id=chunk["chunk_id"],
                document_id=chunk["document_id"],
                content=str(chunk["content"]),
                embedding=embedding,
                metadata={
                    "chunk_id": str(chunk["chunk_id"]),
                    "document_id": str(chunk["document_id"]),
                    "workspace_id": str(chunk["workspace_id"]),
                    "source_type": str(chunk["source_type"]),
                    "upload_label": str(chunk["upload_label"]),
                    "topic_label": str(chunk["topic_label"]),
                    "position": int(chunk["position"]),
                    "chunk_type_label": str(chunk["chunk_type_label"]),
                },
            )
        )

    vector_store.upsert(records=records)
