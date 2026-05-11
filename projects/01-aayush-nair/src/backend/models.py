"""
models.py — Pydantic schemas for request/response validation
"""

from pydantic import BaseModel
from typing import Optional


# ---- Auth ----

class GoogleAuthRequest(BaseModel):
    token: str  # Google ID token from frontend


class AuthResponse(BaseModel):
    session_token: str
    user_id: str
    email: str
    display_name: str
    avatar_url: str


# ---- Quiz ----

class QuizStartRequest(BaseModel):
    topic: str
    source_type: Optional[str] = "topic"      # "topic", "pdf", or "problem"
    source_text: Optional[str] = ""
    count: Optional[int] = 5
    question_type: Optional[str] = "mixed"    # conceptual | application | mixed
    difficulty: Optional[str] = None          # None = adaptive
    question_format: Optional[str] = "open"  # "open" | "mcq"


class QuestionOut(BaseModel):
    id: str
    question_text: str
    concept_tag: str
    concept_tags: Optional[list[str]] = []   # multi-tag (2–4 labels)
    difficulty: str
    hint_1: Optional[str] = ""
    hint_2: Optional[str] = ""
    hint_3: Optional[str] = ""
    # MCQ-only: options sent to client, correct_answer is NEVER sent (stored DB-only)
    options: Optional[list[str]] = []


class QuizStartResponse(BaseModel):
    session_id: str
    difficulty: str
    questions: list[QuestionOut]


class AnswerRequest(BaseModel):
    question_id: str
    student_answer: str
    hints_used: Optional[int] = 0          # 0–3
    response_time: Optional[float] = None  # seconds


class AnswerResponse(BaseModel):
    correct: bool
    score: float
    reasoning_score: float
    feedback: Optional[str] = ""          # human-readable explanation from Gemini
    ideal_answer: Optional[str] = ""      # model answer to show after submission
    explanation: Optional[str] = ""       # legacy field kept for compatibility
    socratic_hint: Optional[str] = ""
    correct_answer: Optional[str] = ""    # for MCQ: the right answer text (None for open-ended)
    misconceptions: list[str] = []


# ---- Hints (progressive) ----

class HintResponse(BaseModel):
    hint_number: int     # 1, 2, or 3
    hint_text: str


# ---- Analytics ----

class ConceptPerformance(BaseModel):
    concept_tag: str
    mastery_score: float
    attempts: int
    correct_answers: int
    status: str          # strong | weak | developing | insufficient_data


class SessionTrendPoint(BaseModel):
    session_id: str
    accuracy: float
    avg_reasoning_score: float


class AnalyticsResponse(BaseModel):
    user_id: str
    accuracy: float
    correct_answers: int
    wrong_answers: int
    weak_topics: list[ConceptPerformance]
    strong_topics: list[ConceptPerformance]
    avg_reasoning_score: float
    hint_usage_rate: float
    avg_response_time: Optional[float] = None
    concept_breakdown: list[ConceptPerformance]
    session_trend: list[SessionTrendPoint]
    message: Optional[str] = None


# ---- PDF Upload ----

class PDFUploadResponse(BaseModel):
    filename: str
    page_count: int
    text: str
