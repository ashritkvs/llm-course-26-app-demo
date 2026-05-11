from __future__ import annotations

from typing import Dict

from .llm import LLMClient
from .schemas import draft_answer_schema


def generate_draft_answer(llm: LLMClient, question: str, *, lang: str = "en") -> Dict[str, str]:
    if lang == "zh":
        system = (
            "You are a scientific assistant for natural-science Q&A (physics, chemistry, biology, etc.).\n"
            "Answer in Chinese.\n"
            "Return only a concise reasoning summary, not hidden step-by-step chain-of-thought, plus the final answer.\n"
            "If assumptions are needed, state them briefly; if uncertain, say so explicitly.\n"
            "Output MUST strictly follow the provided JSON schema."
        )
    else:
        system = (
            "You are a helpful scientific assistant for physics/chemistry/biology Q&A.\n"
            "Answer in English.\n"
            "Return a concise reasoning summary (not hidden chain-of-thought) and a final answer.\n"
            "Be careful about uncertainty; if assumptions are needed, state them briefly.\n"
            "Output MUST strictly follow the provided JSON schema."
        )
    messages = [
        (
            "system",
            system,
        ),
        ("user", question),
    ]
    schema = draft_answer_schema()
    data = llm.structured(messages=messages, schema=schema)
    return {
        "reasoning_summary": data["reasoning_summary"],
        "final_answer": data["final_answer"],
        "draft_answer": data["draft_answer"],
    }
