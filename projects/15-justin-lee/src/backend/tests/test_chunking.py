from __future__ import annotations

from typing import Any, cast

from backend.services.document_processing.chunking_service import ChunkingService


class NoopSupabase:
    def table(self, _: str) -> Any:
        raise AssertionError("Database access is not expected in split_markdown tests")


def test_split_markdown_preserves_semantic_units() -> None:
    markdown = """
## Definition: Limit
A limit describes the value a function approaches.
Both one-sided limits must agree.

## Example 1: Evaluate a polynomial limit
Compute the expression as x approaches 2.
The final answer is 5.

## Question 1: Derivatives
Find d/dx(x^2 + 3x).
Show all work.

Question 2: Integrals
Evaluate the definite integral from 0 to 1 of x^2.
Explain each step before simplifying.
""".strip()

    service = ChunkingService(cast(Any, NoopSupabase()))
    chunks = service.split_markdown(markdown=markdown)

    assert len(chunks) == 4
    assert [chunk.chunk_type_label for chunk in chunks] == [
        "definition",
        "example",
        "problem",
        "problem",
    ]
    assert [chunk.topic_label for chunk in chunks] == [
        "Limit",
        "Evaluate a polynomial limit",
        "Derivatives",
        "Integrals",
    ]
    assert chunks[1].content.endswith("The final answer is 5.")
    assert "Show all work." in chunks[2].content
    assert chunks[3].content.endswith("Explain each step before simplifying.")


def test_split_markdown_falls_back_to_paragraph_boundaries() -> None:
    markdown = """
Limits describe the behavior of a function near a point.
This paragraph should stay intact.

Derivatives measure instantaneous change.
This second paragraph should become its own chunk.
""".strip()

    service = ChunkingService(cast(Any, NoopSupabase()))
    chunks = service.split_markdown(markdown=markdown)

    assert len(chunks) == 2
    assert chunks[0].content.endswith("This paragraph should stay intact.")
    assert chunks[1].content.endswith("This second paragraph should become its own chunk.")
