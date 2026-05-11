from typing import List, Optional

from pydantic import BaseModel


class DashboardPatternRequest(BaseModel):
    """Aggregated dashboard data sent from the frontend.

    This keeps raw history processing on the client and sends only
    the summary metrics Claude needs for a short pattern insight.
    """

    recent_burnout_scores: List[float] = []
    recent_burnout_levels: List[str] = []
    burnout_trend_direction: str
    workouts_total: int
    workouts_training: int
    workouts_recovery: int
    avg_session_duration_minutes: Optional[float] = None
    common_session_types: Optional[List[str]] = None


class DashboardPatternResponse(BaseModel):
    pattern_summary: str
    recommendation: str
