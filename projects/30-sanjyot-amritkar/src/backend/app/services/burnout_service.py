from typing import List

from app.schemas.burnout import BurnoutCheckin, BurnoutRequest, BurnoutResponse
from app.services.ai_claude import get_burnout_insights


def _compute_risk_score(entry: BurnoutCheckin) -> float:
    return (
        entry.stress
        + (6 - entry.sleep)
        + (6 - entry.energy)
        + (6 - entry.social_connection)
        + (6 - entry.enjoyment)
    )


def _classify_level(score: float) -> str:
    if score >= 20:
        return "Critical"
    if score >= 16:
        return "High"
    if score >= 11:
        return "Moderate"
    return "Low"


def _determine_trend(scores: List[float]) -> str:
    if len(scores) < 2:
        return "Stable"
    recent = scores[-1]
    previous = sum(scores[:-1]) / (len(scores) - 1)
    if recent <= previous - 1:
        return "Improving"
    if recent >= previous + 1:
        return "Worsening"
    return "Stable"


def _fallback_summary_and_interventions(level: str) -> tuple[str, list[str]]:
    copy = {
        "Low": (
            "You appear well-balanced this week. Keep steady routines and protect recovery time.",
            [
                "Keep a consistent sleep schedule",
                "Plan one energizing activity",
                "Maintain light movement",
            ],
        ),
        "Moderate": (
            "You may be building some strain. Consider lighter workouts and more recovery breaks.",
            [
                "Swap one workout for mobility",
                "Add a 10-minute walk",
                "Block a restful evening",
            ],
        ),
        "High": (
            "Your signals suggest elevated strain. Prioritize rest and low-intensity sessions.",
            [
                "Reduce workout intensity by ~20%",
                "Aim for an earlier bedtime",
                "Schedule a social check-in",
            ],
        ),
        "Critical": (
            "You are showing high strain. Focus on recovery and gentle movement only.",
            [
                "Take a full rest day",
                "Hydrate and eat regularly",
                "Ask for support if needed",
            ],
        ),
    }
    return copy[level]


def analyze_burnout(payload: BurnoutRequest) -> BurnoutResponse:
    # Build combined history: latest entry + optional recent history from the client
    latest = BurnoutCheckin(
        sleep=payload.sleep,
        stress=payload.stress,
        energy=payload.energy,
        social_connection=payload.social_connection,
        enjoyment=payload.enjoyment,
    )
    history: List[BurnoutCheckin] = [latest]
    if payload.recent_history:
        history.extend(payload.recent_history[:7])  # cap at ~8 total entries

    scores = [_compute_risk_score(entry) for entry in history]
    risk_score = float(scores[0])
    level = _classify_level(risk_score)
    trend_label = _determine_trend(list(reversed(scores)))  # older to newer for direction
    summary, interventions = _fallback_summary_and_interventions(level)

    # Try to enhance with Claude; fall back silently on failure
    ai_payload = {
        "latest": latest.model_dump(),
        "recentHistory": [e.model_dump() for e in history],
        "riskScores": scores,
    }
    ai_result = get_burnout_insights(ai_payload)

    if ai_result and isinstance(ai_result, dict):
        level = ai_result.get("burnoutLevel", level) or level
        trend_label = ai_result.get("trendLabel", trend_label) or trend_label
        summary = ai_result.get("summary", summary) or summary
        interventions_from_ai = ai_result.get("interventions") or interventions
        if isinstance(interventions_from_ai, list) and interventions_from_ai:
            interventions = [str(item) for item in interventions_from_ai][:3]

    return BurnoutResponse(
        risk_score=risk_score,
        burnout_level=level,
        trend_label=trend_label,
        micro_interventions=interventions,
        summary=summary,
    )
