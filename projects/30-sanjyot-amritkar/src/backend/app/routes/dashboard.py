from fastapi import APIRouter

from app.schemas.dashboard import DashboardPatternRequest, DashboardPatternResponse
from app.services.dashboard_service import analyze_dashboard_pattern

router = APIRouter()


@router.post("/pattern", response_model=DashboardPatternResponse)
def pattern_insight(payload: DashboardPatternRequest) -> DashboardPatternResponse:
    return analyze_dashboard_pattern(payload)
