from __future__ import annotations

import json
import logging
from typing import Any, Protocol

import httpx

from backend.models.errors import ConfigError, ServiceUnavailableError, UpstreamServiceError
from backend.models.professor_profile import ProfessorProfileBase
from backend.models.retrieval import RetrievalResponse
from backend.models.workspace import WorkspaceResponse

logger = logging.getLogger(__name__)

_PROMPT_TEMPLATE = """You are an expert educational analyst building a Professor Profile for a STEM course.

Analyze the retrieved evidence and infer soft, evidence-weighted tendencies only. Do not invent unsupported claims.
Treat prior exams and practice tests as stronger signals than homework, lecture slides, and notes.

Return only strict JSON. Do not wrap the JSON in markdown fences. Do not add commentary before or after the JSON.
The JSON must match this schema exactly:
{schema_json}

Workspace:
- title: {workspace_title}
- course_code: {course_code}
- description: {description}

Retrieved evidence summary:
- query: {query_text}
- chunk_count: {chunk_count}

Evidence:
{evidence_blocks}

Requirements:
1. `topic_distribution.topics` weights must sum to 1.0 and reflect soft emphasis, not deterministic guarantees.
2. `question_type_distribution.question_types` weights must sum to 1.0.
3. `difficulty_profile` must describe level, time pressure, and multi-step reasoning honestly from evidence.
4. `exam_structure_profile` must capture inferred question counts, structural patterns, and answer expectations.
5. `evidence_summary.evidence_characterization` must summarize the strength and limits of the supplied evidence.
6. Keep rationales concise, concrete, and grounded in the provided evidence.
"""


class ProfessorProfileLlmClient(Protocol):
    def generate_profile(
        self,
        *,
        workspace: WorkspaceResponse,
        retrieval: RetrievalResponse,
    ) -> ProfessorProfileBase:
        ...


class GeminiProfessorProfileClient:
    def __init__(
        self,
        *,
        api_key: str | None,
        model_name: str,
        api_base_url: str,
        timeout_seconds: float,
        http_client: httpx.Client | None = None,
    ) -> None:
        if api_key is None or not api_key.strip():
            raise ConfigError("Gemini API key is required")

        self._api_key = api_key.strip()
        self._model_name = model_name.strip()
        self._api_base_url = api_base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._http_client = http_client

    def generate_profile(
        self,
        *,
        workspace: WorkspaceResponse,
        retrieval: RetrievalResponse,
    ) -> ProfessorProfileBase:
        prompt = self._build_prompt(workspace=workspace, retrieval=retrieval)
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }

        response_payload = self._post_generate_content(payload=payload)
        generated_text = self._extract_text(response_payload)

        try:
            return ProfessorProfileBase.model_validate_json(generated_text)
        except Exception as exc:
            logger.warning(
                "Gemini returned invalid professor profile JSON for workspace %s",
                workspace.id,
                exc_info=exc,
            )
            raise UpstreamServiceError(
                "Professor profile generation returned an invalid response schema"
            ) from exc

    def _build_prompt(
        self,
        *,
        workspace: WorkspaceResponse,
        retrieval: RetrievalResponse,
    ) -> str:
        schema = ProfessorProfileBase.model_json_schema()
        # Remove fields that the LLM shouldn't (and can't accurately) fill
        if "evidence_summary" in schema.get("properties", {}):
            ev_props = schema["properties"]["evidence_summary"].get("properties", {})
            ev_props.pop("retrieved_document_ids", None)
            ev_props.pop("retrieved_chunk_ids", None)
            ev_props.pop("total_documents", None)
            ev_props.pop("total_chunks", None)
            ev_props.pop("source_counts", None)
            ev_props.pop("retrieval_query", None)

        schema_json = json.dumps(schema, indent=2, sort_keys=True)
        evidence_blocks = []
        for chunk in retrieval.results:
            evidence_blocks.append(
                "\n".join(
                    [
                        f"Chunk {chunk.rank}",
                        f"- source_type: {chunk.source_type}",
                        f"- upload_label: {chunk.upload_label or 'n/a'}",
                        f"- topic_label: {chunk.topic_label or 'n/a'}",
                        f"- chunk_type_label: {chunk.chunk_type_label}",
                        f"- weighted_score: {chunk.weighted_score:.4f}",
                        f"- content: {self._truncate(chunk.content)}",
                    ]
                )
            )

        return _PROMPT_TEMPLATE.format(
            schema_json=schema_json,
            workspace_title=workspace.title,
            course_code=workspace.course_code or "n/a",
            description=workspace.description or "n/a",
            query_text=retrieval.query_text,
            chunk_count=len(retrieval.results),
            evidence_blocks="\n\n".join(evidence_blocks),
        )

    def _post_generate_content(self, *, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._api_base_url}/models/{self._model_name}:generateContent"
        params = {"key": self._api_key}

        try:
            if self._http_client is not None:
                response = self._http_client.post(
                    url,
                    params=params,
                    json=payload,
                    timeout=self._timeout_seconds,
                )
            else:
                with httpx.Client(timeout=self._timeout_seconds) as client:
                    response = client.post(
                        url,
                        params=params,
                        json=payload,
                    )
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException as exc:
            raise ServiceUnavailableError("Gemini request timed out") from exc
        except httpx.RequestError as exc:
            raise ServiceUnavailableError("Gemini request failed") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Gemini returned an HTTP error while generating a professor profile: %s",
                exc.response.status_code,
                exc_info=exc,
            )
            raise UpstreamServiceError("Gemini rejected the professor profile request") from exc
        except ValueError as exc:
            raise UpstreamServiceError("Gemini returned a non-JSON response") from exc

        if not isinstance(data, dict):
            raise UpstreamServiceError("Gemini returned an unexpected response payload")
        return data

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise UpstreamServiceError("Gemini returned no candidates for professor profile generation")

        first_candidate = candidates[0]
        if not isinstance(first_candidate, dict):
            raise UpstreamServiceError("Gemini returned an invalid candidate payload")

        content = first_candidate.get("content")
        if not isinstance(content, dict):
            raise UpstreamServiceError("Gemini returned no content for professor profile generation")

        parts = content.get("parts")
        if not isinstance(parts, list) or not parts:
            raise UpstreamServiceError("Gemini returned empty content for professor profile generation")

        text_parts: list[str] = []
        for part in parts:
            if isinstance(part, dict):
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text)

        if not text_parts:
            raise UpstreamServiceError("Gemini returned no text for professor profile generation")

        return "".join(text_parts)

    def _truncate(self, value: str, *, limit: int = 2200) -> str:
        normalized = " ".join(value.split())
        if len(normalized) <= limit:
            return normalized
        return f"{normalized[: limit - 3]}..."
