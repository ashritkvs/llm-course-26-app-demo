from pydantic import BaseModel
from typing import List, Optional


class BurnoutCheckin(BaseModel):
    sleep: int
    stress: int
    energy: int
    social_connection: int
    enjoyment: int
    week_start: Optional[str] = None
    created_at: Optional[str] = None


class BurnoutRequest(BaseModel):
    sleep: int
    stress: int
    energy: int
    social_connection: int
    enjoyment: int
    recent_history: Optional[List[BurnoutCheckin]] = None


class BurnoutResponse(BaseModel):
    risk_score: float
    burnout_level: str
    trend_label: str
    micro_interventions: list[str]
    summary: str
