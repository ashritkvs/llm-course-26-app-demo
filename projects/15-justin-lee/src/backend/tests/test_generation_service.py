from __future__ import annotations

import json
from uuid import UUID, uuid4

import pytest

from backend.models.generation import GenerationConfig, ScopeConstraints
from backend.models.professor_profile import (
    DifficultyAxis,
    DifficultyProfile,
    EvidenceSummary,
    ExamStructureProfile,
    ProfessorProfileBase,
    QuestionTypeDistribution,
    QuestionTypeWeight,
    SourceEvidenceCount,
    TopicDistribution,
    TopicWeight,
)
from backend.models.retrieval import (
    AppliedRetrievalFilters,
    QuestionGenerationRetrievalRequest,
    RetrievalResponse,
    RetrievedChunk,
)
from backend.services.generation.exceptions import GenerationError
from backend.services.generation.models import FinalExamAssembly
from backend.services.generation.service import GenerationService


# --- Fixtures ---


def _make_chunk(*, rank: int = 1, content: str = "Sample chunk content") -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid4(),
        document_id=uuid4(),
        workspace_id=uuid4(),
        source_type="prior_exam",
        position=rank,
        chunk_type_label="problem",
        topic_label="calculus",
        content=content,
        similarity_score=0.85,
        weighted_score=1.1,
        rank=rank,
    )


def _make_mcq_draft(
    *,
    question_text: str = "What is 2+2?",
    answer_key: str = "A",
    difficulty_label: str = "moderate",
    topic_label: str = "arithmetic",
) -> dict[str, object]:
    return {
        "question_text": question_text,
        "question_type": "mcq",
        "difficulty_label": difficulty_label,
        "topic_label": topic_label,
        "answer_key": answer_key,
        "explanation": "Basic addition yields 4.",
        "options": ["4", "3", "5", "6"],
    }


def _make_profile() -> ProfessorProfileBase:
    return ProfessorProfileBase(
        topic_distribution=TopicDistribution(
            summary="Focus on calculus and algebra.",
            topics=[
                TopicWeight(topic_label="Calculus", weight=0.6, evidence_strength="high", rationale="Emphasized in exams"),
                TopicWeight(topic_label="Algebra", weight=0.4, evidence_strength="medium", rationale="Seen in homework"),
            ],
        ),
        question_type_distribution=QuestionTypeDistribution(
            summary="Mostly MCQ.",
            question_types=[
                QuestionTypeWeight(question_type="mcq", weight=0.7, evidence_strength="high", rationale="Prior exams"),
                QuestionTypeWeight(question_type="frq", weight=0.3, evidence_strength="medium", rationale="Homework"),
            ],
        ),
        difficulty_profile=DifficultyProfile(
            estimated_level="moderate",
            confidence="medium",
            calculation_intensity=DifficultyAxis(level="moderate", rationale="Moderate calculations"),
            conceptual_intensity=DifficultyAxis(level="moderate", rationale="Moderate concepts"),
            multi_step_reasoning=DifficultyAxis(level="moderate", rationale="Some multi-step"),
            time_pressure=DifficultyAxis(level="moderate", rationale="Standard time"),
            summary="Moderate difficulty overall.",
        ),
        exam_structure_profile=ExamStructureProfile(
            minimum_question_count=5,
            typical_question_count=10,
            maximum_question_count=15,
            tendency_notes=["Mix of MCQ and FRQ"],
            summary="Standard exam structure.",
        ),
        evidence_summary=EvidenceSummary(
            total_documents=2,
            total_chunks=3,
            source_counts=[SourceEvidenceCount(source_type="prior_exam", document_count=1, chunk_count=2)],
            retrieval_query="calculus exam content",
            evidence_characterization="Moderate evidence from prior exams.",
        ),
    )


def _make_generation_config(
    *,
    question_count: int = 5,
    format_type: str = "mcq",
    difficulty: str | None = None,
) -> GenerationConfig:
    return GenerationConfig(
        question_count=question_count,
        format_type=format_type,
        difficulty=difficulty,
    )


def _make_scope() -> ScopeConstraints:
    return ScopeConstraints(topics=["Calculus"])


class FakeRetrieval:
    def __init__(self, chunks: list[RetrievedChunk]) -> None:
        self._chunks = chunks

    def retrieve_for_question_generation(
        self, request: QuestionGenerationRetrievalRequest
    ) -> RetrievalResponse:
        return RetrievalResponse(
            task_type="question_generation",
            query_text="calculus",
            applied_filters=AppliedRetrievalFilters(workspace_id=request.workspace_id),
            results=self._chunks,
        )


class FakeGemini:
    def __init__(self, responses: list[str]) -> None:
        self._responses = list(responses)
        self._call_count = 0
        self.calls: list[str] = []

    def call_gemini(self, *, prompt: str) -> str:
        self.calls.append(prompt)
        index = min(self._call_count, len(self._responses) - 1)
        self._call_count += 1
        return self._responses[index]


class FakeEmbedding:
    def __init__(self, similarity: float = 0.5) -> None:
        self._similarity = similarity

    def compute_similarity(self, *, text_a: str, text_b: str) -> float:
        return self._similarity


# --- Tests ---


def test_draft_generation_success() -> None:
    chunks = [_make_chunk(rank=i) for i in range(1, 4)]
    drafts = [_make_mcq_draft(question_text=f"Q{i}?") for i in range(1, 6)]
    gemini = FakeGemini([json.dumps(drafts)])
    retrieval = FakeRetrieval(chunks)
    embedding = FakeEmbedding(similarity=0.3)

    service = GenerationService(
        retrieval_service=retrieval,
        gemini_caller=gemini,
        embedding_computer=embedding,
    )

    result = service.run_pipeline(
        generation_config=_make_generation_config(),
        scope_constraints=_make_scope(),
        workspace_id=uuid4(),
        professor_profile=_make_profile(),
    )

    assert isinstance(result, FinalExamAssembly)
    assert len(result.questions) == 5
    assert [q.question_order for q in result.questions] == [1, 2, 3, 4, 5]


