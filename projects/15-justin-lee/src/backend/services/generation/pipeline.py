from __future__ import annotations

import json
import logging
import math
import random
from collections import Counter
from typing import Any, Protocol

from backend.models.generation import (
    DifficultyLabel,
    ExamMode,
    FormatType,
    GenerationConfig,
    ScopeConstraints,
)
from backend.models.professor_profile import ProfessorProfileBase
from backend.models.retrieval import RetrievedChunk
from backend.services.generation.exceptions import GenerationError
from backend.services.generation.models import DraftQuestion, FinalExamAssembly, FinalQuestion
from backend.services.generation.prompts import (
    build_corrective_draft_prompt,
    build_difficulty_revision_prompt,
    build_draft_generation_prompt,
    build_novelty_rephrase_prompt,
)

logger = logging.getLogger(__name__)

_NOVELTY_THRESHOLD = 0.92
_MISCALIBRATION_THRESHOLD = 0.20
_POSITION_IMBALANCE_THRESHOLD = 0.50
_MCQ_POSITIONS = ["A", "B", "C", "D"]


class GeminiCaller(Protocol):
    def call_gemini(self, *, prompt: str) -> str: ...


class EmbeddingComputer(Protocol):
    def compute_similarity(self, *, text_a: str, text_b: str) -> float: ...


def stage_1_draft(
    *,
    gemini: GeminiCaller,
    chunks: list[RetrievedChunk],
    professor_profile: ProfessorProfileBase,
    generation_config: GenerationConfig,
    scope_constraints: ScopeConstraints,
) -> tuple[list[DraftQuestion], str]:
    prompt = build_draft_generation_prompt(
        chunks=chunks,
        professor_profile=professor_profile,
        generation_config=generation_config,
        scope_constraints=scope_constraints,
    )
    raw_response = gemini.call_gemini(prompt=prompt)
    drafts = _parse_draft_response(raw_response)
    return drafts, prompt


def stage_2_validate(
    *,
    gemini: GeminiCaller,
    drafts: list[DraftQuestion],
    original_prompt: str,
    generation_config: GenerationConfig,
) -> list[DraftQuestion]:
    errors = _collect_validation_errors(drafts=drafts, generation_config=generation_config)
    if not errors:
        return drafts

    corrective_prompt = build_corrective_draft_prompt(
        original_prompt=original_prompt,
        validation_errors=errors,
    )
    raw_response = gemini.call_gemini(prompt=corrective_prompt)
    retry_drafts = _parse_draft_response(raw_response)

    retry_errors = _collect_validation_errors(drafts=retry_drafts, generation_config=generation_config)
    if retry_errors:
        raise GenerationError("Structure validation failed after 2 attempts")

    return retry_drafts


def stage_3_novelty(
    *,
    gemini: GeminiCaller,
    embedding: EmbeddingComputer,
    drafts: list[DraftQuestion],
    chunks: list[RetrievedChunk],
) -> list[DraftQuestion]:
    chunk_texts = [chunk.content for chunk in chunks]
    result: list[DraftQuestion] = []

    for draft in drafts:
        max_similarity = _max_chunk_similarity(
            embedding=embedding,
            question_text=draft.question_text,
            chunk_texts=chunk_texts,
        )
        logger.debug("Novelty score for question: %.4f", max_similarity)

        if max_similarity > _NOVELTY_THRESHOLD:
            rephrased = _rephrase_question(gemini=gemini, draft=draft, chunk_texts=chunk_texts)
            result.append(rephrased)
        else:
            result.append(draft)

    return result


def stage_4_difficulty(
    *,
    gemini: GeminiCaller,
    drafts: list[DraftQuestion],
    requested_difficulty: DifficultyLabel | None,
) -> list[DraftQuestion]:
    if requested_difficulty is None:
        return drafts

    miscalibrated = [d for d in drafts if d.difficulty_label != requested_difficulty]
    ratio = len(miscalibrated) / len(drafts) if drafts else 0.0

    if ratio <= _MISCALIBRATION_THRESHOLD:
        return drafts

    revised = _revise_difficulty(
        gemini=gemini,
        questions=miscalibrated,
        requested_difficulty=requested_difficulty,
    )
    revised_map = {q.question_text: q for q in revised}

    return [revised_map.get(d.question_text, d) if d in miscalibrated else d for d in drafts]


def stage_5_mcq_distribution(
    *,
    drafts: list[DraftQuestion],
    format_type: FormatType,
) -> list[DraftQuestion]:
    if format_type == "frq":
        return drafts

    mcq_drafts = [d for d in drafts if d.question_type == "mcq"]
    if not mcq_drafts:
        return drafts

    position_counts = Counter(d.answer_key.upper() for d in mcq_drafts if d.answer_key)
    total_mcq = len(mcq_drafts)

    over_represented = [
        pos for pos, count in position_counts.items()
        if count / total_mcq > _POSITION_IMBALANCE_THRESHOLD
    ]
    if not over_represented:
        return drafts

    return [_shuffle_mcq_options(d) if d.question_type == "mcq" and d.answer_key.upper() in over_represented else d for d in drafts]


