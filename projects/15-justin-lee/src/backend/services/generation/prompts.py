from __future__ import annotations

import json

from backend.models.generation import GenerationConfig, ScopeConstraints
from backend.models.professor_profile import ProfessorProfileBase
from backend.models.retrieval import RetrievedChunk
from backend.services.generation.models import DraftQuestion


def build_draft_generation_prompt(
    *,
    chunks: list[RetrievedChunk],
    professor_profile: ProfessorProfileBase,
    generation_config: GenerationConfig,
    scope_constraints: ScopeConstraints,
) -> str:
    schema_json = json.dumps(DraftQuestion.model_json_schema(), indent=2, sort_keys=True)
    evidence_blocks = _format_evidence_blocks(chunks)
    profile_summary = _format_profile_summary(professor_profile)
    topic_hint = ", ".join(scope_constraints.topics) if scope_constraints.topics else "all topics"

    return _DRAFT_GENERATION_TEMPLATE.format(
        question_count=generation_config.question_count,
        format_type=generation_config.format_type,
        difficulty=generation_config.difficulty or "match professor profile",
        question_types=", ".join(generation_config.question_types) or generation_config.format_type,
        topic_hint=topic_hint,
        custom_prompt=scope_constraints.custom_prompt or "none",
        schema_json=schema_json,
        profile_summary=profile_summary,
        evidence_blocks=evidence_blocks,
    )


def build_corrective_draft_prompt(
    *,
    original_prompt: str,
    validation_errors: list[str],
) -> str:
    error_list = "\n".join(f"- {error}" for error in validation_errors)
    return _CORRECTIVE_DRAFT_TEMPLATE.format(
        original_prompt=original_prompt,
        error_list=error_list,
    )


def build_novelty_rephrase_prompt(*, question_text: str, source_text: str) -> str:
    return _NOVELTY_REPHRASE_TEMPLATE.format(
        question_text=question_text,
        source_text=source_text,
    )


def build_difficulty_revision_prompt(
    *,
    question_json: str,
    requested_difficulty: str,
) -> str:
    return _DIFFICULTY_REVISION_TEMPLATE.format(
        question_json=question_json,
        requested_difficulty=requested_difficulty,
    )


def _format_evidence_blocks(chunks: list[RetrievedChunk]) -> str:
    blocks: list[str] = []
    for chunk in chunks:
        blocks.append(
            "\n".join([
                f"Chunk {chunk.rank}",
                f"- source_type: {chunk.source_type}",
                f"- upload_label: {chunk.upload_label or 'n/a'}",
                f"- topic_label: {chunk.topic_label or 'n/a'}",
                f"- chunk_type_label: {chunk.chunk_type_label}",
                f"- content: {_truncate(chunk.content)}",
            ])
        )
    return "\n\n".join(blocks)


def _format_profile_summary(profile: ProfessorProfileBase) -> str:
    topics = ", ".join(
        f"{t.topic_label} ({t.weight:.0%})" for t in profile.topic_distribution.topics
    )
    qtypes = ", ".join(
        f"{q.question_type} ({q.weight:.0%})" for q in profile.question_type_distribution.question_types
    )
    return (
        f"Topic emphasis: {topics}\n"
        f"Question types: {qtypes}\n"
        f"Difficulty: {profile.difficulty_profile.estimated_level}\n"
        f"Typical question count: {profile.exam_structure_profile.typical_question_count}"
    )


def _truncate(value: str, *, limit: int = 2200) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit - 3]}..."


_DRAFT_GENERATION_TEMPLATE = """You are an expert STEM exam question generator.

Generate exactly {question_count} questions for a {format_type} exam.
Requested difficulty: {difficulty}
Allowed question types: {question_types}
Topic focus: {topic_hint}
Custom instructions: {custom_prompt}

Return ONLY a valid JSON array of question objects. No markdown fences, no commentary.
Each object must match this schema exactly:
{schema_json}

Rules:
1. For MCQ questions, provide exactly 4 options (A, B, C, D) and set answer_key to the correct letter.
2. For FRQ/calculation/proof questions, options must be an empty list.
3. Each question must be novel — do not copy source material verbatim.
4. Vary the correct answer position across MCQ questions (do not always use A).
5. Distractors must be plausible, not obviously wrong.
6. Explanations must reference course concepts, not just restate the answer.

Professor Profile:
{profile_summary}

Retrieved Evidence:
{evidence_blocks}
"""

_CORRECTIVE_DRAFT_TEMPLATE = """The previous generation attempt had the following errors:
{error_list}

Please fix these issues and regenerate. Follow the original instructions exactly.

{original_prompt}
"""

_NOVELTY_REPHRASE_TEMPLATE = """The following question is too similar to its source material.
Rephrase it to test the same concept but with a substantially different framing,
different numbers, or a different scenario. Keep the same difficulty level and question type.

Return ONLY the rephrased question text. No commentary.

Original question:
{question_text}

Source material it is too similar to:
{source_text}
"""

_DIFFICULTY_REVISION_TEMPLATE = """The following questions need their difficulty adjusted to "{requested_difficulty}".
Revise each question to match the requested difficulty while keeping the same topic and question type.

Return ONLY a valid JSON array of revised question objects matching the original schema.
No markdown fences, no commentary.

Questions to revise:
{question_json}
"""
