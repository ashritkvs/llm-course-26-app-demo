"""
main.py — FastAPI application entry point

Routes:
    POST /auth/google             — Authenticate via Google ID token
    POST /quiz/start              — Start a new adaptive quiz
    POST /quiz/answer             — Submit an answer for evaluation
    POST /quiz/reinforce          — Generate reinforcement questions from weak topics
    GET  /quiz/hint/{qid}/{num}   — Get progressive Socratic hint (1, 2, or 3)
    GET  /analytics/{uid}         — Get performance analytics
    POST /upload/pdf              — Upload and extract text from a PDF
    GET  /sessions/recent         — Last 5 sessions for the current user
    GET  /sessions/{session_id}   — Full replay data for a session
    POST /problem/solve           — Generate Socratic steps for a problem
    POST /problem/evaluate        — Evaluate reasoning on a single Socratic step
"""

import os
import sys
import uuid

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env vars
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Add parent dir to path for execution imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.auth import verify_google_token, upsert_user, create_session_token, decode_session_token
from backend.models import (
    GoogleAuthRequest, AuthResponse,
    QuizStartRequest, QuizStartResponse, QuestionOut,
    AnswerRequest, AnswerResponse,
    HintResponse,
    AnalyticsResponse,
    PDFUploadResponse,
)
from backend.quiz_engine import start_quiz
from execution.supabase_client import supabase
from execution.store_results import (
    create_session,
    end_session, compute_and_store_session_analytics,
)
from execution.generate_questions import _store_questions
from execution.evaluate_answer import evaluate_answer, store_evaluation, update_concept_mastery
from execution.extract_pdf_text import extract_text
from execution.generate_analytics import generate_analytics
from execution.solve_problem import solve_problem
from execution.evaluate_step import evaluate_step
from execution.compute_concept_performance import compute_concept_performance, step_down_difficulty
from execution.generate_questions import generate_reinforcement_questions
from execution.adaptive_difficulty import compute_next_difficulty

# ---- App Setup ----

app = FastAPI(
    title="Socratic Tutor API",
    description="Adaptive quiz platform with Socratic hints",
    version="0.2.0",
)

