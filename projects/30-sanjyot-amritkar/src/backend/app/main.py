from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.routes import burnout, workout, dashboard

settings = get_settings()

app = FastAPI(title="State-Aware Adaptive Fitness API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(burnout.router, prefix="/api/burnout", tags=["Burnout"])
app.include_router(workout.router, prefix="/api/workout", tags=["Workout"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
