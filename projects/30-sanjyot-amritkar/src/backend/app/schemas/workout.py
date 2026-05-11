from typing import List, Optional

from pydantic import BaseModel


class BurnoutState(BaseModel):
    level: Optional[str] = None
    trend_label: Optional[str] = None
    score: Optional[float] = None


class OnboardingProfile(BaseModel):
    name: Optional[str] = None
    fitnessLevel: Optional[str] = None
    weeklyGoal: Optional[str] = None
    equipment: Optional[str] = None


class WorkoutExercise(BaseModel):
    name: str
    sets: int
    reps: str
    rest: str
    notes: Optional[str] = None


class WorkoutSection(BaseModel):
    title: str
    exercises: List[WorkoutExercise]


class WorkoutPlan(BaseModel):
    title: str
    duration_minutes: int
    adaptation_reason: str
    sections: List[WorkoutSection]


class WorkoutRequest(BaseModel):
    muscle_group: str
    duration_minutes: int
    difficulty: str
    equipment: Optional[str] = None
    burnout_state: Optional[BurnoutState] = None
    override_burnout_level: Optional[str] = None
    onboarding: Optional[OnboardingProfile] = None
    base_plan: Optional[dict] = None


class WorkoutResponse(BaseModel):
    plan: WorkoutPlan
    used_burnout_level: Optional[str] = None
    source: str
