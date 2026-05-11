from __future__ import annotations

from uuid import uuid4

import pytest
from backend.services.retrieval.vector_store import ChromaVectorStore, VectorStoreRecord

chromadb = pytest.importorskip("chromadb")


def test_chroma_vector_store_persists_and_queries(tmp_path) -> None:
    store = ChromaVectorStore(
        persist_directory=str(tmp_path / "chroma"),
        collection_name="test_chunks",
    )
    matching_chunk_id = uuid4()
    other_chunk_id = uuid4()
    document_id = uuid4()

    store.upsert(
        records=[
            VectorStoreRecord(
                vector_store_id=str(matching_chunk_id),
                chunk_id=matching_chunk_id,
                document_id=document_id,
                content="chain rule derivative example",
                embedding=[1.0, 0.0],
                metadata={
                    "chunk_id": str(matching_chunk_id),
                    "document_id": str(document_id),
                    "position": 0,
                },
            ),
            VectorStoreRecord(
                vector_store_id=str(other_chunk_id),
                chunk_id=other_chunk_id,
                document_id=document_id,
                content="integral substitution example",
                embedding=[0.0, 1.0],
                metadata={
                    "chunk_id": str(other_chunk_id),
                    "document_id": str(document_id),
                    "position": 1,
                },
            ),
        ]
    )

    matches = store.query(query_embedding=[1.0, 0.0], limit=1, document_id=document_id)

    assert (tmp_path / "chroma").exists()
    assert len(matches) == 1
    assert matches[0].chunk_id == str(matching_chunk_id)
    assert "chain rule" in matches[0].content
