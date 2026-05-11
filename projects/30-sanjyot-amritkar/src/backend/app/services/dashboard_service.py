from app.schemas.dashboard import DashboardPatternRequest, DashboardPatternResponse
from app.services.ai_claude import get_dashboard_pattern_insight


def analyze_dashboard_pattern(payload: DashboardPatternRequest) -> DashboardPatternResponse:
    """Call Claude to summarize dashboard patterns with a safe fallback.

    The caller is responsible for providing already-aggregated metrics.
    """

    # Default, deterministic fallback in case AI is unavailable or fails.
    total = payload.workouts_total
    training = payload.workouts_training
    recovery = payload.workouts_recovery

    if total == 0:
        fallback_summary = (
            "No workouts logged yet alongside your recent burnout check-ins. "
            "Once you generate a few plans, this card will describe how your training "
            "and recovery line up with burnout levels."
        )
        fallback_recommendation = (
            "Start by logging at least one workout next to your recent check-ins "
            "so we can spot basic patterns."
        )
    else:
        if training >= recovery * 2 and training >= 3:
            bias_text = "a training-heavy mix"
        elif recovery >= training * 2 and recovery >= 2:
            bias_text = "a recovery-heavy mix"
        else:
            bias_text = "a fairly balanced mix of training and recovery"

        direction = payload.burnout_trend_direction or "stable"
        if direction == "up":
            trend_text = "burnout trending upward"
        elif direction == "down":
            trend_text = "burnout easing a bit"
        else:
            trend_text = "burnout staying relatively steady"

        fallback_summary = (
            f"Recent data shows {bias_text} with {trend_text}. "
            f"We will use AI to keep an eye on how this pattern evolves week by week."
        )
        if direction == "up" and training >= recovery:
            fallback_recommendation = (
                "Add at least one dedicated recovery session and keep training days a bit shorter "
                "until burnout levels flatten out."
            )
        elif direction == "down" and recovery >= 1:
            fallback_recommendation = (
                "Keep your current balance of training and recovery for now rather than ramping volume quickly."
            )
        else:
            fallback_recommendation = (
                "Make small, week-by-week adjustments to session length or intensity based on how burnout feels."
            )

    ai_payload = payload.model_dump()
    ai_result = get_dashboard_pattern_insight(ai_payload)

    if ai_result and isinstance(ai_result, dict):
        pattern_summary = ai_result.get("patternSummary") or fallback_summary
        recommendation = ai_result.get("recommendation") or fallback_recommendation
    else:
        pattern_summary = fallback_summary
        recommendation = fallback_recommendation

    return DashboardPatternResponse(
        pattern_summary=pattern_summary,
        recommendation=recommendation,
    )
