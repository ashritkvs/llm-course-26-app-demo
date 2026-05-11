from __future__ import annotations

import logging
from typing import Any

import httpx
from supabase import Client

from backend.config.settings import Settings
from backend.models.errors import ConfigError, NotFoundError, ServiceUnavailableError, UpstreamServiceError
from backend.services.grading.grader import GradingService, build_grading_service

logger = logging.getLogger(__name__)


class SupabaseSubmissionStore:
    """Implements the SubmissionStore protocol backed by Supabase."""

    def __init__(self, supabase: Client) -> None:
        self._supabase = supabase

    def get_submission_answers(self, submission_id: str) -> list[dict[str, Any]]:
        resp = (
            self._supabase.table("submission_answers")
            .select("id, generated_question_id, answer_content")
            .eq("submission_id", submission_id)
            .execute()
        )
        rows: list[dict[str, Any]] = resp.data or []
        # Normalise DB column name to the key expected by grader.py.
        return [{**row, "question_id": row["generated_question_id"]} for row in rows]

    def get_question(self, question_id: str) -> dict[str, Any]:
        resp = (
            self._supabase.table("generated_questions")
            .select("id, question_text, question_type, answer_key, explanation, points_possible")
            .eq("id", question_id)
            .limit(1)
            .execute()
        )
        rows: list[dict[str, Any]] = resp.data or []
        if not rows:
            raise NotFoundError(f"Question {question_id} not found")
        return rows[0]


class GeminiGradingCaller:
    """HTTP caller for the Gemini API — grading module."""

    def __init__(
        self,
        *,
        api_key: str,
        model_name: str,
        api_base_url: str,
        timeout_seconds: float,
    ) -> None:
        self._api_key = api_key.strip()
        self._model_name = model_name.strip()
        self._api_base_url = api_base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    def call_gemini(self, *, prompt: str) -> str:
        url = f"{self._api_base_url}/models/{self._model_name}:generateContent"
        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                # Low temperature for deterministic grading
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }
        try:
            with httpx.Client(timeout=self._timeout_seconds) as client:
                response = client.post(url, params={"key": self._api_key}, json=payload)
            response.raise_for_status()
            data: Any = response.json()
        except httpx.TimeoutException as exc:
            raise ServiceUnavailableError("Gemini grading request timed out") from exc
        except httpx.RequestError as exc:
            raise ServiceUnavailableError("Gemini grading request failed") from exc
        except httpx.HTTPStatusError as exc:
            raise UpstreamServiceError("Gemini rejected the grading request") from exc
        except ValueError as exc:
            raise UpstreamServiceError("Gemini returned a non-JSON response") from exc

        if not isinstance(data, dict):
            raise UpstreamServiceError("Gemini grading returned unexpected payload type")
        candidates = data.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise UpstreamServiceError("Gemini grading returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        texts = [
            p["text"]
            for p in parts
            if isinstance(p, dict) and isinstance(p.get("text"), str)
        ]
        if not texts:
            raise UpstreamServiceError("Gemini grading returned no text content")
        return "".join(texts)


def build_grading_service_from_supabase(
    *,
    supabase: Client,
    settings: Settings,
) -> GradingService:
    """Wire up a GradingService backed by Supabase and Gemini."""
    if not settings.gemini_api_key:
        raise ConfigError("Gemini API key is required for grading")

    gemini_caller = GeminiGradingCaller(
        api_key=settings.gemini_api_key,
        model_name=settings.gemini_model,
        api_base_url=settings.gemini_api_base_url,
        timeout_seconds=settings.gemini_timeout_seconds,
    )
    submission_store = SupabaseSubmissionStore(supabase)
    return build_grading_service(
        gemini_caller=gemini_caller,
        submission_store=submission_store,
    )
