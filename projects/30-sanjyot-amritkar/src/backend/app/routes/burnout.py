from fastapi import APIRouter

from app.schemas.burnout import BurnoutRequest, BurnoutResponse
from app.services.burnout_service import analyze_burnout

router = APIRouter()


@router.post("/analyze", response_model=BurnoutResponse)
def analyze(payload: BurnoutRequest):
    return analyze_burnout(payload)
