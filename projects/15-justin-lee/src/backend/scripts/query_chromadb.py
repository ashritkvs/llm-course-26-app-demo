from __future__ import annotations

import argparse
import pathlib
import sys
from uuid import UUID

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Query the local ChromaDB chunk index.")
    parser.add_argument("query", help="Keyword or phrase to search for")
    parser.add_argument("--document-id", help="Optional document UUID filter")
    parser.add_argument("--limit", type=int, default=3, help="Maximum number of matches to return")
    return parser.parse_args()


def main() -> int:
    from backend.config.settings import get_settings
    from backend.services.document_processing.embedding_service import build_embedding_service
    from backend.services.retrieval.vector_store import ChromaVectorStore

    args = parse_args()
    settings = get_settings()
    embedding_service = build_embedding_service(settings)
    vector_store = ChromaVectorStore(
        persist_directory=settings.chroma_persist_directory,
        collection_name=settings.chroma_collection_name,
    )

    matches = vector_store.query(
        query_embedding=embedding_service.embed_text(text=args.query),
        limit=args.limit,
        document_id=UUID(args.document_id) if args.document_id else None,
    )

    if not matches:
        print("No matches found.")
        return 1

    for index, match in enumerate(matches, start=1):
        print(f"{index}. chunk_id={match.chunk_id} distance={match.distance}")
        print(f"   document_id={match.document_id} position={match.metadata.get('position')}")
        print(f"   content={match.content[:200].replace(chr(10), ' ')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
