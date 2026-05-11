from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from uuid import UUID, uuid4

from supabase import Client

logger = logging.getLogger(__name__)

_HEADER_RE = re.compile(r"^(#{1,6})\s+(?P<title>.+?)\s*$")
_SEMANTIC_BOUNDARY_RE = re.compile(
    r"^(?P<label>question|problem|exercise|example|definition|theorem|lemma|proposition|corollary|solution|proof)\b",
    re.IGNORECASE,
)
_GENERIC_TOPIC_RE = re.compile(
    r"^(question|problem|exercise|example|definition|theorem|lemma|proposition|corollary|solution|proof|section)\s*[\dA-Za-z().:-]*$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class MarkdownChunk:
    content: str
    position: int
    chunk_type_label: str
    topic_label: str | None


@dataclass(frozen=True)
class StoredChunk:
    chunk_id: UUID
    document_id: UUID
    content: str
    position: int
    chunk_type_label: str
    topic_label: str | None


@dataclass
class _ChunkDraft:
    lines: list[str]
    heading_context: tuple[str, ...]


class ChunkingService:
    def __init__(
        self,
        supabase: Client,
        *,
        service_logger: logging.Logger | None = None,
    ) -> None:
        self._supabase = supabase
        self._logger = service_logger or logger

    def save_chunks(self, *, document_id: UUID, markdown: str) -> list[StoredChunk]:
        chunks = self.split_markdown(markdown=markdown)
        self._supabase.table("chunks").delete().eq("document_id", str(document_id)).execute()

        stored_chunks: list[StoredChunk] = []
        for chunk in chunks:
            chunk_id = uuid4()
            payload = {
                "chunk_id": str(chunk_id),
                "document_id": str(document_id),
                "content": chunk.content,
                "position": chunk.position,
                "chunk_type_label": chunk.chunk_type_label,
                "topic_label": chunk.topic_label,
            }
            self._supabase.table("chunks").insert(payload).execute()
            stored_chunks.append(
                StoredChunk(
                    chunk_id=chunk_id,
                    document_id=document_id,
                    content=chunk.content,
                    position=chunk.position,
                    chunk_type_label=chunk.chunk_type_label,
                    topic_label=chunk.topic_label,
                )
            )

        self._logger.info("Saved %s chunks for document %s", len(stored_chunks), document_id)
        return stored_chunks

    def split_markdown(self, *, markdown: str) -> list[MarkdownChunk]:
        normalized_markdown = self._normalize_markdown(markdown)
        if not normalized_markdown:
            return []

        lines = normalized_markdown.split("\n")
        drafts, used_structural_boundaries = self._split_by_structure(lines=lines)
        if not used_structural_boundaries:
            drafts = self._split_by_paragraphs(lines=lines)

        chunks = self._finalize_drafts(drafts=drafts)
        if chunks:
            return chunks

        return [
            MarkdownChunk(
                content=normalized_markdown,
                position=0,
                chunk_type_label="section",
                topic_label=None,
            )
        ]

    def _split_by_structure(self, *, lines: list[str]) -> tuple[list[_ChunkDraft], bool]:
        drafts: list[_ChunkDraft] = []
        current: _ChunkDraft | None = None
        heading_stack: dict[int, str] = {}
        used_structural_boundaries = False
        previous_blank = True

        for line in lines:
            header_match = _HEADER_RE.match(line)
            if header_match:
                current = self._close_current(drafts=drafts, current=current)
                heading_stack = self._updated_heading_stack(
                    current_stack=heading_stack,
                    level=len(header_match.group(1)),
                    title=header_match.group("title").strip(),
                )
                current = _ChunkDraft(
                    lines=[line],
                    heading_context=self._heading_context(heading_stack),
                )
                used_structural_boundaries = True
                previous_blank = False
                continue

            if previous_blank and self._starts_semantic_unit(line=line):
                current = self._close_current(drafts=drafts, current=current)
                current = _ChunkDraft(
                    lines=[line],
                    heading_context=self._heading_context(heading_stack),
                )
                used_structural_boundaries = True
                previous_blank = False
                continue

            if current is None:
                current = _ChunkDraft(
                    lines=[line],
                    heading_context=self._heading_context(heading_stack),
                )
            else:
                current.lines.append(line)

            previous_blank = not line.strip()

        self._close_current(drafts=drafts, current=current)
        return drafts, used_structural_boundaries

    def _split_by_paragraphs(self, *, lines: list[str]) -> list[_ChunkDraft]:
        drafts: list[_ChunkDraft] = []
        paragraph_lines: list[str] = []

        for line in lines:
            if line.strip():
                paragraph_lines.append(line)
                continue

            if paragraph_lines:
                drafts.append(_ChunkDraft(lines=paragraph_lines.copy(), heading_context=()))
                paragraph_lines = []

        if paragraph_lines:
            drafts.append(_ChunkDraft(lines=paragraph_lines.copy(), heading_context=()))

        return drafts

    def _finalize_drafts(self, *, drafts: list[_ChunkDraft]) -> list[MarkdownChunk]:
        chunks: list[MarkdownChunk] = []

        for draft in drafts:
            content = self._clean_chunk_content(lines=draft.lines)
            if not content:
                continue

            chunk_type_label = self._infer_chunk_type(content=content)
            topic_label = self._infer_topic(
                content=content,
                heading_context=draft.heading_context,
            )
            chunks.append(
                MarkdownChunk(
                    content=content,
                    position=len(chunks),
                    chunk_type_label=chunk_type_label,
                    topic_label=topic_label,
                )
            )

        return chunks

    def _close_current(
        self,
        *,
        drafts: list[_ChunkDraft],
        current: _ChunkDraft | None,
    ) -> _ChunkDraft | None:
        if current is None:
            return None
        if self._clean_chunk_content(lines=current.lines):
            drafts.append(current)
        return None

    def _updated_heading_stack(
        self,
        *,
        current_stack: dict[int, str],
        level: int,
        title: str,
    ) -> dict[int, str]:
        next_stack = {key: value for key, value in current_stack.items() if key < level}
        next_stack[level] = title
        return next_stack

    def _heading_context(self, heading_stack: dict[int, str]) -> tuple[str, ...]:
        return tuple(heading_stack[level] for level in sorted(heading_stack))

    def _starts_semantic_unit(self, *, line: str) -> bool:
        stripped = line.strip()
        return bool(stripped) and bool(_SEMANTIC_BOUNDARY_RE.match(stripped))

    def _normalize_markdown(self, markdown: str) -> str:
        return markdown.replace("\r\n", "\n").replace("\r", "\n").strip()

    def _clean_chunk_content(self, *, lines: list[str]) -> str:
        content = "\n".join(lines).strip()
        return re.sub(r"\n{3,}", "\n\n", content)

    def _infer_chunk_type(self, *, content: str) -> str:
        title = self._extract_title_line(content)
        if not title:
            return "section"

        lowered = title.lower()
        if any(token in lowered for token in ("question", "problem", "exercise")):
            return "problem"
        if "example" in lowered:
            return "example"
        if "definition" in lowered:
            return "definition"
        if any(token in lowered for token in ("theorem", "lemma", "proposition", "corollary")):
            return "theorem"
        if any(token in lowered for token in ("solution", "proof")):
            return "solution"
        return "section"

    def _infer_topic(self, *, content: str, heading_context: tuple[str, ...]) -> str | None:
        title = self._extract_title_line(content)
        title_topic = self._topic_from_title(title)
        if title_topic:
            return title_topic

        for heading in reversed(heading_context):
            heading_topic = self._topic_from_title(heading)
            if heading_topic:
                return heading_topic

        return None

    def _extract_title_line(self, content: str) -> str:
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if header_match := _HEADER_RE.match(stripped):
                return header_match.group("title").strip()
            return stripped
        return ""

    def _topic_from_title(self, title: str) -> str | None:
        cleaned_title = self._strip_markdown_prefixes(title).strip(" :-")
        if not cleaned_title:
            return None

        if label_match := _SEMANTIC_BOUNDARY_RE.match(cleaned_title):
            remainder = cleaned_title[label_match.end() :].strip(" .:-")
            remainder = self._strip_leading_identifier(remainder)
            if remainder and not _GENERIC_TOPIC_RE.match(remainder):
                return remainder
            return None

        if _GENERIC_TOPIC_RE.match(cleaned_title):
            return None
        return cleaned_title

    def _strip_leading_identifier(self, value: str) -> str:
        without_numeric_prefix = re.sub(r"^\d+\s*[:.)-]?\s*", "", value)
        return re.sub(r"^\(?[A-Za-z]\)?\s*[:.)-]\s*", "", without_numeric_prefix).strip()

    def _strip_markdown_prefixes(self, value: str) -> str:
        stripped = value.strip()
        return stripped.lstrip("#").strip()
