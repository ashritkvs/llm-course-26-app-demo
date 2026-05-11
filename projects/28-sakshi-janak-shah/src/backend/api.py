from __future__ import annotations

import os
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime
from queue import Queue
from threading import Thread
from typing import Any

import pandas as pd
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from db.database import (
    authenticate_auth_user,
    create_auth_session,
    create_auth_user,
    delete_auth_session,
    get_actions_for_entry,
    get_all_entries,
    get_auth_user_by_token,
    get_connection,
    get_entry,
    get_last_7_days,
    get_reframes_for_entry,
    get_user_profile,
    init_db,
    save_entry,
    upsert_user_profile,
)
from llm.journal_service import generate_insights, generate_recommendations, summarize_journal
from llm.master_agent import analyze_all
from llm.personalization import build_user_profile_context
from llm.weekly_strategy_agent import generate_weekly_strategy

REQUIRE_USER_PROFILE = os.getenv("MINDJOURNAL_REQUIRE_PROFILE", "false").lower() == "true"
DEFAULT_USER_ID = int(os.getenv("MINDJOURNAL_DEFAULT_USER_ID", "1"))
MODEL_TIMEOUT_SECONDS = int(os.getenv("MINDJOURNAL_MODEL_TIMEOUT", "30"))

app = FastAPI(title="MindJournal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


class JournalRequest(BaseModel):
    text: str = Field(..., min_length=1)
    created_at: str | None = None
    user_id: int | None = None


class UserScopedRequest(BaseModel):
    user_id: int | None = None


class UserProfilePayload(BaseModel):
    user_id: int | None = None
    name: str | None = None
    age: int | None = None
    mental_health_status: str | None = None
    stress_level: int | None = None
    exercise_routine: str | None = None
    eating_habits: str | None = None
    sleep_hours: float | None = None
    mood_trends: str | None = None
    social_interaction: str | None = None
    work_pressure: str | None = None
    hobbies: str | None = None
    additional_notes: str | None = None


class AuthCredentials(BaseModel):
    email: str
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Please provide a valid email address.")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return cleaned


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def call_with_timeout(fn, *args, timeout: int = MODEL_TIMEOUT_SECONDS):
    queue: Queue[tuple[str, Any]] = Queue(maxsize=1)

    def runner():
        try:
            queue.put(("result", fn(*args)))
        except Exception as exc:
            queue.put(("error", exc))

    thread = Thread(target=runner, daemon=True)
    thread.start()
    thread.join(timeout)

    if thread.is_alive():
        raise TimeoutError("Timed out waiting for model response.")

    state, payload = queue.get()
    if state == "error":
        raise payload

    return payload


def resolve_user_profile(user_id: int | None, conn: sqlite3.Connection):
    resolved_user_id = user_id or DEFAULT_USER_ID
    profile = get_user_profile(resolved_user_id, conn=conn)

    if profile is None and REQUIRE_USER_PROFILE:
        raise HTTPException(
            status_code=404,
            detail=f"User profile not found for user_id={resolved_user_id}.",
        )

    return resolved_user_id, profile


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is required.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Authorization header must use Bearer token.")

    return token.strip()


def get_current_user(
    authorization: str | None = Header(default=None),
    conn: sqlite3.Connection = Depends(get_db),
):
    token = extract_bearer_token(authorization)
    user = get_auth_user_by_token(token, conn=conn)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return dict(user)


def normalize_result(result: dict[str, Any]) -> dict[str, Any]:
    normalized_category = normalize_category_value(
        result.get("category"),
        emotion=result.get("emotion"),
        trigger=result.get("trigger"),
    )
    return {
        "emotion": result.get("emotion", "reflective"),
        "intensity": int(result.get("intensity", 5)),
        "category": normalized_category,
        "trigger": result.get("trigger", "unclear expectations"),
        "coreThought": result.get("core_thought", ""),
        "thinkingPatterns": result.get("thinking_patterns", []),
        "distortion": result.get("distortion", ""),
        "coreInsight": result.get("core_insight", result.get("insight", "")),
        "reframes": result.get("reframes", []),
        "actions": result.get("actions", []),
        "reflectionQuestion": result.get(
            "reflection_question",
            "What thought influenced your emotions the most today?",
        ),
        "actionPlan": result.get(
            "action_plan",
            "Take one small step today to improve your mood.",
        ),
        "weeklyHint": result.get("weekly_hint", ""),
        "keyConcerns": result.get("key_concerns", []),
        "positiveSignals": result.get("positive_signals", []),
        "personalizedSuggestions": result.get("personalized_suggestions", []),
    }


def normalize_category_value(
    value: Any,
    *,
    emotion: Any | None = None,
    trigger: Any | None = None,
) -> str:
    raw = " ".join(
        str(item).strip().lower()
        for item in (value, emotion, trigger)
        if item is not None and str(item).strip()
    )

    if not raw:
        return "neutral"

    if any(token in raw for token in ["positive", "hope", "grateful", "joy", "calm", "relief", "proud"]):
        return "positive"

    if any(
        token in raw
        for token in [
            "negative",
            "stress",
            "anx",
            "overwhelm",
            "sad",
            "ang",
            "frustrat",
            "burnout",
            "fatigue",
            "tension",
            "conflict",
            "guilt",
            "disappoint",
            "fear",
            "lonely",
            "embarrass",
        ]
    ):
        return "negative"

    return "neutral"

def serialize_entry(row: sqlite3.Row, conn: sqlite3.Connection) -> dict[str, Any]:
    entry_id = row["id"]
    normalized_category = normalize_category_value(
        row["category"],
        emotion=row["emotion"],
        trigger=row["trigger"],
    )

    return {
        "id": str(entry_id),
        "userId": row["user_id"],
        "text": row["text"],
        "createdAt": str(row["created_at"]),
        "result": {
            "emotion": row["emotion"] or "reflective",
            "intensity": row["intensity"] or 5,
            "category": normalized_category,
            "trigger": row["trigger"] or "unclear expectations",
            "coreThought": "",
            "thinkingPatterns": [],
            "distortion": row["distortion"] or "",
            "coreInsight": row["insight"] or "",
            "reframes": get_reframes_for_entry(entry_id, conn=conn),
            "actions": get_actions_for_entry(entry_id, conn=conn),
            "reflectionQuestion": "What thought influenced your emotions the most today?",
            "actionPlan": "Take one small step today to improve your mood.",
            "weeklyHint": "",
            "keyConcerns": [],
            "positiveSignals": [],
            "personalizedSuggestions": [],
        },
    }


def build_dashboard_payload(conn: sqlite3.Connection, user_id: int | None = None) -> dict[str, Any] | None:
    rows = get_last_7_days(user_id=user_id, conn=conn)
    if not rows:
        return None

    points: list[dict[str, Any]] = []
    trigger_counter: Counter[str] = Counter()
    weekday_scores: defaultdict[str, list[int]] = defaultdict(list)
    positive_streak = 0
    negative_streak = 0
    current_positive = 0
    current_negative = 0

    for row in rows:
        category = normalize_category_value(
            row["category"],
            emotion=row["emotion"],
            trigger=row["trigger"],
        )
        intensity = row["intensity"]
        trigger = row["trigger"]
        signed_score = intensity if category == "positive" else -intensity if category == "negative" else 0
        created_label = str(row["created_at"])

        points.append(
            {
                "date": created_label,
                "moodScore": intensity,
                "signedScore": signed_score,
                "category": category,
                "emotion": row["emotion"],
                "trigger": trigger,
            }
        )

        if trigger:
            trigger_counter[trigger] += 1

        weekday = datetime.fromisoformat(created_label).strftime("%A")
        weekday_scores[weekday].append(signed_score)

        if category == "positive":
            current_positive += 1
            current_negative = 0
        elif category == "negative":
            current_negative += 1
            current_positive = 0
        else:
            current_positive = 0
            current_negative = 0

        positive_streak = max(positive_streak, current_positive)
        negative_streak = max(negative_streak, current_negative)

    weekday_averages = {
        weekday: sum(scores) / len(scores) for weekday, scores in weekday_scores.items()
    }
    sorted_days = sorted(weekday_averages.items(), key=lambda item: item[1], reverse=True)
    mood_scores = [point["moodScore"] for point in points]

    return {
        "averageMood": round(sum(mood_scores) / len(mood_scores), 1),
        "bestMood": max(mood_scores),
        "lowestMood": min(mood_scores),
        "positiveStreak": positive_streak,
        "negativeStreak": negative_streak,
        "topTrigger": sorted(trigger_counter.items(), key=lambda item: item[1], reverse=True)[0][0]
        if trigger_counter
        else "Not enough data yet",
        "bestDay": sorted_days[0][0] if sorted_days else "N/A",
        "toughestDay": sorted_days[-1][0] if sorted_days else "N/A",
        "points": points,
    }


def build_weekly_dataframe(conn: sqlite3.Connection, user_id: int | None):
    rows = get_last_7_days(user_id=user_id, conn=conn)
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(
        [
            {
                "date": row["created_at"],
                "mood_score": row["intensity"],
                "category": row["category"],
                "emotion": row["emotion"],
                "trigger": row["trigger"],
            }
            for row in rows
        ]
    )
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").set_index("date")


@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}


