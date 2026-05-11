from __future__ import annotations

import logging
from uuid import UUID, uuid4

from supabase import Client

from backend.config.settings import Settings
from backend.models.errors import NotFoundError
from backend.models.generation import GenerationConfig, ScopeConstraints
from backend.models.professor_profile import ProfessorProfileBase
from backend.services.generation.models import FinalExamAssembly
from backend.services.generation.service import build_generation_service

logger = logging.getLogger(__name__)


class RegenerationService:
    """Builds generation configs biased toward targeted weak concepts."""

    @staticmethod
    def build_scoped_config(
        target_concepts: list[str],
        question_count: int,
        format_type: str,
    ) -> tuple[GenerationConfig, ScopeConstraints]:
        """Return a GenerationConfig + ScopeConstraints focused on weak concepts."""
        concepts_str = ", ".join(target_concepts)
        custom_prompt = (
            f"Focus exclusively on these weak concepts: {concepts_str}. "
            "Generate practice problems that directly address the student's identified weaknesses."
        )
        return (
            GenerationConfig(question_count=question_count, format_type=format_type),
            ScopeConstraints(topics=target_concepts, custom_prompt=custom_prompt),
        )


# ---------------------------------------------------------------------------
# Background job — module-level so FastAPI BackgroundTasks can call it
# ---------------------------------------------------------------------------


def run_regeneration_pipeline(
    *,
    supabase: Client,
    settings: Settings,
    workspace_id: str,
    regen_request_id: str,
    target_concepts: list[str],
    question_count: int,
    format_type: str,
) -> None:
    """Run the targeted generation pipeline and link the result to a regeneration request.

    Reuses GenerationService.run_pipeline() entirely — the only difference from a
    normal generation job is that target_concepts drive the scope constraints.
    """
    try:
        supabase.table("regeneration_requests").update(
            {"request_status": "running"}
        ).eq("id", regen_request_id).execute()

        professor_profile = _load_professor_profile(supabase, workspace_id)

        generation_config, scope_constraints = RegenerationService.build_scoped_config(
            target_concepts=target_concepts,
            question_count=question_count,
            format_type=format_type,
        )

        generation_service = build_generation_service(settings=settings)
        assembly = generation_service.run_pipeline(
            generation_config=generation_config,
            scope_constraints=scope_constraints,
            workspace_id=UUID(workspace_id),
            professor_profile=professor_profile,
            exam_mode="targeted_practice",
        )

        exam_id = _persist_targeted_exam(
            supabase=supabase,
            workspace_id=workspace_id,
            generation_config=generation_config,
            scope_constraints=scope_constraints,
            assembly=assembly,
        )

        supabase.table("regeneration_requests").update({
            "request_status": "completed",
            "generated_exam_id": exam_id,
        }).eq("id", regen_request_id).execute()

        logger.info(
            "Regeneration request %s completed — exam %s created", regen_request_id, exam_id
        )

    except Exception as exc:
        logger.error(
            "Regeneration pipeline failed for request %s with %s",
            regen_request_id,
            exc.__class__.__name__,
        )
        supabase.table("regeneration_requests").update(
            {"request_status": "failed"}
        ).eq("id", regen_request_id).execute()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_professor_profile(supabase: Client, workspace_id: str) -> ProfessorProfileBase:
    resp = (
        supabase.table("professor_profiles")
        .select("*")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise NotFoundError(f"Professor profile not found for workspace {workspace_id}")
    return ProfessorProfileBase.model_validate(resp.data[0])


def _persist_targeted_exam(
    supabase: Client,
    workspace_id: str,
    generation_config: GenerationConfig,
    scope_constraints: ScopeConstraints,
    assembly: FinalExamAssembly,
) -> str:
    """Write generation_requests + generated_exams + generated_questions rows.

    A generation_requests row is required because generated_exams.generation_request_id
    is a NOT NULL FK. We create it with request_type='targeted_regeneration' to make
    the provenance visible in the DB.
    """
    gen_request_id = str(uuid4())
    supabase.table("generation_requests").insert({
        "id": gen_request_id,
        "workspace_id": workspace_id,
        "request_type": "targeted_regeneration",
        "scope_constraints": scope_constraints.model_dump(mode="json"),
        "generation_config": generation_config.model_dump(mode="json"),
        "status": "completed",
    }).execute()

    exam_id = str(uuid4())
    supabase.table("generated_exams").insert({
        "id": exam_id,
        "generation_request_id": gen_request_id,
        "workspace_id": workspace_id,
        "title": assembly.title,
        "exam_mode": assembly.exam_mode,
        "format_type": assembly.format_type,
    }).execute()

    question_payloads = [
        {
            "id": str(uuid4()),
            "generated_exam_id": exam_id,
            "question_order": q.question_order,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "difficulty_label": q.difficulty_label,
            "topic_label": q.topic_label,
            "answer_key": q.answer_key,
            "explanation": q.explanation,
            "options": q.options,
        }
        for q in assembly.questions
    ]
    if question_payloads:
        supabase.table("generated_questions").insert(question_payloads).execute()

    return exam_id
