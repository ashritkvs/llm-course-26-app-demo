from __future__ import annotations

from pydantic import BaseModel, Field

from backend.models.generation import DifficultyLabel, ExamMode, FormatType, QuestionType


class DraftQuestion(BaseModel):
    question_text: str = Field(min_length=1)
    question_type: QuestionType
    difficulty_label: DifficultyLabel
    topic_label: str = Field(min_length=1)
    answer_key: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    options: list[str] = Field(default_factory=list)


class FinalQuestion(BaseModel):
    question_order: int = Field(ge=1)
    question_text: str = Field(min_length=1)
    question_type: QuestionType
    difficulty_label: DifficultyLabel
    topic_label: str = Field(min_length=1)
    answer_key: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    options: list[str] = Field(default_factory=list)


class FinalExamAssembly(BaseModel):
    title: str = Field(min_length=1)
    exam_mode: ExamMode
    format_type: FormatType
    questions: list[FinalQuestion] = Field(min_length=1)