@app.post("/api/auth/register")
def register(credentials: AuthCredentials, conn: sqlite3.Connection = Depends(get_db)):
    try:
        user_id = create_auth_user(credentials.email, credentials.password, conn=conn)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="An account with that email already exists.") from exc

    token = create_auth_session(user_id, conn=conn)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": credentials.email.lower(),
        },
    }


@app.post("/api/auth/login")
def login(credentials: AuthCredentials, conn: sqlite3.Connection = Depends(get_db)):
    user = authenticate_auth_user(credentials.email, credentials.password, conn=conn)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_auth_session(user["id"], conn=conn)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
        },
    }


@app.get("/api/auth/me")
def auth_me(current_user: dict[str, Any] = Depends(get_current_user)):
    return {"user": current_user}


@app.post("/api/auth/logout")
def logout(
    authorization: str | None = Header(default=None),
    conn: sqlite3.Connection = Depends(get_db),
):
    token = extract_bearer_token(authorization)
    delete_auth_session(token, conn=conn)
    return {"loggedOut": True}


@app.get("/api/profile-context")
def profile_context(
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    user_id = current_user["id"]
    resolved_user_id, profile = resolve_user_profile(user_id, conn)
    return {
        "userId": resolved_user_id,
        "profileFound": profile is not None,
        "context": build_user_profile_context(profile),
    }


@app.get("/api/profile")
def get_profile(
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    user_id = current_user["id"]
    profile = get_user_profile(user_id, conn=conn)
    if profile is None:
        return {
            "profile": {
                "user_id": user_id,
                "name": "",
                "age": None,
                "mental_health_status": "",
                "stress_level": None,
                "exercise_routine": "",
                "eating_habits": "",
                "sleep_hours": None,
                "mood_trends": "",
                "social_interaction": "",
                "work_pressure": "",
                "hobbies": "",
                "additional_notes": "",
            },
            "exists": False,
        }
    return {"profile": profile, "exists": True}


@app.put("/api/profile")
def save_profile(
    payload: UserProfilePayload,
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    profile_payload = payload.model_dump()
    profile_payload["user_id"] = current_user["id"]
    upsert_user_profile(profile_payload, conn=conn)
    profile = get_user_profile(current_user["id"], conn=conn)
    return {"profile": profile, "saved": True}


@app.get("/api/entries")
def list_entries(
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    resolved_user_id, _profile = resolve_user_profile(current_user["id"], conn)
    rows = get_all_entries(user_id=resolved_user_id, conn=conn)
    return {"entries": [serialize_entry(row, conn) for row in rows]}


@app.post("/api/analyze")
def analyze_entry(
    payload: JournalRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    journal_text = payload.text.strip()
    if not journal_text:
        raise HTTPException(status_code=400, detail="Journal text is required.")

    resolved_user_id, profile = resolve_user_profile(current_user["id"], conn)
    try:
        raw_result = call_with_timeout(analyze_all, journal_text, profile)
    except Exception as exc:
        print(f"Gemini analyze error for user_id={resolved_user_id}: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini analyze failed: {type(exc).__name__}: {exc}",
        ) from exc
    normalized = normalize_result(raw_result)

    entry_id = save_entry(
        journal_text,
        {
            "emotion": normalized["emotion"],
            "intensity": normalized["intensity"],
            "category": normalized["category"],
            "trigger": normalized["trigger"],
            "distortion": normalized["distortion"],
            "core_insight": normalized["coreInsight"],
            "reframes": normalized["reframes"],
            "actions": normalized["actions"],
        },
        created_at=payload.created_at,
        user_id=resolved_user_id,
        conn=conn,
    )

    saved_row = get_entry(entry_id, conn=conn)
    if not saved_row:
        raise HTTPException(status_code=500, detail="Entry was analyzed but could not be loaded.")

    entry = serialize_entry(saved_row, conn)
    entry["result"] = normalized
    return {
        "entry": entry,
        "profileContextUsed": profile is not None,
    }


@app.post("/api/summarize")
def summarize_entry(
    payload: JournalRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    journal_text = payload.text.strip()
    if not journal_text:
        raise HTTPException(status_code=400, detail="Journal text is required.")

    _resolved_user_id, profile = resolve_user_profile(current_user["id"], conn)
    try:
        summary = call_with_timeout(summarize_journal, journal_text, profile)
    except Exception as exc:
        print(f"Gemini summarize error for user_id={_resolved_user_id}: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini summarize failed: {type(exc).__name__}: {exc}",
        ) from exc
    return {
        "summary": summary,
        "profileContextUsed": profile is not None,
    }


@app.post("/api/recommendations")
def recommendation_entry(
    payload: JournalRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    journal_text = payload.text.strip()
    if not journal_text:
        raise HTTPException(status_code=400, detail="Journal text is required.")

    _resolved_user_id, profile = resolve_user_profile(current_user["id"], conn)
    try:
        recommendations = call_with_timeout(generate_recommendations, journal_text, profile)
    except Exception as exc:
        print(f"Gemini recommendations error for user_id={_resolved_user_id}: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini recommendations failed: {type(exc).__name__}: {exc}",
        ) from exc
    return {
        "recommendations": recommendations,
        "profileContextUsed": profile is not None,
    }


@app.post("/api/insights")
def insight_entry(
    payload: UserScopedRequest = Body(default_factory=UserScopedRequest),
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    resolved_user_id, profile = resolve_user_profile(current_user["id"], conn)
    df = build_weekly_dataframe(conn, resolved_user_id)
    try:
        insights = call_with_timeout(generate_insights, df, profile)
    except Exception as exc:
        print(f"Gemini insights error for user_id={resolved_user_id}: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini insights failed: {type(exc).__name__}: {exc}",
        ) from exc
    return {
        "insights": insights,
        "profileContextUsed": profile is not None,
    }


@app.get("/api/dashboard")
def get_dashboard(
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    resolved_user_id, _profile = resolve_user_profile(current_user["id"], conn)
    return {"dashboard": build_dashboard_payload(conn, resolved_user_id)}


@app.post("/api/weekly-strategy")
def weekly_strategy(
    payload: UserScopedRequest = Body(default_factory=UserScopedRequest),
    current_user: dict[str, Any] = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    resolved_user_id, profile = resolve_user_profile(current_user["id"], conn)
    df = build_weekly_dataframe(conn, resolved_user_id)
    if df.empty:
        raise HTTPException(status_code=400, detail="Not enough journal entries to generate weekly strategy.")

    try:
        strategy = call_with_timeout(generate_weekly_strategy, df, profile)
    except Exception as exc:
        print(f"Gemini weekly strategy error for user_id={resolved_user_id}: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini weekly strategy failed: {type(exc).__name__}: {exc}",
        ) from exc
    return {
        "strategy": strategy,
        "profileContextUsed": profile is not None,
    }
