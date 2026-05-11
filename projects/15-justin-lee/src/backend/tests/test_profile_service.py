from __future__ import annotations

import datetime as dt
from types import SimpleNamespace
from uuid import UUID, uuid4

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
from backend.models.retrieval import AppliedRetrievalFilters, RetrievalResponse, RetrievedChunk
from backend.services.professor_profile.profile_service import ProfessorProfileService


class FakeTableQuery:
    def __init__(self, tables: dict[str, list[dict[str, object]]], table_name: str) -> None:
        self._tables = tables
        self._table_name = table_name
        self._operation = "select"
        self._payload: dict[str, object] | None = None
        self._filters: list[tuple[str, object]] = []
        self._limit: int | None = None

    def select(self, _: str, count: str | None = None) -> FakeTableQuery:
        self._operation = "select"
        self._count = count
        return self

    def insert(self, payload: dict[str, object]) -> FakeTableQuery:
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, object]) -> FakeTableQuery:
        self._operation = "update"
        self._payload = payload
        return self

    def eq(self, field: str, value: object) -> FakeTableQuery:
        self._filters.append((field, value))
        return self

    def limit(self, value: int) -> FakeTableQuery:
        self._limit = value
        return self

    def execute(self) -> SimpleNamespace:
        if self._operation == "select":
            rows = [row.copy() for row in self._matching_rows()]
            if self._limit is not None:
                rows = rows[: self._limit]
            response = SimpleNamespace(data=rows)
            if getattr(self, "_count", None) == "exact":
                response.count = len(rows)
            return response

        if self._operation == "insert":
            payload = dict(self._payload or {})
            timestamp = dt.datetime.now(dt.UTC).isoformat()
            payload.setdefault("created_at", timestamp)
            payload.setdefault("updated_at", timestamp)
            self._tables[self._table_name].append(payload)
            return SimpleNamespace(data=[payload.copy()])

        if self._operation == "update":
            timestamp = dt.datetime.now(dt.UTC).isoformat()
            updated_rows: list[dict[str, object]] = []
            for row in self._matching_rows():
                row.update(self._payload or {})
                row["updated_at"] = timestamp
                updated_rows.append(row.copy())
            return SimpleNamespace(data=updated_rows)

        raise AssertionError(f"Unsupported operation: {self._operation}")

    def _matching_rows(self) -> list[dict[str, object]]:
        return [
            row
            for row in self._tables.setdefault(self._table_name, [])
            if all(row.get(field) == value for field, value in self._filters)
        ]


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, object]]]) -> None:
        self._tables = tables

    def table(self, name: str) -> FakeTableQuery:
        self._tables.setdefault(name, [])
        return FakeTableQuery(self._tables, name)

    @property
    def tables(self) -> dict[str, list[dict[str, object]]]:
        return self._tables


class FakeRetrievalService:
    def __init__(self, response: RetrievalResponse) -> None:
        self.response = response

    def retrieve_for_profile_generation(self, request) -> RetrievalResponse:
        return self.response


class FakeLlmClient:
    def __init__(self, profile: ProfessorProfileBase) -> None:
        self.profile = profile

    def generate_profile(self, *, workspace, retrieval) -> ProfessorProfileBase:
        return self.profile


def test_generate_profile_persists_current_and_version_rows() -> None:
    user_id = uuid4()
    workspace_id = uuid4()
    supabase = FakeSupabase(
        {
            "workspaces": [
                {
                    "id": str(workspace_id),
                    "user_id": str(user_id),
                    "title": "AMS 310 Midterm Prep",
                    "course_code": "AMS 310",
                    "description": "Midterm review",
                    "created_at": dt.datetime.now(dt.UTC).isoformat(),
                    "updated_at": dt.datetime.now(dt.UTC).isoformat(),
                }
            ],
            "professor_profiles": [],
            "professor_profile_versions": [],
        }
    )

    retrieval = _sample_retrieval_response(workspace_id=workspace_id)
    llm_profile = _sample_llm_profile(
        retrieval_query=retrieval.query_text,
        document_ids=[chunk.document_id for chunk in retrieval.results],
        chunk_ids=[chunk.chunk_id for chunk in retrieval.results],
    )
    service = ProfessorProfileService(
        supabase,
        retrieval_service=FakeRetrievalService(retrieval),
        llm_client=FakeLlmClient(llm_profile),
    )

    response = service.generate(user_id=user_id, workspace_id=workspace_id)

    assert response.workspace_id == workspace_id
    assert response.version == 1
    assert response.evidence_summary.total_documents == 2
    assert response.evidence_summary.total_chunks == 2
    assert len(supabase.tables["professor_profiles"]) == 1
    assert len(supabase.tables["professor_profile_versions"]) == 1
    assert (
        supabase.tables["professor_profile_versions"][0]["professor_profile_id"]
        == supabase.tables["professor_profiles"][0]["id"]
    )