# CORS — allow the React frontend
ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler that ensures CORS headers are always present on 500s.

    Without this, unhandled exceptions bypass CORS middleware and the browser
    sees an opaque 'Failed to fetch' instead of the actual error body.
    """
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers=headers,
    )


# ---- Auth Dependency ----

def get_current_user(authorization: str = Header(...)) -> dict:
    """Extract and validate user from Authorization header."""
    try:
        token = authorization.replace("Bearer ", "").strip()
        if not token:
            raise HTTPException(
                status_code=401,
                detail={"error": "missing_token", "message": "Authorization token missing"},
            )
        payload = decode_session_token(token)
        if "user_id" not in payload:
            raise HTTPException(
                status_code=401,
                detail={"error": "invalid_token", "message": "Token payload missing user_id"},
            )
        return payload
    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        print(f"[AUTH] Token decode failed: {err_str}")
        # Distinguish expiry from other errors
        if "expired" in err_str.lower():
            raise HTTPException(
                status_code=401,
                detail={"error": "token_expired", "message": "Session expired — please log in again"},
            )
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_token", "message": err_str},
        )


# ---- Routes ----

@app.get("/")
def root():
    return {"status": "ok", "service": "Socratic Tutor API"}


# --- Auth ---

@app.post("/auth/google", response_model=AuthResponse)
def auth_google(req: GoogleAuthRequest):
    """Verify Google ID token, upsert user, return JWT session token."""
    try:
        user_info = verify_google_token(req.token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    user = upsert_user(user_info)
    session_token = create_session_token(user)

    return AuthResponse(
        session_token=session_token,
        user_id=user["id"],
        email=user["email"],
        display_name=user.get("display_name", ""),
        avatar_url=user.get("avatar_url", ""),
    )


# --- Quiz ---

@app.post("/quiz/start", response_model=QuizStartResponse)
def quiz_start(req: QuizStartRequest, current_user: dict = Depends(get_current_user)):
    """Start a new quiz. Session is created ONLY after questions are generated successfully."""
    user_id = current_user["user_id"]
    source_type = req.source_type or "topic"
    forced_difficulty = req.difficulty if req.difficulty and req.difficulty != "adaptive" else None
    question_format = req.question_format or "open"

    # STEP 1: Generate questions FIRST — no DB writes until generation succeeds
    try:
        difficulty, questions = start_quiz(
            user_id=user_id,
            concept=req.topic,
            count=req.count,
            session_id=None,   # do NOT store yet — avoids orphaned sessions on failure
            forced_difficulty=forced_difficulty,
            question_format=question_format,
            source_text=req.source_text or None,   # PDF text, if provided
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {e}")

    # STEP 2: Create session (guaranteed to succeed if we reach here)
    session = create_session(user_id, req.topic, difficulty, source_type)
    session_id = session["session_id"]

    # STEP 3: Store questions linked to the new session — rollback session on failure
    try:
        _store_questions(session_id, questions, question_format)
    except Exception as e:
        supabase.table("sessions").delete().eq("session_id", session_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to store questions: {e}")

    # Build question outputs — correct_answer is NEVER included (stored DB-only)
    question_outputs = [
        QuestionOut(
            id=q.get("question_id", ""),
            question_text=q.get("question", q.get("question_text", "")),
            difficulty=q.get("difficulty", difficulty),
            concept_tag=q.get("concept_tag", req.topic),
            concept_tags=q.get("concept_tags", [q.get("concept_tag", req.topic)]),
            hint_1=q.get("hint_1", ""),
            hint_2=q.get("hint_2", ""),
            hint_3=q.get("hint_3", ""),
            options=q.get("options", []),
        )
        for q in questions
    ]

    return QuizStartResponse(
        session_id=session_id,
        difficulty=difficulty,
        questions=question_outputs,
    )


@app.post("/quiz/complete")
def quiz_complete(req: dict, current_user: dict = Depends(get_current_user)):
    """
    Mark a quiz session as complete.

    Must be called by the frontend when the last question is answered.
    This activates the adaptive difficulty system for the next session by
    setting end_time on the session row (which _get_last_accuracy() filters on)
    and computing session analytics.

    Request body: { session_id: str }
    """
    user_id = current_user["user_id"]
    session_id = req.get("session_id", "")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # Verify ownership before marking complete
    check = (
        supabase.table("sessions")
        .select("session_id")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    # Mark session complete (sets end_time — activates adaptive logic)
    try:
        end_session(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end session: {e}")

    # Compute and cache session analytics (non-fatal if this fails)
    try:
        analytics = compute_and_store_session_analytics(session_id)
    except Exception:
        analytics = {}

    return {"completed": True, "session_id": session_id, "analytics": analytics}



@app.post("/quiz/next")
def quiz_next(req: dict, current_user: dict = Depends(get_current_user)):
    """
    Generate the next single question for an in-progress adaptive session.

    Used by the frontend after each answer in adaptive mode to retrieve a
    fresh question at the updated difficulty level.

    Request body:
        session_id        : str   — existing session UUID (for storage)
        topic             : str   — primary concept/topic string
        current_difficulty: str   — 'easy' | 'medium' | 'hard'
        question_format   : str   — 'open' | 'mcq'  (default 'open')
        concept_tags      : list  — optional tag list (reinforce keeps focus)

    Returns:
        { question: QuestionOut, resolved_difficulty: str }
    """
    session_id         = req.get("session_id", "")
    topic              = req.get("topic", "")
    current_difficulty = req.get("current_difficulty", "medium")
    question_format    = req.get("question_format", "open")
    concept_tags       = req.get("concept_tags") or []

    # Use first concept_tag as the generation concept if reinforcing
    concept = concept_tags[0] if concept_tags else topic
    if not concept:
        raise HTTPException(status_code=400, detail="topic or concept_tags must be provided")

    try:
        from execution.generate_questions import generate_questions
        qs = generate_questions(
            concept=concept,
            difficulty=current_difficulty,
            count=1,
            session_id=session_id if session_id else None,
            store=bool(session_id),
            question_format=question_format,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate next question: {e}")

    if not qs:
        raise HTTPException(status_code=500, detail="No question returned by generator")

    q = qs[0]
    question_out = QuestionOut(
        id=q.get("question_id", ""),
        question_text=q.get("question", q.get("question_text", "")),
        difficulty=q.get("difficulty", current_difficulty),
        concept_tag=q.get("concept_tag", concept),
        concept_tags=q.get("concept_tags", [q.get("concept_tag", concept)]),
        hint_1=q.get("hint_1", ""),
        hint_2=q.get("hint_2", ""),
        hint_3=q.get("hint_3", ""),
        options=q.get("options", []),
    )

    return {
        "question": question_out.model_dump(),
        "resolved_difficulty": q.get("difficulty", current_difficulty),
    }


@app.post("/quiz/answer", response_model=AnswerResponse)
def quiz_answer(req: AnswerRequest, current_user: dict = Depends(get_current_user)):
    """Submit an answer. MCQ is evaluated deterministically; open-ended via Gemini."""
    user_id = current_user["user_id"]

    # Fetch the question from the DB
    q_resp = (
        supabase.table("questions")
        .select("*")
        .eq("question_id", req.question_id)
        .execute()
    )
    if not q_resp.data:
        raise HTTPException(status_code=404, detail="Question not found")

    question = q_resp.data[0]
    stored_correct_answer = question.get("correct_answer", "")
    is_mcq = bool(stored_correct_answer)  # MCQ questions always have a correct_answer set

    if is_mcq:
        # Deterministic MCQ evaluation — no Gemini needed
        is_correct = req.student_answer.strip() == stored_correct_answer.strip()
        evaluation = {
            "correct": is_correct,
            "reasoning_score": 5 if is_correct else 1,
            "feedback": "Correct! Well done." if is_correct
                        else f"Incorrect. The correct answer is: {stored_correct_answer}",
            "ideal_answer": stored_correct_answer,
            "misconceptions": [] if is_correct else ["Selected wrong option"],
            "concept_tag": question.get("concept_tag", ""),
        }
    else:
        # Open-ended: evaluate via Gemini
        expected_reasoning = req.expected_reasoning if hasattr(req, 'expected_reasoning') else None
        evaluation = evaluate_answer(question, req.student_answer, expected_reasoning)

    # Store answer in Supabase
    store_evaluation(
        question_id=req.question_id,
        student_answer=req.student_answer,
        evaluation=evaluation,
        hints_used=req.hints_used,
        response_time=req.response_time,
    )

    # Update concept mastery
    update_concept_mastery(user_id, evaluation["concept_tag"], evaluation["correct"])

    return AnswerResponse(
        correct=evaluation["correct"],
        score=evaluation["reasoning_score"] / 5.0,
        reasoning_score=float(evaluation["reasoning_score"]),
        feedback=evaluation.get("feedback", ""),
        ideal_answer=evaluation.get("ideal_answer", ""),
        explanation=evaluation.get("feedback", ""),
        socratic_hint=question.get("hint_1", "") if not evaluation["correct"] else "",
        correct_answer=stored_correct_answer,
        misconceptions=evaluation.get("misconceptions", []),
    )


@app.post("/quiz/reinforce", response_model=QuizStartResponse)
def quiz_reinforce(req: dict, current_user: dict = Depends(get_current_user)):
    """
    Generate a reinforcement mini-quiz targeting the user's weak topics.

    Input (JSON body):
        weak_topics      : list[str]  — concept tags to practice
        question_format  : str        — 'open' | 'mcq' (default 'open')
        previous_difficulty: str      — last session difficulty, used to step down

    Returns QuizStartResponse (same shape as /quiz/start).
    Session is created ONLY after successful generation (no orphaned sessions).
    """
    user_id = current_user["user_id"]

    weak_topics       = req.get("weak_topics", [])
    question_format   = req.get("question_format", "open")
    prev_difficulty   = req.get("previous_difficulty", "medium")

    if not weak_topics:
        raise HTTPException(status_code=400, detail="weak_topics cannot be empty")

    reinforce_difficulty = step_down_difficulty(prev_difficulty)
    topic_label = f"Reinforcement: {', '.join(weak_topics[:3])}"

    # STEP 1: Generate questions FIRST — no DB writes until generation succeeds
    try:
        questions = generate_reinforcement_questions(
            weak_topics=weak_topics,
            difficulty=reinforce_difficulty,
            count_per_topic=1,
            session_id=None,   # do NOT store yet
            store=False,
            question_format=question_format,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate reinforcement questions: {e}")

    # STEP 2: Create session after successful generation
    session = create_session(user_id, topic_label, reinforce_difficulty, "topic")
    session_id = session["session_id"]

    # STEP 3: Store questions — rollback session on failure
    try:
        _store_questions(session_id, questions, question_format)
    except Exception as e:
        supabase.table("sessions").delete().eq("session_id", session_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to store reinforcement questions: {e}")

    question_outputs = [
        QuestionOut(
            id=q.get("question_id", ""),
            question_text=q.get("question", q.get("question_text", "")),
            difficulty=q.get("difficulty", reinforce_difficulty),
            concept_tag=q.get("concept_tag", ""),
            concept_tags=q.get("concept_tags", [q.get("concept_tag", "")]),
            hint_1=q.get("hint_1", ""),
            hint_2=q.get("hint_2", ""),
            hint_3=q.get("hint_3", ""),
            options=q.get("options", []),
        )
        for q in questions
    ]

    return QuizStartResponse(
        session_id=session_id,
        difficulty=reinforce_difficulty,
        questions=question_outputs,
    )


@app.get("/quiz/hint/{question_id}/{hint_number}", response_model=HintResponse)
def quiz_hint(question_id: str, hint_number: int, current_user: dict = Depends(get_current_user)):
    """Get a progressive Socratic hint (1, 2, or 3) for a question."""
    if hint_number not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="hint_number must be 1, 2, or 3")

    q_resp = (
        supabase.table("questions")
        .select(f"hint_1, hint_2, hint_3")
        .eq("question_id", question_id)
        .execute()
    )
    if not q_resp.data:
        raise HTTPException(status_code=404, detail="Question not found")

    hint_key = f"hint_{hint_number}"
    hint_text = q_resp.data[0].get(hint_key, "")

    return HintResponse(hint_number=hint_number, hint_text=hint_text or "No hint available.")


# --- Analytics ---

@app.get("/analytics/{user_id}", response_model=AnalyticsResponse)
def get_analytics(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get performance analytics for a user."""
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    analytics = generate_analytics(user_id)
    return AnalyticsResponse(**analytics)


