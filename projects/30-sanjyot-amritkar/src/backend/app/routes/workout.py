from fastapi import APIRouter

from app.schemas.workout import WorkoutRequest, WorkoutResponse
from app.services.workout_service import generate_workout

router = APIRouter()


@router.post("/generate", response_model=WorkoutResponse)
def generate(payload: WorkoutRequest):
    return generate_workout(payload)