def test_generate_profile_increments_version_for_existing_profile() -> None:
    user_id = uuid4()
    workspace_id = uuid4()
    profile_id = uuid4()
    timestamp = dt.datetime.now(dt.UTC).isoformat()
    existing_profile = {
        "id": str(profile_id),
        "workspace_id": str(workspace_id),
        "version": 1,
        **_sample_llm_profile_dict(workspace_id=workspace_id),
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    supabase = FakeSupabase(
        {
            "workspaces": [
                {
                    "id": str(workspace_id),
                    "user_id": str(user_id),
                    "title": "PHY 131",
                    "course_code": "PHY 131",
                    "description": None,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                }
            ],
            "professor_profiles": [existing_profile],
            "professor_profile_versions": [],
        }
    )
    retrieval = _sample_retrieval_response(workspace_id=workspace_id)
    llm_profile = _sample_llm_profile(
        retrieval_query=retrieval.query_text,
        document_ids=[chunk.document_id for chunk in retrieval.results],
        chunk_ids=[chunk.chunk_id for chunk in retrieval.results],
    )
    service = ProfessorProfileService(
        supabase,
        retrieval_service=FakeRetrievalService(retrieval),
        llm_client=FakeLlmClient(llm_profile),
    )

    response = service.generate(user_id=user_id, workspace_id=workspace_id)

    assert response.version == 2
    assert len(supabase.tables["professor_profile_versions"]) == 1
    assert supabase.tables["professor_profiles"][0]["version"] == 2


def _sample_retrieval_response(*, workspace_id: UUID) -> RetrievalResponse:
    document_a = uuid4()
    document_b = uuid4()
    return RetrievalResponse(
        task_type="profile_generation",
        query_text="professor assessment style, exam structure, emphasized topics, representative course evidence",
        applied_filters=AppliedRetrievalFilters(workspace_id=workspace_id),
        results=[
            RetrievedChunk(
                chunk_id=uuid4(),
                document_id=document_a,
                workspace_id=workspace_id,
                source_type="prior_exam",
                upload_label="Midterm 1",
                position=0,
                chunk_type_label="problem",
                topic_label="Hypothesis Testing",
                content="A prior exam problem on p-values and rejection regions.",
                similarity_score=0.9,
                weighted_score=1.2,
                rank=1,
            ),
            RetrievedChunk(
                chunk_id=uuid4(),
                document_id=document_b,
                workspace_id=workspace_id,
                source_type="lecture_slides",
                upload_label="Week 5 Slides",
                position=1,
                chunk_type_label="section",
                topic_label="Confidence Intervals",
                content="Lecture slides discussing confidence intervals and interpretation.",
                similarity_score=0.8,
                weighted_score=0.76,
                rank=2,
            ),
        ],
    )


def _sample_llm_profile(
    *,
    retrieval_query: str,
    document_ids: list[UUID],
    chunk_ids: list[UUID],
) -> ProfessorProfileBase:
    return ProfessorProfileBase(
        topic_distribution=TopicDistribution(
            summary="Testing and interval estimation dominate the evidence.",
            topics=[
                TopicWeight(
                    topic_label="Hypothesis Testing",
                    weight=0.6,
                    evidence_strength="high",
                    rationale="Prior exam evidence directly emphasizes hypothesis testing.",
                ),
                TopicWeight(
                    topic_label="Confidence Intervals",
                    weight=0.4,
                    evidence_strength="medium",
                    rationale="Lecture slides reinforce interval construction and interpretation.",
                ),
            ],
        ),
        question_type_distribution=QuestionTypeDistribution(
            summary="The instructor leans toward worked quantitative assessment formats.",
            question_types=[
                QuestionTypeWeight(
                    question_type="frq",
                    weight=0.7,
                    evidence_strength="high",
                    rationale="The retrieved exam material is free-response.",
                ),
                QuestionTypeWeight(
                    question_type="calculation",
                    weight=0.3,
                    evidence_strength="medium",
                    rationale="The evidence expects students to compute and justify results.",
                ),
            ],
        ),
        difficulty_profile=DifficultyProfile(
            estimated_level="moderate-hard",
            confidence="medium",
            calculation_intensity=DifficultyAxis(
                level="high",
                rationale="Students are expected to compute test statistics and intervals.",
            ),
            conceptual_intensity=DifficultyAxis(
                level="moderate",
                rationale="Interpretation matters, but the evidence is still quantitatively oriented.",
            ),
            multi_step_reasoning=DifficultyAxis(
                level="high",
                rationale="The exam evidence combines setup, computation, and interpretation.",
            ),
            time_pressure=DifficultyAxis(
                level="moderate",
                rationale="Problems appear moderately dense but not unusually long.",
            ),
            summary="The professor tends to assign multi-step quantitative problems at a moderate-hard level.",
        ),
        exam_structure_profile=ExamStructureProfile(
            minimum_question_count=6,
            typical_question_count=8,
            maximum_question_count=10,
            section_patterns=["Short conceptual items followed by longer calculations."],
            tendency_notes=["Prefers multi-part free-response questions on major assessment topics."],
            answer_format_expectations=["Show setup, calculation, and interpretation."],
            summary="Assessments appear to blend concise conceptual checks with longer worked solutions.",
        ),
        evidence_summary=EvidenceSummary(
            total_documents=max(len(set(document_ids)), 1),
            total_chunks=max(len(chunk_ids), 1),
            source_counts=[
                SourceEvidenceCount(
                    source_type="prior_exam",
                    document_count=1,
                    chunk_count=1,
                )
            ],
            retrieved_document_ids=document_ids[:1] or [uuid4()],
            retrieved_chunk_ids=chunk_ids[:1] or [uuid4()],
            retrieval_query=retrieval_query,
            evidence_characterization="The evidence is strongest for assessment format and moderately strong for topical emphasis.",
        ),
    )


def _sample_llm_profile_dict(*, workspace_id: UUID) -> dict[str, object]:
    retrieval = _sample_retrieval_response(workspace_id=workspace_id)
    profile = _sample_llm_profile(
        retrieval_query=retrieval.query_text,
        document_ids=[chunk.document_id for chunk in retrieval.results],
        chunk_ids=[chunk.chunk_id for chunk in retrieval.results],
    )
    return profile.model_dump(mode="json")