# --- Recent Sessions ---

@app.get("/sessions/recent")
def get_recent_sessions(current_user: dict = Depends(get_current_user)):
    """Return last 5 sessions with accuracy for the current user."""
    user_id = current_user["user_id"]

    # Fetch sessions
    sessions_resp = (
        supabase.table("sessions")
        .select("session_id, topic, difficulty_level, source_type, start_time")
        .eq("user_id", user_id)
        .order("start_time", desc=True)
        .limit(5)
        .execute()
    )

    sessions = sessions_resp.data or []

    # Enrich each session with accuracy from session_analytics
    result = []
    for s in sessions:
        analytics_resp = (
            supabase.table("session_analytics")
            .select("accuracy")
            .eq("session_id", s["session_id"])
            .execute()
        )
        accuracy = None
        if analytics_resp.data:
            accuracy = analytics_resp.data[0].get("accuracy")

        result.append({
            "session_id": s["session_id"],
            "topic": s["topic"],
            "difficulty": s["difficulty_level"],
            "source_type": s.get("source_type", "topic"),
            "date": s["start_time"],
            "accuracy": accuracy,
        })

    return {"sessions": result}


# --- Session Detail (for replay) ---

@app.get("/sessions/{session_id}")
def get_session_detail(session_id: str, current_user: dict = Depends(get_current_user)):
    """Return full replay data for a session: questions + the student's answers."""
    user_id = current_user["user_id"]

    # Verify ownership
    session_resp = (
        supabase.table("sessions")
        .select("session_id, topic, difficulty_level, source_type, start_time")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    session = session_resp.data[0]

    # Fetch questions
    questions_resp = (
        supabase.table("questions")
        .select("question_id, question_text, concept_tag, difficulty, hint_1, hint_2, hint_3, correct_answer")
        .eq("session_id", session_id)
        .execute()
    )
    questions = questions_resp.data or []

    # Fetch answers for each question (one answer per question)
    enriched = []
    for q in questions:
        ans_resp = (
            supabase.table("answers")
            .select("student_answer, correct, reasoning_score, misconceptions, feedback, ideal_answer")
            .eq("question_id", q["question_id"])
            .limit(1)
            .execute()
        )
        answer = ans_resp.data[0] if ans_resp.data else None
        enriched.append({
            "question_id":   q["question_id"],
            "question_text": q["question_text"],
            "concept_tag":   q.get("concept_tag", ""),
            "difficulty":    q.get("difficulty", ""),
            "hint_1":        q.get("hint_1", ""),
            "hint_2":        q.get("hint_2", ""),
            "hint_3":        q.get("hint_3", ""),
            "correct_answer": q.get("correct_answer", ""),
            "student_answer":  answer["student_answer"] if answer else None,
            "correct":         answer["correct"] if answer else None,
            "reasoning_score": answer["reasoning_score"] if answer else None,
            "misconceptions":  answer.get("misconceptions", []) if answer else [],
            "feedback":        answer.get("feedback", "") if answer else "",
            "ideal_answer":    answer.get("ideal_answer", "") if answer else "",
        })

    # Session accuracy from session_analytics
    analytics_resp = (
        supabase.table("session_analytics")
        .select("accuracy")
        .eq("session_id", session_id)
        .execute()
    )
    accuracy = analytics_resp.data[0]["accuracy"] if analytics_resp.data else None

    return {
        "session_id": session["session_id"],
        "topic": session["topic"],
        "difficulty": session["difficulty_level"],
        "date": session["start_time"],
        "accuracy": accuracy,
        "questions": enriched,
    }


# --- Delete Session ---

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a session (and its questions/answers via cascade). Verifies ownership."""
    user_id = current_user["user_id"]

    # Verify the session belongs to this user
    check = (
        supabase.table("sessions")
        .select("session_id")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    supabase.table("sessions").delete().eq("session_id", session_id).execute()
    return {"deleted": session_id}


# --- Problem Solver ---

class ProblemSolveRequest(BaseModel):
    problem: str


@app.post("/problem/solve")
def problem_solve(req: ProblemSolveRequest, current_user: dict = Depends(get_current_user)):
    """Generate Socratic step-by-step guidance for a problem."""
    if not req.problem.strip():
        raise HTTPException(status_code=400, detail="Problem statement cannot be empty")

    try:
        result = solve_problem(req.problem)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate guidance: {e}")

    return result


class ProblemEvaluateRequest(BaseModel):
    problem: str           # full original problem statement
    question: str          # the guiding question for this step
    hint: str = ""         # hint text (empty if student didn't reveal it)
    student_answer: str    # the student's free-form response
    step_num: int = 1      # 1-based step index
    total_steps: int = 1   # total steps in this problem


@app.post("/problem/evaluate")
def problem_evaluate(req: ProblemEvaluateRequest, current_user: dict = Depends(get_current_user)):
    """
    Evaluate a student's reasoning on a single Socratic problem step.

    Unlike /quiz/answer, there is no stored correct answer — Gemini assesses
    reasoning quality and returns:
      - reasoning_score (1–5)
      - on_track (bool): whether the reasoning is strong enough to advance
      - what_went_wrong: plain-language gap explanation (empty if on_track)
      - socratic_nudge: follow-up question to deepen thinking
    """
    if not req.student_answer.strip():
        return {
            "reasoning_score": 1,
            "on_track": False,
            "what_went_wrong": "No response was provided.",
            "socratic_nudge": "Try to write at least one sentence about what you think — any starting point helps.",
        }

    try:
        result = evaluate_step(
            problem=req.problem,
            question=req.question,
            hint=req.hint,
            student_answer=req.student_answer,
            step_num=req.step_num,
            total_steps=req.total_steps,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate step: {e}")

    return result


# --- PDF Upload ---

@app.post("/upload/pdf", response_model=PDFUploadResponse)
async def upload_pdf(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload a PDF and extract text for quiz generation."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    upload_dir = os.path.join(os.path.dirname(__file__), "..", ".tmp", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, f"{uuid.uuid4()}.pdf")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        result = extract_text(file_path)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    return PDFUploadResponse(
        filename=file.filename,
        page_count=result["page_count"],
        text=result["text"],
    )