def test_structure_validation_retries_on_wrong_count() -> None:
    chunks = [_make_chunk(rank=1)]
    wrong_drafts = [_make_mcq_draft(question_text=f"Q{i}?") for i in range(1, 4)]
    correct_drafts = [_make_mcq_draft(question_text=f"Q{i}?") for i in range(1, 6)]

    gemini = FakeGemini([json.dumps(wrong_drafts), json.dumps(correct_drafts)])
    retrieval = FakeRetrieval(chunks)
    embedding = FakeEmbedding(similarity=0.3)

    service = GenerationService(
        retrieval_service=retrieval,
        gemini_caller=gemini,
        embedding_computer=embedding,
    )

    result = service.run_pipeline(
        generation_config=_make_generation_config(),
        scope_constraints=_make_scope(),
        workspace_id=uuid4(),
        professor_profile=_make_profile(),
    )

    assert len(result.questions) == 5
    assert gemini._call_count >= 2


def test_structure_validation_raises_after_two_failures() -> None:
    chunks = [_make_chunk(rank=1)]
    wrong_drafts = [_make_mcq_draft(question_text=f"Q{i}?") for i in range(1, 3)]

    gemini = FakeGemini([json.dumps(wrong_drafts), json.dumps(wrong_drafts)])
    retrieval = FakeRetrieval(chunks)
    embedding = FakeEmbedding(similarity=0.3)

    service = GenerationService(
        retrieval_service=retrieval,
        gemini_caller=gemini,
        embedding_computer=embedding,
    )

    with pytest.raises(GenerationError, match="Structure validation failed"):
        service.run_pipeline(
            generation_config=_make_generation_config(),
            scope_constraints=_make_scope(),
            workspace_id=uuid4(),
            professor_profile=_make_profile(),
        )


def test_novelty_check_triggers_rephrase() -> None:
    """Novelty check rephrases questions that are too similar to source chunks."""
    chunks = [_make_chunk(rank=1, content="What is the derivative of x^2?")]
    # Provide 3 drafts to satisfy question_count=3; the first is verbatim from the chunk
    drafts = [
        _make_mcq_draft(question_text="What is the derivative of x^2?"),
        _make_mcq_draft(question_text="Evaluate the integral of sin(x)."),
        _make_mcq_draft(question_text="Apply the chain rule to f(g(x))."),
    ]
    rephrased_response = "Find the rate of change of x squared."

    gemini = FakeGemini([json.dumps(drafts), rephrased_response])
    retrieval = FakeRetrieval(chunks)

    # High similarity only for the verbatim question; others pass novelty check
    class _SelectiveEmbedding:
        def compute_similarity(self, *, text_a: str, text_b: str) -> float:
            if "derivative" in text_a and "derivative" in text_b:
                return 0.95
            return 0.2

    service = GenerationService(
        retrieval_service=retrieval,
        gemini_caller=gemini,
        embedding_computer=_SelectiveEmbedding(),
    )

    result = service.run_pipeline(
        generation_config=_make_generation_config(question_count=3),
        scope_constraints=_make_scope(),
        workspace_id=uuid4(),
        professor_profile=_make_profile(),
    )

    assert result.questions[0].question_text != "What is the derivative of x^2?"
    assert gemini._call_count >= 2


def test_mcq_position_distribution_correction() -> None:
    drafts = [_make_mcq_draft(question_text=f"Q{i}?", answer_key="A") for i in range(1, 11)]
    chunks = [_make_chunk(rank=1)]

    gemini = FakeGemini([json.dumps(drafts)])
    retrieval = FakeRetrieval(chunks)
    embedding = FakeEmbedding(similarity=0.3)

    service = GenerationService(
        retrieval_service=retrieval,
        gemini_caller=gemini,
        embedding_computer=embedding,
    )

    result = service.run_pipeline(
        generation_config=_make_generation_config(question_count=10),
        scope_constraints=_make_scope(),
        workspace_id=uuid4(),
        professor_profile=_make_profile(),
    )

    a_count = sum(1 for q in result.questions if q.answer_key.upper() == "A")
    assert a_count <= 5


def test_difficulty_calibration_calls_revision() -> None:
    hard_drafts = [_make_mcq_draft(question_text=f"Q{i}?", difficulty_label="hard") for i in range(1, 5)]
    easy_draft = [_make_mcq_draft(question_text="Q5?", difficulty_label="easy")]
    all_drafts = hard_drafts + easy_draft

    revised_drafts = [_make_mcq_draft(question_text=f"Q{i} revised?", difficulty_label="easy") for i in range(1, 5)]

    gemini = FakeGemini([json.dumps(all_drafts), json.dumps(revised_drafts)])
    chunks = [_make_chunk(rank=1)]
    retrieval = FakeRetrieval(chunks)
    embedding = FakeEmbedding(similarity=0.3)

    service = GenerationService(
        retrieval_service=retrieval,
        gemini_caller=gemini,
        embedding_computer=embedding,
    )

    result = service.run_pipeline(
        generation_config=_make_generation_config(difficulty="easy"),
        scope_constraints=_make_scope(),
        workspace_id=uuid4(),
        professor_profile=_make_profile(),
    )

    assert gemini._call_count >= 2
    assert len(result.questions) == 5
