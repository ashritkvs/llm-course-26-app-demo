from typing import Any, Dict, List
import logging

from app.schemas.workout import (
    BurnoutState,
    WorkoutExercise,
    WorkoutPlan,
    WorkoutRequest,
    WorkoutResponse,
    WorkoutSection,
)
from app.services.ai_claude import get_workout_plan


logger = logging.getLogger(__name__)


def _fallback_burnout_level(burnout_state: BurnoutState | None, override_level: str | None = None) -> str:
    valid_levels = {"Low", "Moderate", "High", "Critical"}
    if override_level in valid_levels:
        return override_level
    if burnout_state and burnout_state.level in valid_levels:
        return burnout_state.level
    return "Low"


def _build_fallback_plan(payload: WorkoutRequest) -> WorkoutPlan:
    """Simple deterministic guardrail plan if Claude is unavailable."""

    level = _fallback_burnout_level(payload.burnout_state, payload.override_burnout_level)
    base_title = f"{payload.muscle_group or 'Workout'} ({payload.difficulty})"
    title_prefix = {
        "Low": "Standard",
        "Moderate": "Light",
        "High": "Deload",
        "Critical": "Recovery",
    }[level]

    # Minimal sectioned structure; frontend already has richer logic and will treat this as fallback.
    warmup = WorkoutSection(
        title="Warm-up",
        exercises=[
            WorkoutExercise(
                name="easy march in place",
                sets=1,
                reps="45 sec",
                rest="15 sec",
                notes="Keep it comfortable; you should be able to talk.",
            )
        ],
    )

    main_sets = 3 if level in {"Low", "Moderate"} else 2
    main_reps = "10–12" if level == "Low" else "8–10"

    main = WorkoutSection(
        title="Main workout",
        exercises=[
            WorkoutExercise(
                name="bodyweight squat",
                sets=main_sets,
                reps=main_reps,
                rest="60 sec",
                notes="Move with control and stop before form breaks.",
            ),
            WorkoutExercise(
                name="push-up (incline if needed)",
                sets=main_sets,
                reps=main_reps,
                rest="60 sec",
                notes="Leave 1–2 reps in reserve.",
            ),
        ],
    )

    cooldown = WorkoutSection(
        title="Cooldown",
        exercises=[
            WorkoutExercise(
                name="child pose breathing",
                sets=1,
                reps="45–60 sec",
                rest="—",
                notes="Slow your breathing and relax shoulders.",
            )
        ],
    )

    adaptation_reason = {
        "Low": "Normal session with steady effort.",
        "Moderate": "Slightly reduced volume to respect moderate burnout.",
        "High": "Simplified session with lower total work due to high burnout.",
        "Critical": "Gentle, recovery-focused movement only.",
    }[level]

    return WorkoutPlan(
        title=f"{title_prefix} {base_title}",
        duration_minutes=payload.duration_minutes,
        adaptation_reason=adaptation_reason,
        sections=[warmup, main, cooldown],
    )


def _safe_parse_ai_plan(raw: Dict[str, Any], fallback: WorkoutPlan) -> WorkoutPlan:
    """Validate and coerce Claude's response into a WorkoutPlan, or fall back."""

    try:
        title = str(raw.get("title") or fallback.title)

        # Support both camelCase and snake_case for duration/adaptation keys.
        duration_val = raw.get("durationMinutes")
        if duration_val is None:
            duration_val = raw.get("duration_minutes")
        duration_minutes = int(duration_val or fallback.duration_minutes)

        reason_val = raw.get("adaptationReason")
        if reason_val is None:
            reason_val = raw.get("adaptation_reason")
        adaptation_reason = str(reason_val or fallback.adaptation_reason)

        sections_candidate = raw.get("sections") or []
        # Ensure sections are a list of dicts.
        sections_raw: List[Dict[str, Any]] = sections_candidate if isinstance(sections_candidate, list) else []
        sections: List[WorkoutSection] = []
        for section in sections_raw[:6]:  # simple guardrail
            sec_title = str(section.get("title") or "Section")
            exercises_raw = section.get("exercises") or []
            exercises: List[WorkoutExercise] = []
            for ex in exercises_raw[:8]:
                try:
                    exercises.append(
                        WorkoutExercise(
                            name=str(ex.get("name") or "Exercise"),
                            sets=int(ex.get("sets") or 1),
                            reps=str(ex.get("reps") or "8–10"),
                            rest=str(ex.get("rest") or "60 sec"),
                            notes=str(ex.get("notes")) if ex.get("notes") is not None else None,
                        )
                    )
                except Exception:
                    continue
            if exercises:
                sections.append(WorkoutSection(title=sec_title, exercises=exercises))

        if not sections:
            return fallback

        return WorkoutPlan(
            title=title,
            duration_minutes=duration_minutes,
            adaptation_reason=adaptation_reason,
            sections=sections,
        )
    except Exception:  # pragma: no cover - defensive
        return fallback


def generate_workout(payload: WorkoutRequest) -> WorkoutResponse:
    level = _fallback_burnout_level(payload.burnout_state, payload.override_burnout_level)
    base_plan = _build_fallback_plan(payload)

    logger.debug(
        "Workout generation burnout debug | override=%s, burnout_state=%s, resolved=%s",
        payload.override_burnout_level,
        payload.burnout_state.level if payload.burnout_state else None,
        level,
    )

    context: Dict[str, Any] = {
        "muscleGroup": payload.muscle_group,
        "durationMinutes": payload.duration_minutes,
        "difficulty": payload.difficulty,
        "equipment": payload.equipment,
        "burnout": payload.burnout_state.model_dump() if payload.burnout_state else None,
        "overrideBurnoutLevel": payload.override_burnout_level,
        "resolvedBurnoutLevel": level,
        "onboarding": payload.onboarding.model_dump() if payload.onboarding else None,
        "basePlan": payload.base_plan or {},
    }

    ai_result = get_workout_plan(context)
    if ai_result and isinstance(ai_result, dict):
        plan = _safe_parse_ai_plan(ai_result, base_plan)
        source = "ai"
    else:
        plan = base_plan
        source = "fallback"

    return WorkoutResponse(plan=plan, used_burnout_level=level, source=source)