def stage_6_assemble(
    *,
    drafts: list[DraftQuestion],
    exam_mode: ExamMode,
    format_type: FormatType,
    scope_constraints: ScopeConstraints,
    professor_profile: ProfessorProfileBase,
) -> FinalExamAssembly:
    ordered = _order_questions(drafts=drafts, format_type=format_type)
    title = _build_title(scope_constraints=scope_constraints, professor_profile=professor_profile)

    final_questions = [
        FinalQuestion(
            question_order=index,
            question_text=draft.question_text,
            question_type=draft.question_type,
            difficulty_label=draft.difficulty_label,
            topic_label=draft.topic_label,
            answer_key=draft.answer_key,
            explanation=draft.explanation,
            options=draft.options,
        )
        for index, draft in enumerate(ordered, start=1)
    ]

    return FinalExamAssembly(
        title=title,
        exam_mode=exam_mode,
        format_type=format_type,
        questions=final_questions,
    )


# --- Internal helpers ---


def _parse_draft_response(raw_response: str) -> list[DraftQuestion]:
    try:
        data: Any = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise GenerationError("Gemini returned invalid JSON for draft generation") from exc

    if not isinstance(data, list):
        raise GenerationError("Gemini response is not a JSON array")

    return [DraftQuestion.model_validate(item) for item in data]


def _collect_validation_errors(
    *,
    drafts: list[DraftQuestion],
    generation_config: GenerationConfig,
) -> list[str]:
    errors: list[str] = []
    expected = generation_config.question_count
    actual = len(drafts)

    if abs(actual - expected) > 1:
        errors.append(f"Expected {expected} questions, got {actual}")

    if generation_config.format_type == "mcq":
        non_mcq = [d for d in drafts if d.question_type != "mcq"]
        if non_mcq:
            errors.append(f"{len(non_mcq)} questions are not MCQ but format_type is mcq")

    if generation_config.format_type == "frq":
        non_frq = [d for d in drafts if d.question_type not in ("frq", "calculation", "proof")]
        if non_frq:
            errors.append(f"{len(non_frq)} questions are MCQ but format_type is frq")

    for i, draft in enumerate(drafts):
        if not draft.question_text.strip():
            errors.append(f"Question {i + 1} has empty question_text")
        if not draft.answer_key.strip():
            errors.append(f"Question {i + 1} has empty answer_key")

    return errors


def _max_chunk_similarity(
    *,
    embedding: EmbeddingComputer,
    question_text: str,
    chunk_texts: list[str],
) -> float:
    if not chunk_texts:
        return 0.0
    return max(
        embedding.compute_similarity(text_a=question_text, text_b=ct)
        for ct in chunk_texts
    )


def _rephrase_question(
    *,
    gemini: GeminiCaller,
    draft: DraftQuestion,
    chunk_texts: list[str],
) -> DraftQuestion:
    source_text = chunk_texts[0] if chunk_texts else ""
    prompt = build_novelty_rephrase_prompt(
        question_text=draft.question_text,
        source_text=source_text,
    )
    rephrased_text = gemini.call_gemini(prompt=prompt).strip()
    return draft.model_copy(update={"question_text": rephrased_text})


def _revise_difficulty(
    *,
    gemini: GeminiCaller,
    questions: list[DraftQuestion],
    requested_difficulty: str,
) -> list[DraftQuestion]:
    questions_json = json.dumps(
        [q.model_dump() for q in questions], indent=2
    )
    prompt = build_difficulty_revision_prompt(
        question_json=questions_json,
        requested_difficulty=requested_difficulty,
    )
    raw_response = gemini.call_gemini(prompt=prompt)
    return _parse_draft_response(raw_response)


def _shuffle_mcq_options(draft: DraftQuestion) -> DraftQuestion:
    if len(draft.options) != 4 or not draft.answer_key:
        return draft

    current_index = _MCQ_POSITIONS.index(draft.answer_key.upper()) if draft.answer_key.upper() in _MCQ_POSITIONS else None
    if current_index is None:
        return draft

    correct_option = draft.options[current_index]
    shuffled = draft.options[:]
    random.shuffle(shuffled)
    new_index = shuffled.index(correct_option)
    new_key = _MCQ_POSITIONS[new_index]

    return draft.model_copy(update={"options": shuffled, "answer_key": new_key})


def _order_questions(*, drafts: list[DraftQuestion], format_type: FormatType) -> list[DraftQuestion]:
    if format_type != "mixed":
        return drafts

    mcq = [d for d in drafts if d.question_type == "mcq"]
    non_mcq = [d for d in drafts if d.question_type != "mcq"]
    return mcq + non_mcq


def _build_title(
    *,
    scope_constraints: ScopeConstraints,
    professor_profile: ProfessorProfileBase,
) -> str:
    if scope_constraints.topics:
        topic_str = ", ".join(scope_constraints.topics[:3])
        return f"Practice: {topic_str}"

    top_topics = sorted(
        professor_profile.topic_distribution.topics,
        key=lambda t: t.weight,
        reverse=True,
    )[:3]
    topic_str = ", ".join(t.topic_label for t in top_topics)
    return f"Practice: {topic_str}"
