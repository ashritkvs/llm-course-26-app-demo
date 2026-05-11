from __future__ import annotations

import json
import os
import random
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple


try:
    from openai import OpenAI
    from openai import BadRequestError
except Exception:  # pragma: no cover
    OpenAI = None
    BadRequestError = None


@dataclass(frozen=True)
class LLMConfig:
    model: str = "gpt-4o"
    temperature: float = 0.2
    max_output_tokens: int = 900
    reasoning_effort: Optional[str] = None


Message = Tuple[str, str]  # (role, text)


def _to_responses_input(messages: Sequence[Message]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for role, text in messages:
        out.append(
            {
                "role": role,
                "content": [{"type": "input_text", "text": text}],
            }
        )
    return out


def _extract_json_object(text: str) -> str:
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return text
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output.")
    return text[start : end + 1]


def _normalize_json_schema_format(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize our internal schema dict into the Responses API `text.format`
    shape expected by the OpenAI Python SDK.

    We store schemas as:
      {"name": str, "strict": bool, "schema": { ...json-schema... }}

    The Responses API expects:
      {"type":"json_schema","name": str, "schema": {...}, "strict": bool}
    """
    if schema.get("type") == "json_schema":
        # Already normalized.
        return schema

    name = schema.get("name")
    inner = schema.get("schema")
    strict = schema.get("strict", True)
    if not name or not isinstance(inner, dict):
        raise ValueError("Invalid schema format: expected keys 'name' and 'schema'.")

    return {"type": "json_schema", "name": name, "schema": inner, "strict": bool(strict)}


def _to_chat_messages(messages: Sequence[Message]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for role, text in messages:
        out.append({"role": role, "content": text})
    return out


def _json_schema_to_chat_response_format(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert our internal schema dict into Chat Completions `response_format`.

    Chat Completions expects:
      {"type":"json_schema","json_schema":{"name":..., "schema":..., "strict":...}}
    """
    fmt = _normalize_json_schema_format(schema)
    return {
        "type": "json_schema",
        "json_schema": {"name": fmt["name"], "schema": fmt["schema"], "strict": fmt.get("strict", True)},
    }


def _should_fallback_to_chat_completions(err: Exception) -> bool:
    # The Responses API occasionally returns this validation error even when a
    # `text.format` dict is provided (likely a server-side schema mismatch).
    msg = str(err)
    return "text.format.name" in msg or "Missing required parameter" in msg and "text.format" in msg


class TemplateMismatchError(RuntimeError):
    def __init__(self, *, question: str, detected_topic: str, supported_topics: List[str]):
        super().__init__(f"Mock template mismatch: topic={detected_topic!r} for question={question!r}")
        self.question = question
        self.detected_topic = detected_topic
        self.supported_topics = supported_topics


class LLMClient:
    def __init__(self, mock: bool, config: Optional[LLMConfig] = None):
        self.mock = mock
        self.config = config or LLMConfig()

        if self.mock:
            self._mock = _MockLLM(seed=0)
            self._client = None
            return

        if OpenAI is None:  # pragma: no cover
            raise RuntimeError("openai package not installed. Run: pip install -r requirements.txt")

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set.")

        self._client = OpenAI(api_key=api_key)
        self._mock = None

    def structured(self, *, messages: Sequence[Message], schema: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock:
            assert self._mock is not None
            return self._mock.structured(messages=messages, schema=schema)

        assert self._client is not None
        # Prefer the Responses API, but fall back to Chat Completions if the server
        # rejects `text.format` (seen as: "Missing required parameter:
        # 'text.format.name'").
        try:
            kwargs: Dict[str, Any] = {}
            if self.config.reasoning_effort:
                kwargs["reasoning"] = {"effort": self.config.reasoning_effort}

            fmt = _normalize_json_schema_format(schema)
            resp = self._client.responses.create(
                model=self.config.model,
                input=_to_responses_input(messages),
                text={"format": fmt},
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_output_tokens,
                **kwargs,
            )

            output_text = getattr(resp, "output_text", None)
            if not output_text:
                # Fallback: join output message content
                chunks: List[str] = []
                for item in getattr(resp, "output", []) or []:
                    if item.get("type") != "message":
                        continue
                    for c in item.get("content", []) or []:
                        if c.get("type") in ("output_text", "text"):
                            chunks.append(c.get("text", ""))
                output_text = "\n".join(chunks).strip()

            try:
                return json.loads(output_text)
            except Exception:
                repaired = _extract_json_object(output_text)
                return json.loads(repaired)
        except Exception as err:
            if BadRequestError is not None and isinstance(err, BadRequestError) and _should_fallback_to_chat_completions(err):
                resp_format = _json_schema_to_chat_response_format(schema)
                chat_kwargs: Dict[str, Any] = {}
                if self.config.reasoning_effort:
                    chat_kwargs["reasoning_effort"] = self.config.reasoning_effort

                chat = self._client.chat.completions.create(
                    model=self.config.model,
                    messages=_to_chat_messages(messages),
                    response_format=resp_format,
                    temperature=self.config.temperature,
                    max_completion_tokens=self.config.max_output_tokens,
                    **chat_kwargs,
                )
                content = (chat.choices[0].message.content or "").strip()
                try:
                    return json.loads(content)
                except Exception:
                    repaired = _extract_json_object(content)
                    return json.loads(repaired)
            raise


class _MockLLM:
    def __init__(self, seed: int = 0):
        self.rng = random.Random(seed)

    def _extract_block(self, text: str, start_label: str, end_label: str) -> str:
        pattern = re.compile(
            re.escape(start_label) + r"\s*\n(?P<body>.*?)\n\s*" + re.escape(end_label),
            re.DOTALL | re.IGNORECASE,
        )
        m = pattern.search(text)
        return (m.group("body").strip() if m else "").strip()

    def _extract_between_any(self, text: str, start_label: str, end_labels: List[str]) -> str:
        for end_label in end_labels:
            body = self._extract_block(text, start_label, end_label)
            if body:
                return body
        return ""

    def _detect_topic(self, question: str) -> str:
        q = question.strip()
        ql = q.lower()
        # Metal resistivity
        if ("resistivity" in ql or "resistance" in ql) and ("metal" in ql or "metals" in ql):
            return "metal_resistivity"
        if ("\u91d1\u5c5e" in q and ("\u7535\u963b" in q or "\u7535\u963b\u7387" in q)):
            return "metal_resistivity"
        # Free fall
        if any(k in ql for k in ["dropped from rest", "free fall", "ignore air resistance", "hit the ground"]) or (
            "height" in ql and "impact" in ql and "speed" in ql
        ):
            return "free_fall"
        if any(k in q for k in ["\u81ea\u7531\u843d\u4f53", "\u5ffd\u7565\u7a7a\u6c14\u963b\u529b", "\u843d\u5730", "\u9ad8\u5ea6"]) and ("\u65f6\u95f4" in q or "\u901f\u5ea6" in q):
            return "free_fall"
        # Reaction rate vs temperature (Arrhenius / activation energy)
        if ("reaction rate" in ql or "rate of a chemical reaction" in ql or ("chemical reaction" in ql and "rate" in ql)) and (
            "temperature" in ql or "increasing temperature" in ql
        ):
            return "reaction_rate_temp"
        if any(k in q for k in ["\u53cd\u5e94\u901f\u7387", "\u53cd\u5e94\u901f\u5ea6", "\u5316\u5b66\u53cd\u5e94\u901f\u7387"]) and ("\u6e29\u5ea6" in q):
            return "reaction_rate_temp"
        # Antibiotics vs viral infection
        if ("antibiotic" in ql or "antibiotics" in ql) and any(k in ql for k in ["virus", "viral", "viruses"]):
            return "antibiotics_vs_viruses"
        if ("\u6297\u751f\u7d20" in q or "\u6297\u83cc\u7d20" in q) and ("\u75c5\u6bd2" in q):
            return "antibiotics_vs_viruses"
        return "unknown"

    def _extract_tail_int(self, text: str, default: int) -> int:
        m = re.search(r"(?:exactly|\u6070\u597d)\s+(\d+)", text, re.IGNORECASE)
        if not m:
            return default
        try:
            return max(2, min(4, int(m.group(1))))
        except Exception:
            return default

    def structured(self, *, messages: Sequence[Message], schema: Dict[str, Any]) -> Dict[str, Any]:
        name = schema.get("name", "")
        user_text = ""
        for role, text in messages:
            if role == "user":
                user_text = text
        lang = "zh" if re.search(r"[\u4e00-\u9fff]", user_text) else "en"

        main_q = (
            self._extract_between_any(
                user_text,
                "MAIN_QUESTION:",
                ["CLAIM_ID:", "CLAIM_TEXT:", "VERIFICATION_QUESTION:", "CLAIM_TO_EVALUATE:"],
            )
            or self._extract_between_any(user_text, "QUESTION:", ["DRAFT_ANSWER:", "Return", "\u8bf7\u8fd4\u56de"])
            or user_text.strip()
        )
        topic = self._detect_topic(main_q)
        supported_topics = ["metal_resistivity", "free_fall", "reaction_rate_temp", "antibiotics_vs_viruses"]
        if topic == "unknown":
            raise TemplateMismatchError(question=main_q.strip()[:400], detected_topic=topic, supported_topics=supported_topics)

        if name == "draft_answer":
            q = user_text.strip()
            if topic == "metal_resistivity" and "\u91d1\u5c5e" in q and ("\u7535\u963b" in q or "\u7535\u963b\u7387" in q):
                reasoning = [
                    "\u91d1\u5c5e\u8f7d\u6d41\u5b50\u6570\u8fd1\u4f3c\u4e0d\u53d8\uff0c\u6e29\u5ea6\u5347\u9ad8\u4e3b\u8981\u6539\u53d8\u6563\u5c04\u5f3a\u5ea6\u3002",
                    "\u6676\u683c\u70ed\u632f\u52a8\u589e\u5f3a\u4f1a\u63d0\u9ad8\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u9891\u7387\uff0c\u964d\u4f4e\u8fc1\u79fb\u7387\u3002",
                    "\u56e0\u6b64\u7535\u963b\u7387\u901a\u5e38\u968f\u6e29\u5ea6\u5347\u9ad8\u800c\u589e\u5927\uff08\u8fd1\u4f3c\u7ebf\u6027\u4e8e\u5ba4\u6e29\u9644\u8fd1\uff09\u3002",
                ]
                final = "\u591a\u6570\u91d1\u5c5e\u52a0\u70ed\u540e\u7535\u963b\u589e\u5927\uff0c\u4e3b\u8981\u56e0\u4e3a\u6676\u683c\u70ed\u632f\u52a8\u589e\u5f3a\u5bfc\u81f4\u7535\u5b50\u6563\u5c04\u589e\u52a0\u3001\u8fc1\u79fb\u7387\u4e0b\u964d\u3002"
            elif topic == "metal_resistivity" and ("metal" in q.lower() or "metals" in q.lower()) and ("resistance" in q.lower() or "resistivity" in q.lower()):
                reasoning = [
                    "In most metals, carrier density is roughly constant; temperature mainly changes scattering.",
                    "Higher temperature increases lattice vibrations (phonons), strengthening electron–phonon scattering.",
                    "More scattering lowers mobility, so resistivity typically increases (often roughly linear near room temperature).",
                ]
                final = "Heating most metals increases resistance because stronger lattice vibrations increase electron scattering and reduce mobility."
            elif topic == "free_fall":
                if lang == "zh":
                    reasoning = [
                        "\u5ffd\u7565\u7a7a\u6c14\u963b\u529b\u4e14 g \u8fd1\u4f3c\u5e38\u6570\u65f6\uff0c\u81ea\u7531\u843d\u4f53\u4f4d\u79fb\u6ee1\u8db3 h = (1/2) g t^2\u3002",
                        "\u56e0\u6b64 t = sqrt(2h/g)\u3002\u672b\u901f\u5ea6 v = g t = sqrt(2gh)\u3002",
                        "\u4ee3\u5165 h=45 m\u3001g≈9.8 m/s^2 \u5f97 t≈3.03 s\u3001v≈29.7 m/s\uff08\u5411\u4e0b\uff09\u3002",
                    ]
                    final = "\u843d\u5730\u65f6\u95f4\u7ea6 3.03 s\uff1b\u843d\u5730\u524d\u901f\u5ea6\u7ea6 29.7 m/s\uff08\u5411\u4e0b\uff09\u3002"
                else:
                    reasoning = [
                        "With constant gravitational acceleration g and no air resistance, h = (1/2) g t^2.",
                        "So t = sqrt(2h/g). The impact speed is v = g t = sqrt(2gh).",
                        "For h=45 m and g≈9.8 m/s^2, t≈3.03 s and v≈29.7 m/s downward.",
                    ]
                    final = "Time ≈ 3.03 s; speed just before impact ≈ 29.7 m/s downward."
            elif topic == "reaction_rate_temp":
                if lang == "zh":
                    reasoning = [
                        "\u6e29\u5ea6\u5347\u9ad8\u4f1a\u63d0\u9ad8\u5206\u5b50\u5e73\u5747\u52a8\u80fd\uff0c\u4f7f\u78b0\u649e\u66f4\u9891\u7e41\u4e14\u66f4“\u6709\u80fd\u91cf”\u3002",
                        "\u6309 Arrhenius \u5173\u7cfb k = A·exp(-Ea/RT)\uff0cT \u589e\u5927\u65f6\u6307\u6570\u9879\u53d8\u5927\uff0c\u901f\u7387\u5e38\u6570\u589e\u5927\u3002",
                        "\u4ece\u80fd\u91cf\u5206\u5e03\u770b\uff0cT \u5347\u9ad8\u4f1a\u663e\u8457\u589e\u52a0\u80fd\u91cf\u8d85\u8fc7\u6d3b\u5316\u80fd Ea \u7684\u5206\u5b50\u6bd4\u4f8b\uff0c\u56e0\u6b64\u6709\u6548\u78b0\u649e\u6570\u589e\u52a0\u3002",
                    ]
                    final = "\u5347\u6e29\u901a\u5e38\u4f1a\u52a0\u5feb\u53cd\u5e94\u901f\u7387\uff0c\u56e0\u4e3a\u66f4\u591a\u5206\u5b50\u5177\u6709\u8d85\u8fc7\u6d3b\u5316\u80fd\u7684\u80fd\u91cf\u4e14\u6709\u6548\u78b0\u649e\u66f4\u9891\u7e41\uff0c\u4f7f\u901f\u7387\u5e38\u6570\u589e\u5927\u3002"
                else:
                    reasoning = [
                        "Higher temperature increases molecular kinetic energy, leading to more frequent and more energetic collisions.",
                        "By the Arrhenius form k = A·exp(-Ea/(RT)), increasing T increases the exponential term, raising the rate constant k.",
                        "From the energy distribution view, higher T significantly increases the fraction of molecules with energy above the activation energy Ea, boosting effective collisions.",
                    ]
                    final = "Increasing temperature usually speeds reactions because it increases the fraction of molecules exceeding the activation energy and raises the rate constant (Arrhenius behavior)."
            elif topic == "antibiotics_vs_viruses":
                if lang == "zh":
                    reasoning = [
                        "\u6297\u751f\u7d20\u4e3b\u8981\u9776\u5411\u7ec6\u83cc\u7279\u6709\u7ed3\u6784/\u8fc7\u7a0b\uff08\u5982\u7ec6\u80de\u58c1\u5408\u6210\u300170S \u6838\u7cd6\u4f53\u86cb\u767d\u5408\u6210\u3001\u7ec6\u83cc\u4ee3\u8c22\u901a\u8def\uff09\u3002",
                        "\u75c5\u6bd2\u7f3a\u4e4f\u8fd9\u4e9b\u7ec6\u83cc\u9776\u70b9\uff0c\u5e76\u4e3b\u8981\u4f9d\u8d56\u5bbf\u4e3b\u7ec6\u80de\u673a\u5236\u590d\u5236\uff0c\u56e0\u6b64\u6297\u751f\u7d20\u901a\u5e38\u65e0\u6cd5\u76f4\u63a5\u6291\u5236\u75c5\u6bd2\u590d\u5236\u3002",
                        "\u4f46\u75c5\u6bd2\u7ee7\u53d1\u7ec6\u83cc\u611f\u67d3\u65f6\u4ecd\u53ef\u80fd\u9700\u8981\u6297\u751f\u7d20\u6cbb\u7597\u7ec6\u83cc\u90e8\u5206\u3002",
                    ]
                    final = "\u6297\u751f\u7d20\u901a\u5e38\u5bf9\u75c5\u6bd2\u611f\u67d3\u65e0\u6548\uff0c\u56e0\u4e3a\u5b83\u4eec\u4f5c\u7528\u7684\u9776\u70b9\u591a\u4e3a\u7ec6\u83cc\u7279\u6709\u7ed3\u6784/\u8fc7\u7a0b\uff0c\u800c\u75c5\u6bd2\u4e3b\u8981\u4f9d\u8d56\u5bbf\u4e3b\u590d\u5236\u673a\u5236\u3002"
                else:
                    reasoning = [
                        "Antibiotics target bacteria-specific structures/processes (e.g., cell wall synthesis, bacterial ribosomes, metabolic pathways).",
                        "Viruses lack these bacterial targets and replicate using host-cell machinery, so antibiotics generally do not inhibit viral replication.",
                        "Antibiotics can still be useful if a viral illness is complicated by a secondary bacterial infection.",
                    ]
                    final = "Antibiotics usually don’t work against viral infections because they act on bacteria-specific targets, while viruses lack those targets and replicate using host machinery."
            else:
                if lang == "zh":
                    reasoning = ["\u7ed9\u51fa\u80cc\u666f\u6982\u5ff5\u3002", "\u5217\u51fa\u5173\u952e\u673a\u5236\u3002", "\u7ed9\u51fa\u7ed3\u8bba\u4e0e\u9002\u7528\u8303\u56f4\u3002"]
                    final = "\u8fd9\u662f\u4e00\u4e2a\u793a\u4f8b\u8349\u7a3f\u56de\u7b54\uff08mock \u6a21\u5f0f\uff09\u3002"
                else:
                    reasoning = ["Give background concept.", "List key mechanism.", "State conclusion and scope."]
                    final = "This is a mock draft answer."
            if lang == "zh":
                draft = "\u63a8\u7406\u6458\u8981\uff1a\n- " + "\n- ".join(reasoning) + "\n\n\u7ed3\u8bba\uff1a" + final
            else:
                draft = "Reasoning summary:\n- " + "\n- ".join(reasoning) + "\n\nConclusion: " + final
            return {"reasoning_summary": reasoning, "final_answer": final, "draft_answer": draft}

        if name == "extracted_claims":
            # Minimal, deterministic claims for the default demo question.
            if topic == "metal_resistivity" and "\u91d1\u5c5e" in user_text and ("\u7535\u963b" in user_text or "\u7535\u963b\u7387" in user_text):
                claims = [
                    {
                        "claim_id": "C1",
                        "text": "\u5728\u591a\u6570\u91d1\u5c5e\u4e2d\uff0c\u5ba4\u6e29\u9644\u8fd1\u7535\u963b\u7387\u968f\u6e29\u5ea6\u5347\u9ad8\u800c\u589e\u5927\uff0c\u5e38\u8fd1\u4f3c\u7ebf\u6027\u3002",
                        "category": "fact",
                        "supports_final": True,
                        "critical": True,
                    },
                    {
                        "claim_id": "C2",
                        "text": "\u6e29\u5ea6\u5347\u9ad8\u4f1a\u589e\u5f3a\u6676\u683c\u70ed\u632f\u52a8\uff0c\u4ece\u800c\u589e\u52a0\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u3002",
                        "category": "mechanism",
                        "supports_final": True,
                        "critical": True,
                    },
                    {
                        "claim_id": "C3",
                        "text": "\u6563\u5c04\u589e\u5f3a\u4f1a\u964d\u4f4e\u7535\u5b50\u8fc1\u79fb\u7387\uff0c\u4ece\u800c\u63d0\u9ad8\u7535\u963b\u7387\uff08\u5728\u8f7d\u6d41\u5b50\u6d53\u5ea6\u8fd1\u4f3c\u4e0d\u53d8\u65f6\uff09\u3002",
                        "category": "mechanism",
                        "supports_final": True,
                        "critical": True,
                    },
                    {
                        "claim_id": "C4",
                        "text": "\u534a\u5bfc\u4f53\u901a\u5e38\u8868\u73b0\u4e3a\u6e29\u5ea6\u5347\u9ad8\u7535\u963b\u964d\u4f4e\uff0c\u8fd9\u4e0e\u91d1\u5c5e\u76f8\u53cd\u3002",
                        "category": "fact",
                        "supports_final": False,
                        "critical": False,
                    },
                ]
            elif topic == "metal_resistivity" and ("metal" in user_text.lower() or "metals" in user_text.lower()) and ("resistance" in user_text.lower() or "resistivity" in user_text.lower()):
                claims = [
                    {
                        "claim_id": "C1",
                        "text": "For most metals near room temperature, resistivity increases with temperature and is often approximately linear.",
                        "category": "fact",
                        "supports_final": True,
                        "critical": True,
                    },
                    {
                        "claim_id": "C2",
                        "text": "Raising temperature increases lattice vibrations (phonons), which increases electron–phonon scattering.",
                        "category": "mechanism",
                        "supports_final": True,
                        "critical": True,
                    },
                    {
                        "claim_id": "C3",
                        "text": "In the Drude picture with roughly constant carrier density, increased scattering lowers mobility and raises resistivity.",
                        "category": "mechanism",
                        "supports_final": True,
                        "critical": True,
                    },
                    {
                        "claim_id": "C4",
                        "text": "Semiconductors often show decreasing resistance with increasing temperature, opposite to metals.",
                        "category": "fact",
                        "supports_final": False,
                        "critical": False,
                    },
                ]
            elif topic == "free_fall":
                if lang == "zh":
                    claims = [
                        {
                            "claim_id": "C1",
                            "text": "\u5ffd\u7565\u7a7a\u6c14\u963b\u529b\u4e14 g \u8fd1\u4f3c\u5e38\u6570\u65f6\uff0c\u81ea\u7531\u843d\u4f53\u4f4d\u79fb\u6ee1\u8db3 h = (1/2) g t^2\uff0c\u56e0\u6b64 t = sqrt(2h/g)\u3002",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C2",
                            "text": "\u81ea\u7531\u843d\u4f53\u672b\u901f\u5ea6\u6ee1\u8db3 v = g t = sqrt(2gh)\u3002",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C3",
                            "text": "\u53d6 h=45 m\u3001g≈9.8 m/s^2\uff0c\u5f97\u5230 t≈3.03 s\u3002",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C4",
                            "text": "\u5bf9\u5e94\u672b\u901f\u5ea6 v≈29.7 m/s\uff08\u5411\u4e0b\uff09\u3002",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                    ]
                else:
                    claims = [
                        {
                            "claim_id": "C1",
                            "text": "Ignoring air resistance with constant g, free-fall distance satisfies h = (1/2) g t^2, so t = sqrt(2h/g).",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C2",
                            "text": "The impact speed satisfies v = g t = sqrt(2gh).",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C3",
                            "text": "For h=45 m and g≈9.8 m/s^2, the time is t≈3.03 s.",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C4",
                            "text": "The speed just before impact is v≈29.7 m/s downward.",
                            "category": "calculation",
                            "supports_final": True,
                            "critical": True,
                        },
                    ]
            elif topic == "reaction_rate_temp":
                if lang == "zh":
                    claims = [
                        {
                            "claim_id": "C1",
                            "text": "\u6e29\u5ea6\u5347\u9ad8\u4f1a\u63d0\u9ad8\u5206\u5b50\u5e73\u5747\u52a8\u80fd\uff0c\u4f7f\u78b0\u649e\u66f4\u9891\u7e41\u4e14\u76f8\u5bf9\u901f\u5ea6\u66f4\u5927\u3002",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C2",
                            "text": "Arrhenius \u516c\u5f0f k = A·exp(-Ea/RT) \u8868\u660e\u5728 Ea>0 \u65f6\uff0c\u6e29\u5ea6\u5347\u9ad8\u901a\u5e38\u4f7f\u901f\u7387\u5e38\u6570 k \u589e\u5927\u3002",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C3",
                            "text": "\u5347\u6e29\u4f1a\u663e\u8457\u589e\u52a0\u80fd\u91cf\u8d85\u8fc7\u6d3b\u5316\u80fd Ea \u7684\u5206\u5b50\u6bd4\u4f8b\uff0c\u4ece\u800c\u589e\u52a0\u6709\u6548\u78b0\u649e\u4e0e\u53cd\u5e94\u53d1\u751f\u6982\u7387\u3002",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C4",
                            "text": "\u6e29\u5ea6\u5bf9\u901f\u7387\u5f71\u54cd\u7684\u5f3a\u5f31\u4e0e\u6d3b\u5316\u80fd Ea \u6709\u5173\uff1aEa \u8d8a\u5927\uff0c\u5347\u6e29\u5e26\u6765\u7684\u76f8\u5bf9\u52a0\u901f\u901a\u5e38\u8d8a\u660e\u663e\u3002",
                            "category": "intermediate_conclusion",
                            "supports_final": True,
                            "critical": False,
                        },
                    ]
                else:
                    claims = [
                        {
                            "claim_id": "C1",
                            "text": "Increasing temperature raises average molecular kinetic energy, leading to more frequent and more energetic collisions.",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C2",
                            "text": "The Arrhenius form k = A·exp(-Ea/(RT)) implies that for Ea>0, increasing T typically increases the rate constant k.",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C3",
                            "text": "Higher temperature increases the fraction of molecules with energy above the activation energy Ea, increasing effective collisions and reaction probability.",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C4",
                            "text": "Temperature sensitivity depends on activation energy: reactions with larger Ea often speed up more (in relative terms) when temperature increases.",
                            "category": "intermediate_conclusion",
                            "supports_final": True,
                            "critical": False,
                        },
                    ]
            elif topic == "antibiotics_vs_viruses":
                if lang == "zh":
                    claims = [
                        {
                            "claim_id": "C1",
                            "text": "\u6297\u751f\u7d20\u4e3b\u8981\u9488\u5bf9\u7ec6\u83cc\u7279\u6709\u7ed3\u6784\u6216\u8fc7\u7a0b\uff08\u5982\u7ec6\u80de\u58c1\u5408\u6210\u3001\u7ec6\u83cc\u6838\u7cd6\u4f53\u86cb\u767d\u5408\u6210\uff09\u3002",
                            "category": "fact",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C2",
                            "text": "\u75c5\u6bd2\u7f3a\u4e4f\u8fd9\u4e9b\u7ec6\u83cc\u9776\u70b9\uff0c\u5e76\u4e3b\u8981\u4f9d\u8d56\u5bbf\u4e3b\u7ec6\u80de\u673a\u5236\u8fdb\u884c\u590d\u5236\uff0c\u56e0\u6b64\u6297\u751f\u7d20\u901a\u5e38\u4e0d\u80fd\u76f4\u63a5\u6291\u5236\u75c5\u6bd2\u590d\u5236\u3002",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C3",
                            "text": "\u75c5\u6bd2\u611f\u67d3\u53ef\u5408\u5e76\u7ee7\u53d1\u7ec6\u83cc\u611f\u67d3\uff1b\u6b64\u65f6\u6297\u751f\u7d20\u53ef\u4ee5\u7528\u4e8e\u6cbb\u7597\u7ec6\u83cc\u611f\u67d3\u90e8\u5206\u3002",
                            "category": "fact",
                            "supports_final": False,
                            "critical": False,
                        },
                    ]
                else:
                    claims = [
                        {
                            "claim_id": "C1",
                            "text": "Antibiotics are designed to target bacteria-specific structures or processes (e.g., cell wall synthesis or bacterial ribosomes).",
                            "category": "fact",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C2",
                            "text": "Viruses lack those bacterial targets and replicate using host-cell machinery, so antibiotics generally do not directly stop viral replication.",
                            "category": "mechanism",
                            "supports_final": True,
                            "critical": True,
                        },
                        {
                            "claim_id": "C3",
                            "text": "Antibiotics can be useful if a viral illness is complicated by a secondary bacterial infection.",
                            "category": "fact",
                            "supports_final": False,
                            "critical": False,
                        },
                    ]
            else:
                claims = [
                    {
                        "claim_id": "C1",
                        "text": "\u8fd9\u662f\u4e00\u4e2a\u793a\u4f8b claim\uff08mock \u6a21\u5f0f\uff09\u3002" if lang == "zh" else "This is a sample claim (mock mode).",
                        "category": "other",
                        "supports_final": True,
                        "critical": True,
                    }
                ]
            return {"claims": claims}

        if name == "verification_questions":
            # Claim-specific questions (mock): derive from CLAIM_TEXT.
            claim_text = self._extract_block(user_text, "CLAIM_TEXT:", "Generate") or self._extract_block(
                user_text, "CLAIM_TEXT:", "\u8bf7\u751f\u6210"
            )
            n = self._extract_tail_int(user_text, default=3)

            ct = claim_text.lower()
            if topic == "free_fall":
                if lang == "zh":
                    if ("v" in ct) or ("\u901f\u5ea6" in claim_text):
                        pool = [
                            ("Q1", "\u81ea\u7531\u843d\u4f53\u4ece\u9759\u6b62\u5f00\u59cb\uff0c\u901f\u5ea6 v \u4e0e\u65f6\u95f4 t \u7684\u5173\u7cfb\u5f0f\u662f\u4ec0\u4e48\uff1f", "calculation"),
                            ("Q2", "\u81ea\u7531\u843d\u4f53\u672b\u901f\u5ea6 v \u4e0e\u9ad8\u5ea6 h \u7684\u5173\u7cfb\u5f0f\u662f\u4ec0\u4e48\uff1f", "calculation"),
                            ("Q3", "\u4ee3\u5165 h=45 m\u3001g=9.8 m/s^2\uff0cv \u7ea6\u7b49\u4e8e\u591a\u5c11 m/s\uff1f", "calculation"),
                        ]
                    elif ("t" in ct) or ("\u65f6\u95f4" in claim_text) or ("sqrt" in ct):
                        pool = [
                            ("Q1", "\u81ea\u7531\u843d\u4f53\u4ece\u9759\u6b62\u5f00\u59cb\uff0c\u4f4d\u79fb h \u4e0e\u65f6\u95f4 t \u7684\u5173\u7cfb\u5f0f\u662f\u4ec0\u4e48\uff1f", "calculation"),
                            ("Q2", "\u7531 h=(1/2)gt^2 \u89e3\u51fa t \u5173\u4e8e h \u4e0e g \u7684\u8868\u8fbe\u5f0f\u3002", "calculation"),
                            ("Q3", "\u4ee3\u5165 h=45 m\u3001g=9.8 m/s^2\uff0ct \u7ea6\u7b49\u4e8e\u591a\u5c11\u79d2\uff1f", "calculation"),
                        ]
                    else:
                        pool = [("Q1", "\u8be5 claim \u4f9d\u8d56\u54ea\u4e9b\u8fd1\u4f3c/\u5047\u8bbe\uff1f", "explanation")]
                else:
                    if (" v" in ct) or ct.startswith("v") or ("speed" in ct) or ("impact" in ct):
                        pool = [
                            ("Q1", "In free fall from rest, what is the relationship between speed v and time t?", "calculation"),
                            ("Q2", "State the relationship between impact speed and height: v = sqrt(2gh).", "calculation"),
                            ("Q3", "For h=45 m and g=9.8 m/s^2, what is v approximately?", "calculation"),
                        ]
                    elif ("t" in ct) or ("time" in ct) or ("sqrt" in ct):
                        pool = [
                            ("Q1", "In free fall from rest (no air resistance), what is the relationship between height h and time t?", "calculation"),
                            ("Q2", "Solve h=(1/2)gt^2 for t in terms of h and g.", "calculation"),
                            ("Q3", "For h=45 m and g=9.8 m/s^2, what is t approximately?", "calculation"),
                        ]
                    else:
                        pool = [("Q1", "What assumptions are needed for this claim to hold?", "explanation")]
                questions = [{"question_id": qid, "question": q, "expected_answer_type": t} for (qid, q, t) in pool[:n]]
                return {"questions": questions}
            if topic == "reaction_rate_temp":
                # Claim-specific question sets based on claim_text.
                if lang == "zh":
                    if "arrhenius" in ct or "exp(" in ct or "Ea" in claim_text:
                        pool = [
                            ("Q1", "\u5199\u51fa Arrhenius \u5f62\u5f0f\u7684\u901f\u7387\u5e38\u6570\u8868\u8fbe\u5f0f\uff0c\u5e76\u6307\u51fa T \u589e\u5927\u5bf9 k \u7684\u5f71\u54cd\u65b9\u5411\u3002", "short_fact"),
                            ("Q2", "\u5728 Ea>0 \u7684\u524d\u63d0\u4e0b\uff0c\u4e3a\u4ec0\u4e48 Arrhenius \u6307\u6570\u9879\u4f1a\u8ba9\u5347\u6e29\u663e\u8457\u52a0\u901f\u53cd\u5e94\uff1f", "explanation"),
                            ("Q3", "\u5982\u679c Ea≈0\uff0c\u6e29\u5ea6\u5bf9\u901f\u7387\u5e38\u6570\u7684\u5f71\u54cd\u4f1a\u66f4\u5f3a\u8fd8\u662f\u66f4\u5f31\uff1f\uff08\u5f3a/\u5f31\uff09", "short_fact"),
                        ]
                    elif "\u6d3b\u5316\u80fd" in claim_text or "\u8d85\u8fc7" in claim_text:
                        pool = [
                            ("Q1", "\u5347\u6e29\u4f1a\u8ba9\u80fd\u91cf\u5206\u5e03\uff08Maxwell-Boltzmann\uff09\u5411\u9ad8\u80fd\u7aef\u600e\u6837\u53d8\u5316\uff1f", "short_fact"),
                            ("Q2", "\u4e3a\u4ec0\u4e48“\u8d85\u8fc7 Ea \u7684\u5206\u5b50\u6bd4\u4f8b”\u5bf9\u53cd\u5e94\u901f\u7387\u5f88\u5173\u952e\uff1f", "explanation"),
                            ("Q3", "\u5728 Ea \u56fa\u5b9a\u65f6\uff0cT \u5347\u9ad8\u4f1a\u8ba9\u8d85\u8fc7 Ea \u7684\u5206\u5b50\u6bd4\u4f8b\u589e\u5927\u8fd8\u662f\u51cf\u5c0f\uff1f", "short_fact"),
                        ]
                    else:
                        pool = [
                            ("Q1", "\u6e29\u5ea6\u5347\u9ad8\u5bf9\u5206\u5b50\u78b0\u649e\u9891\u7387\u548c\u78b0\u649e\u80fd\u91cf\u7684\u65b9\u5411\u6027\u5f71\u54cd\u662f\u4ec0\u4e48\uff1f", "short_fact"),
                            ("Q2", "\u4e3a\u4ec0\u4e48\u66f4\u9ad8\u7684\u78b0\u649e\u80fd\u91cf\u53ef\u80fd\u63d0\u9ad8\u53cd\u5e94\u53d1\u751f\u6982\u7387\uff1f", "explanation"),
                            ("Q3", "\u6e29\u5ea6\u5347\u9ad8\u662f\u5426\u4e00\u5b9a\u8ba9\u6240\u6709\u53cd\u5e94\u90fd\u53d8\u5feb\uff1f\u7ed9\u51fa\u4e00\u4e2a\u4f8b\u5916\u7c7b\u578b\uff08\u5982\u53d7\u6269\u6563/\u5e73\u8861\u9650\u5236\uff09\u3002", "explanation"),
                        ]
                else:
                    if "arrhenius" in ct or "exp(" in ct or "ea" in ct:
                        pool = [
                            ("Q1", "State the Arrhenius form for k and the direction of change in k when T increases (for Ea>0).", "short_fact"),
                            ("Q2", "Why does the Arrhenius exponential term make reaction rates increase strongly with temperature?", "explanation"),
                            ("Q3", "If Ea≈0, is temperature sensitivity of k stronger or weaker? (Answer stronger/weaker.)", "short_fact"),
                        ]
                    elif "activation energy" in ct or "above" in ct:
                        pool = [
                            ("Q1", "How does raising temperature change the Maxwell–Boltzmann energy distribution (high-energy tail)?", "short_fact"),
                            ("Q2", "Why is the fraction of molecules with energy above Ea important for reaction rate?", "explanation"),
                            ("Q3", "With Ea fixed, does increasing T increase or decrease the fraction above Ea?", "short_fact"),
                        ]
                    else:
                        pool = [
                            ("Q1", "What is the directional effect of increasing temperature on collision frequency and collision energy?", "short_fact"),
                            ("Q2", "Why can higher collision energy increase the probability of reaction per collision?", "explanation"),
                            ("Q3", "Does increasing temperature always speed up every reaction? Name a limiting case (e.g., diffusion-limited).", "explanation"),
                        ]
                questions = [{"question_id": f"Q{i+1}", "question": q, "expected_answer_type": t} for i, (_, q, t) in enumerate(pool[:n])]
                return {"questions": questions}
            if topic == "antibiotics_vs_viruses":
                if lang == "zh":
                    if ("\u7ee7\u53d1" in claim_text) or ("\u7ec6\u83cc\u611f\u67d3" in claim_text):
                        pool = [
                            ("Q1", "\u75c5\u6bd2\u611f\u67d3\u5408\u5e76\u7ee7\u53d1\u7ec6\u83cc\u611f\u67d3\u65f6\uff0c\u6297\u751f\u7d20\u662f\u5426\u53ef\u80fd\u6709\u7528\uff1f\uff08\u56de\u7b54\u662f/\u5426\uff09", "yes_no"),
                            ("Q2", "\u6297\u751f\u7d20\u5728\u8fd9\u79cd\u60c5\u51b5\u4e0b\u4e3b\u8981\u6cbb\u7597\u7684\u662f\u75c5\u6bd2\u8fd8\u662f\u7ec6\u83cc\uff1f\uff08\u75c5\u6bd2/\u7ec6\u83cc\uff09", "short_fact"),
                            ("Q3", "\u7ed9\u51fa\u4e00\u4e2a\u5178\u578b\u4f8b\u5b50\uff1a\u54ea\u7c7b\u7ee7\u53d1\u7ec6\u83cc\u611f\u67d3\u53ef\u80fd\u9700\u8981\u6297\u751f\u7d20\uff1f", "explanation"),
                        ]
                    elif ("\u75c5\u6bd2" in claim_text) and ("\u5bbf\u4e3b" in claim_text):
                        pool = [
                            ("Q1", "\u75c5\u6bd2\u662f\u5426\u5177\u6709\u7ec6\u83cc\u7ec6\u80de\u58c1\u6216\u7ec6\u83cc\u6838\u7cd6\u4f53\u8fd9\u7c7b\u6297\u751f\u7d20\u5e38\u89c1\u9776\u70b9\uff1f\uff08\u56de\u7b54\u662f/\u5426\uff09", "yes_no"),
                            ("Q2", "\u75c5\u6bd2\u590d\u5236\u4e3b\u8981\u4f9d\u8d56\u5bbf\u4e3b\u7ec6\u80de\u673a\u5236\uff0c\u8fd9\u662f\u5426\u4f1a\u524a\u5f31\u6297\u751f\u7d20\u7684\u76f4\u63a5\u4f5c\u7528\uff1f\uff08\u56de\u7b54\u662f/\u5426\uff09", "yes_no"),
                            ("Q3", "\u7528\u4e00\u53e5\u8bdd\u8bf4\u660e\uff1a\u4e3a\u4ec0\u4e48“\u7f3a\u4e4f\u9776\u70b9”\u4f1a\u5bfc\u81f4\u6297\u751f\u7d20\u5bf9\u75c5\u6bd2\u65e0\u6548\uff1f", "short_fact"),
                        ]
                    else:
                        pool = [
                            ("Q1", "\u6297\u751f\u7d20\u4e3b\u8981\u9776\u5411\u7684\u662f\u7ec6\u83cc\u8fd8\u662f\u75c5\u6bd2\uff1f\uff08\u7ec6\u83cc/\u75c5\u6bd2\uff09", "short_fact"),
                            ("Q2", "\u7ec6\u80de\u58c1\u5408\u6210\u662f\u5426\u662f\u6297\u751f\u7d20\u5e38\u89c1\u4f5c\u7528\u9776\u70b9\u4e4b\u4e00\uff1f\uff08\u56de\u7b54\u662f/\u5426\uff09", "yes_no"),
                            ("Q3", "\u7528\u4e00\u53e5\u8bdd\u4e3e\u4f8b\u8bf4\u660e\uff1a\u4e00\u4e2a\u5178\u578b\u6297\u751f\u7d20\u9776\u70b9\u662f\u4ec0\u4e48\uff1f", "short_fact"),
                        ]
                else:
                    if ("secondary" in ct) or ("bacterial infection" in ct):
                        pool = [
                            ("Q1", "Can antibiotics be useful when a viral illness is complicated by a secondary bacterial infection? (Answer yes/no.)", "yes_no"),
                            ("Q2", "In that situation, are antibiotics treating the virus or the bacteria? (virus/bacteria)", "short_fact"),
                            ("Q3", "Give one example of a secondary bacterial infection scenario where antibiotics may be indicated.", "explanation"),
                        ]
                    elif ("host" in ct) or ("replicate" in ct) or ("viral replication" in ct):
                        pool = [
                            ("Q1", "Do viruses have bacterial cell walls or bacterial ribosomes that many antibiotics target? (Answer yes/no.)", "yes_no"),
                            ("Q2", "Do antibiotics generally directly inhibit viral replication? (Answer yes/no.)", "yes_no"),
                            ("Q3", "In one sentence: why does 'no bacterial target' imply antibiotics are ineffective against viruses?", "short_fact"),
                        ]
                    else:
                        pool = [
                            ("Q1", "Do antibiotics primarily target bacteria rather than viruses? (Answer yes/no.)", "yes_no"),
                            ("Q2", "Is bacterial cell wall synthesis a common antibiotic target? (Answer yes/no.)", "yes_no"),
                            ("Q3", "Name one bacteria-specific antibiotic target (e.g., cell wall, bacterial ribosome).", "short_fact"),
                        ]
                questions = [{"question_id": qid, "question": q, "expected_answer_type": t} for (qid, q, t) in pool[:n]]
                return {"questions": questions}
            if lang == "zh":
                if "\u534a\u5bfc\u4f53" in claim_text:
                    pool = [
                        ("Q1", "\u534a\u5bfc\u4f53\u7535\u963b/\u7535\u5bfc\u968f\u6e29\u5ea6\u53d8\u5316\u901a\u5e38\u5448\u4ec0\u4e48\u8d8b\u52bf\uff1f\u4e3b\u8981\u7531\u4ec0\u4e48\u91cf\u53d8\u5316\u4e3b\u5bfc\uff1f", "explanation"),
                        ("Q2", "\u7528\u80fd\u5e26\u89c2\u70b9\u89e3\u91ca\uff1a\u6e29\u5ea6\u5347\u9ad8\u4e3a\u4ec0\u4e48\u53ef\u80fd\u589e\u52a0\u8f7d\u6d41\u5b50\u6d53\u5ea6\uff1f", "explanation"),
                        ("Q3", "\u5728\u54ea\u4e9b\u60c5\u51b5\u4e0b\u534a\u5bfc\u4f53\u7535\u963b\u968f\u6e29\u5ea6\u5347\u9ad8\u53cd\u800c\u4f1a\u589e\u5927\uff08\u6216\u4e0d\u5355\u8c03\uff09\uff1f", "explanation"),
                        ("Q4", "\u4e0e\u91d1\u5c5e\u76f8\u6bd4\uff0c\u534a\u5bfc\u4f53\u7684\u6e29\u5ea6\u7cfb\u6570\u7b26\u53f7\u901a\u5e38\u6709\u4ec0\u4e48\u4e0d\u540c\uff1f", "short_fact"),
                    ]
                elif ("\u58f0\u5b50" in claim_text) or ("\u7535\u5b50-\u58f0\u5b50" in claim_text) or ("\u6563\u5c04" in claim_text):
                    pool = [
                        ("Q1", "\u4ec0\u4e48\u662f\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\uff1f\u6e29\u5ea6\u5347\u9ad8\u65f6\u58f0\u5b50\u6570\u5982\u4f55\u53d8\u5316\uff1f", "definition"),
                        ("Q2", "\u4e3a\u4ec0\u4e48\u6563\u5c04\u589e\u5f3a\u4f1a\u964d\u4f4e\u5e73\u5747\u81ea\u7531\u7a0b/\u5f1b\u8c6b\u65f6\u95f4\uff1f", "explanation"),
                        ("Q3", "\u5728\u4f4e\u6e29\u6781\u9650\uff0c\u91d1\u5c5e\u7535\u963b\u901a\u5e38\u7531\u54ea\u4e9b\u673a\u5236\u4e3b\u5bfc\uff1f", "explanation"),
                        ("Q4", "Matthiessen \u5b9a\u5219\u662f\u4ec0\u4e48\uff1f\u5b83\u5728\u89e3\u91ca\u6e29\u5ea6\u4f9d\u8d56\u65f6\u6709\u4ec0\u4e48\u4f5c\u7528/\u5c40\u9650\uff1f", "explanation"),
                    ]
                elif ("drude" in ct) or ("\u8fc1\u79fb\u7387" in claim_text) or ("\u8f7d\u6d41\u5b50" in claim_text):
                    pool = [
                        ("Q1", "Drude \u6a21\u578b\u4e2d\u7535\u5bfc\u7387 σ \u4e0e n\u3001e\u3001μ\uff08\u6216\u5f1b\u8c6b\u65f6\u95f4 τ\uff09\u4e4b\u95f4\u7684\u5173\u7cfb\u662f\u4ec0\u4e48\uff1f", "calculation"),
                        ("Q2", "\u8fc1\u79fb\u7387 μ \u4e0e\u6563\u5c04/\u5f1b\u8c6b\u65f6\u95f4 τ \u7684\u5173\u7cfb\u662f\u4ec0\u4e48\uff1f\u6e29\u5ea6\u5347\u9ad8\u901a\u5e38\u5982\u4f55\u5f71\u54cd μ\uff1f", "explanation"),
                        ("Q3", "\u82e5\u8f7d\u6d41\u5b50\u6d53\u5ea6 n \u53d8\u5316\u663e\u8457\uff08\u5982\u534a\u5bfc\u4f53\uff09\uff0c\u8fd8\u53ef\u4ee5\u7528“μ \u964d\u4f4e→ρ \u5347\u9ad8”\u76f4\u63a5\u5224\u65ad\u5417\uff1f", "explanation"),
                        ("Q4", "\u7528\u4e00\u53e5\u8bdd\u8bf4\u660e\uff1a\u4e3a\u4ec0\u4e48\u4fdd\u6301 n \u4e0d\u53d8\u65f6\uff0cμ \u4e0b\u964d\u4f1a\u4f7f ρ \u4e0a\u5347\uff1f", "short_fact"),
                    ]
                else:
                    pool = [
                        ("Q1", "\u91d1\u5c5e\u7535\u963b\u7387\u5728\u5ba4\u6e29\u9644\u8fd1\u968f\u6e29\u5ea6\u53d8\u5316\u7684\u7ecf\u9a8c\u5173\u7cfb\u901a\u5e38\u662f\u4ec0\u4e48\u5f62\u5f0f\uff1f", "short_fact"),
                        ("Q2", "\u5728\u54ea\u4e9b\u6e29\u5ea6\u8303\u56f4\u8fd9\u79cd“\u8fd1\u4f3c\u7ebf\u6027”\u66f4\u5bb9\u6613\u6210\u7acb\uff1f\u4f4e\u6e29\u65f6\u4f1a\u53d1\u751f\u4ec0\u4e48\u504f\u79bb\uff1f", "explanation"),
                        ("Q3", "\u4e3a\u4ec0\u4e48\u7eaf\u5ea6/\u6742\u8d28\u4f1a\u5f71\u54cd\u7535\u963b\u7387\u7684\u6e29\u5ea6\u4f9d\u8d56\uff08\u6b8b\u4f59\u7535\u963b\uff09\uff1f", "explanation"),
                        ("Q4", "\u4e3e\u4e00\u4e2a\u4f8b\u5b50\uff1a\u54ea\u4e9b\u91d1\u5c5e/\u5408\u91d1\u53ef\u80fd\u51fa\u73b0\u975e\u5178\u578b\u6e29\u5ea6\u4f9d\u8d56\uff1f\u539f\u56e0\u53ef\u80fd\u662f\u4ec0\u4e48\uff1f", "explanation"),
                    ]
                questions = [
                    {"question_id": qid, "question": q, "expected_answer_type": t} for (qid, q, t) in pool[:n]
                ]
                return {"questions": questions}

            # English
            if "semiconductor" in ct:
                pool = [
                    ("Q1", "How does a semiconductor’s resistance typically change with temperature, and what physical quantity mainly drives it?", "explanation"),
                    ("Q2", "From a band-structure view, why can increasing temperature increase carrier concentration?", "explanation"),
                    ("Q3", "When might a semiconductor’s resistance increase with temperature or become non-monotonic?", "explanation"),
                    ("Q4", "Compared with metals, what is the usual sign of the temperature coefficient of resistance in semiconductors?", "short_fact"),
                ]
            elif ("phonon" in ct) or ("electron-phonon" in ct) or ("scattering" in ct):
                pool = [
                    ("Q1", "What is electron–phonon scattering, and how does phonon population change with temperature?", "definition"),
                    ("Q2", "Why does increased scattering reduce relaxation time/mean free path?", "explanation"),
                    ("Q3", "At low temperatures, what mechanisms typically dominate a metal’s resistivity?", "explanation"),
                    ("Q4", "What is Matthiessen’s rule and how does it relate to temperature-dependent resistivity?", "explanation"),
                ]
            elif ("drude" in ct) or ("mobility" in ct) or ("carrier density" in ct):
                pool = [
                    ("Q1", "In the Drude model, how are σ, n, e, μ (or relaxation time τ) related?", "calculation"),
                    ("Q2", "How is mobility related to scattering/relaxation time, and how does temperature typically affect mobility in metals?", "explanation"),
                    ("Q3", "If carrier density changes significantly (e.g., semiconductors), does “lower mobility → higher resistivity” still determine the sign? Why/why not?", "explanation"),
                    ("Q4", "In one sentence: with roughly constant n, why does lower μ imply higher ρ?", "short_fact"),
                ]
            else:
                pool = [
                    ("Q1", "Near room temperature, what empirical relationship often describes a metal’s resistivity vs. temperature?", "short_fact"),
                    ("Q2", "Over what temperature ranges is the “roughly linear” approximation more valid, and what deviations appear at low T?", "explanation"),
                    ("Q3", "How do impurities/defects affect the temperature dependence (residual resistivity)?", "explanation"),
                    ("Q4", "Give an example where resistivity is not simply linear in T (e.g., certain alloys) and a plausible reason.", "explanation"),
                ]

            questions = [{"question_id": qid, "question": q, "expected_answer_type": t} for (qid, q, t) in pool[:n]]
            return {"questions": questions}

        if name == "verification_answer":
            # Decide based primarily on the verification question block (not the claim text).
            vq = self._extract_block(user_text, "VERIFICATION_QUESTION:", "CLAIM_TO_EVALUATE:")
            q = (vq or user_text).strip()
            ql = q.lower()

            if topic == "free_fall":
                # Prioritize speed questions (avoid being captured by t/h formulas when claim text is present).
                if ("speed" in ql or re.search(r"\bv\b", ql) or "\u901f\u5ea6" in q) and ("time" in ql or re.search(r"\bt\b", ql) or "\u65f6\u95f4" in q):
                    return {
                        "answer": "v = g t (starting from rest).",
                        "stance_wrt_claim": "SUPPORTS",
                        "confidence": 0.8,
                        "rationale_brief": "Constant acceleration: v=at.",
                    }
                if "sqrt(2gh)" in ql or ("impact speed" in ql and "height" in ql) or ("\u672b\u901f\u5ea6" in q and "\u9ad8\u5ea6" in q):
                    return {
                        "answer": "v = sqrt(2gh).",
                        "stance_wrt_claim": "SUPPORTS",
                        "confidence": 0.8,
                        "rationale_brief": "From v^2 = 2gh for drop from rest.",
                    }
                if ("h=45" in ql and (" v" in ql or "speed" in ql)) or ("what is v" in ql and "45" in ql) or ("v" in ql and "45" in ql and "approximately" in ql):
                    return {
                        "answer": "v ≈ sqrt(2·9.8·45) ≈ 29.7 m/s downward.",
                        "stance_wrt_claim": "SUPPORTS",
                        "confidence": 0.78,
                        "rationale_brief": "Plug into v = sqrt(2gh).",
                    }
            if topic == "reaction_rate_temp":
                if lang == "zh":
                    if "arrhenius" in ql or "exp(" in ql or "\u901f\u7387\u5e38\u6570" in q:
                        return {
                            "answer": "\u589e\u5927\u3002Arrhenius\uff1ak = A·exp(-Ea/RT)\uff0cEa>0 \u65f6 T↑ ⇒ -Ea/RT \u53d8\u5f97\u4e0d\u90a3\u4e48\u8d1f ⇒ k↑\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "Arrhenius \u6307\u6570\u9879\u968f T \u589e\u5927\u800c\u589e\u5927\u3002",
                        }
                    if "maxwell" in ql or "boltzmann" in ql or "\u80fd\u91cf\u5206\u5e03" in q:
                        return {
                            "answer": "\u589e\u5927\uff08\u9ad8\u80fd\u5c3e\u90e8\u53d8“\u66f4\u539a”\uff09\u3002\u6e29\u5ea6\u5347\u9ad8\u4f1a\u4f7f\u5206\u5b50\u80fd\u91cf\u5206\u5e03\u5411\u66f4\u9ad8\u80fd\u91cf\u6269\u5c55\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "\u9ad8\u6e29\u589e\u52a0\u9ad8\u80fd\u5206\u5b50\u6bd4\u4f8b\u3002",
                        }
                    if "\u8d85\u8fc7" in q and "Ea" in q:
                        return {
                            "answer": "\u589e\u5927\u3002T \u5347\u9ad8\u4f1a\u63d0\u9ad8\u8d85\u8fc7 Ea \u7684\u5206\u5b50\u6bd4\u4f8b\uff0c\u4ece\u800c\u589e\u52a0\u53ef\u53d1\u751f\u53cd\u5e94\u7684\u6709\u6548\u78b0\u649e\u6570\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.75,
                            "rationale_brief": "\u53cd\u5e94\u901a\u5e38\u9700\u8981\u8de8\u8d8a\u6d3b\u5316\u80fd\u52bf\u5792\u3002",
                        }
                    if "\u78b0\u649e" in q and ("\u9891\u7387" in q or "\u80fd\u91cf" in q):
                        return {
                            "answer": "\u589e\u52a0\u3002\u6e29\u5ea6\u5347\u9ad8\u901a\u5e38\u4f1a\u63d0\u9ad8\u5e73\u5747\u52a8\u80fd\uff0c\u4f7f\u78b0\u649e\u66f4\u9891\u7e41\u4e14\u66f4\u5267\u70c8\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.72,
                            "rationale_brief": "\u66f4\u9ad8\u70ed\u8fd0\u52a8\u5e26\u6765\u66f4\u9ad8\u76f8\u5bf9\u901f\u5ea6\u3002",
                        }
                else:
                    if ("arrhenius" in ql and ("form for k" in ql or "k =" in ql or "rate constant" in ql)) or ("k =" in ql) or ("rate constant" in ql):
                        return {
                            "answer": "Increase. Arrhenius: k = A·exp(-Ea/(RT)); for Ea>0, increasing T increases k.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "The exponential term grows with temperature when Ea>0.",
                        }
                    if "exponential term" in ql and "why" in ql:
                        return {
                            "answer": "Because in the Arrhenius equation k = A·exp(-Ea/(RT)), k depends exponentially on -Ea/(RT): increasing T makes -Ea/(RT) less negative, so the exponential factor (and reaction rate) increases rapidly.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "Exponential dependence amplifies temperature changes.",
                        }
                    if ("ea≈0" in ql or "ea" in ql) and ("stronger" in ql or "weaker" in ql):
                        return {
                            "answer": "Weaker. If Ea≈0, the Arrhenius exponential changes little with T, so k is less temperature-sensitive.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.7,
                            "rationale_brief": "Small Ea reduces the temperature dependence of the exponential term.",
                        }
                    if "maxwell" in ql or "boltzmann" in ql or "distribution" in ql:
                        return {
                            "answer": "Increase (high-energy tail). Raising T shifts/broadens the energy distribution so more molecules populate higher energies.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "Higher temperature increases the fraction at high energies.",
                        }
                    if "fraction" in ql and "above" in ql and "ea" in ql:
                        return {
                            "answer": "Increase. With Ea fixed, higher T increases the fraction of molecules with energy above Ea, increasing effective collisions.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.75,
                            "rationale_brief": "More molecules can surmount the activation barrier.",
                        }
                    if "collision" in ql and ("frequency" in ql or "energy" in ql):
                        return {
                            "answer": "Increase. Higher temperature increases average kinetic energy, leading to more frequent and more energetic collisions.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.72,
                            "rationale_brief": "Faster molecules collide more often and with higher energy.",
                        }

            if topic == "antibiotics_vs_viruses":
                if lang == "zh":
                    if ("\u662f\u5426" in q and ("\u6709\u7528" in q or "\u53ef\u80fd\u6709\u7528" in q)) and ("\u7ee7\u53d1" in q or "\u7ec6\u83cc\u611f\u67d3" in q):
                        return {
                            "answer": "\u662f\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "\u6b64\u65f6\u6297\u751f\u7d20\u9488\u5bf9\u7684\u662f\u7ec6\u83cc\u5e76\u53d1\u611f\u67d3\u800c\u975e\u75c5\u6bd2\u672c\u8eab\u3002",
                        }
                    if ("\u6cbb\u7597" in q) and ("\u75c5\u6bd2" in q or "\u7ec6\u83cc" in q):
                        return {
                            "answer": "\u7ec6\u83cc\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.76,
                            "rationale_brief": "\u6297\u751f\u7d20\u4e3b\u8981\u7528\u4e8e\u6291\u5236/\u6740\u706d\u7ec6\u83cc\u3002",
                        }
                    if ("\u75c5\u6bd2" in q) and ("\u9776\u70b9" in q or "\u7ec6\u80de\u58c1" in q or "\u6838\u7cd6\u4f53" in q) and ("\u662f/\u5426" in q or "\u662f\u5426" in q):
                        return {
                            "answer": "\u5426\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.8,
                            "rationale_brief": "\u75c5\u6bd2\u7f3a\u4e4f\u7ec6\u83cc\u7ec6\u80de\u58c1\u4e0e\u7ec6\u83cc\u6838\u7cd6\u4f53\u7b49\u5e38\u89c1\u6297\u751f\u7d20\u9776\u70b9\u3002",
                        }
                    if ("\u6297\u751f\u7d20" in q) and ("\u75c5\u6bd2\u590d\u5236" in q or "\u6291\u5236" in q) and ("\u662f/\u5426" in q or "\u662f\u5426" in q):
                        return {
                            "answer": "\u5426\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "\u6297\u751f\u7d20\u9776\u5411\u7ec6\u83cc\u8fc7\u7a0b\uff0c\u901a\u5e38\u4e0d\u76f4\u63a5\u963b\u65ad\u75c5\u6bd2\u590d\u5236\u3002",
                        }
                    if ("\u4e3b\u8981\u9776\u5411" in q) and ("\u7ec6\u83cc" in q or "\u75c5\u6bd2" in q):
                        return {
                            "answer": "\u7ec6\u83cc\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "\u6297\u751f\u7d20\u9488\u5bf9\u7ec6\u83cc\u7279\u6709\u7ed3\u6784/\u8fc7\u7a0b\u3002",
                        }
                    if ("\u7ec6\u80de\u58c1" in q) and ("\u9776\u70b9" in q) and ("\u662f/\u5426" in q or "\u662f\u5426" in q):
                        return {
                            "answer": "\u662f\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.76,
                            "rationale_brief": "\u8bb8\u591a\u6297\u751f\u7d20\u901a\u8fc7\u6291\u5236\u80bd\u805a\u7cd6\u7ec6\u80de\u58c1\u5408\u6210\u53d1\u6325\u4f5c\u7528\u3002",
                        }
                    if ("\u9776\u70b9" in q) and ("\u4e3e\u4f8b" in q or "\u4f8b\u5982" in q):
                        return {
                            "answer": "\u7ec6\u80de\u58c1\u5408\u6210\uff08\u80bd\u805a\u7cd6\uff09\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "\u8fd9\u662f\u5178\u578b\u7ec6\u83cc\u7279\u5f02\u6027\u9776\u70b9\u4e4b\u4e00\u3002",
                        }
                    if ("\u4e3a\u4ec0\u4e48" in q) and ("\u65e0\u6548" in q or "\u7f3a\u4e4f\u9776\u70b9" in q):
                        return {
                            "answer": "\u56e0\u4e3a\u75c5\u6bd2\u7f3a\u4e4f\u6297\u751f\u7d20\u9776\u5411\u7684\u7ec6\u83cc\u7279\u5f02\u6027\u7ed3\u6784/\u8fc7\u7a0b\uff0c\u6240\u4ee5\u6297\u751f\u7d20\u96be\u4ee5\u8d77\u76f4\u63a5\u4f5c\u7528\u3002",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "\u7f3a\u5c11\u836f\u7269\u9776\u70b9\u5219\u96be\u4ee5\u6291\u5236\u3002",
                        }
                else:
                    if "secondary bacterial infection" in ql and ("yes/no" in ql):
                        return {
                            "answer": "Yes.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "In that case antibiotics target the bacterial complication, not the virus itself.",
                        }
                    if "give one example" in ql and "secondary bacterial infection" in ql:
                        return {
                            "answer": "For example, a viral respiratory infection complicated by secondary bacterial pneumonia can warrant antibiotics for the bacterial pneumonia.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.72,
                            "rationale_brief": "Antibiotics are used for the bacterial complication, not the virus.",
                        }
                    if ("treating" in ql or "treat" in ql) and ("virus" in ql or "bacteria" in ql):
                        return {
                            "answer": "Bacteria.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.76,
                            "rationale_brief": "Antibiotics treat bacterial co-infections, not viral replication.",
                        }
                    if ("do viruses have" in ql and ("cell wall" in ql or "ribosome" in ql)) and ("yes/no" in ql):
                        # Intentionally minimal to regression-test short, correct yes/no answers.
                        return {
                            "answer": "No.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.82,
                            "rationale_brief": "Viruses lack bacterial cell walls and bacterial ribosomes.",
                        }
                    if ("directly inhibit" in ql or "directly" in ql and "viral replication" in ql) and ("yes/no" in ql):
                        return {
                            "answer": "No.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.8,
                            "rationale_brief": "Most antibiotics act on bacterial targets, so they don’t directly block viral replication.",
                        }
                    if ("primarily target" in ql and "bacteria" in ql) and ("yes/no" in ql):
                        return {
                            "answer": "Yes.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.78,
                            "rationale_brief": "Antibiotics are designed for bacteria-specific biology.",
                        }
                    if "cell wall synthesis" in ql and ("yes/no" in ql):
                        return {
                            "answer": "Yes.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.76,
                            "rationale_brief": "Many antibiotics target peptidoglycan cell wall synthesis.",
                        }
                    if "name one" in ql and "target" in ql:
                        return {
                            "answer": "Cell wall (peptidoglycan) synthesis.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "This is a bacteria-specific antibiotic target.",
                        }
                    if "in one sentence" in ql and ("ineffective" in ql or "no bacterial target" in ql):
                        return {
                            "answer": "Because viruses lack the bacteria-specific targets that antibiotics act on, antibiotics are generally ineffective against viral infections.",
                            "stance_wrt_claim": "SUPPORTS",
                            "confidence": 0.74,
                            "rationale_brief": "No target → no direct antibiotic effect.",
                        }

                # Time questions.
                if ("solve" in ql and "for t" in ql) or ("t in terms" in ql) or ("\u89e3\u51fa" in q and "t" in ql):
                    return {
                        "answer": "t = sqrt(2h/g).",
                        "stance_wrt_claim": "SUPPORTS",
                        "confidence": 0.82,
                        "rationale_brief": "Rearrange h=(1/2)gt^2.",
                    }
                if ("h=45" in ql and re.search(r"\bt\b", ql)) or ("what is t" in ql and "45" in ql) or ("t" in ql and "45" in ql and "approximately" in ql):
                    return {
                        "answer": "t ≈ sqrt(2·45/9.8) ≈ 3.03 s.",
                        "stance_wrt_claim": "SUPPORTS",
                        "confidence": 0.78,
                        "rationale_brief": "Plug into t = sqrt(2h/g).",
                    }
                if "h=(1/2)gt^2" in ql or ("relationship" in ql and "h" in ql and re.search(r"\bt\b", ql)) or ("\u4f4d\u79fb" in q and "\u65f6\u95f4" in q):
                    return {
                        "answer": "h = (1/2) g t^2 (starting from rest, constant g).",
                        "stance_wrt_claim": "SUPPORTS",
                        "confidence": 0.8,
                        "rationale_brief": "Standard constant-acceleration kinematics.",
                    }

            # Chinese atomic patterns (place before generic "\u6563\u5c04" handler).
            if ("\u58f0\u5b50\u5360\u636e" in q) or (("\u58f0\u5b50" in q) and ("\u5360\u636e\u6570" in q or "\u70ed\u632f\u52a8" in q)) and ("\u5982\u4f55\u53d8\u5316" in q or "\u53d8\u5316" in q):
                return {
                    "answer": "\u589e\u52a0\u3002\u6e29\u5ea6\u5347\u9ad8\u65f6\u58f0\u5b50\u5360\u636e\u6570\uff08\u6676\u683c\u70ed\u632f\u52a8\u5f3a\u5ea6\uff09\u901a\u5e38\u589e\u52a0\uff0c\u56e0\u4e3a\u70ed\u6fc0\u53d1\u4f7f\u66f4\u591a\u58f0\u5b50\u6a21\u88ab\u5360\u636e\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.78,
                    "rationale_brief": "\u66f4\u9ad8\u6e29\u5ea6\u5bf9\u5e94\u66f4\u9ad8\u7684\u58f0\u5b50\u5360\u636e\u6570\u3002",
                }
            if ("\u58f0\u5b50" in q) and ("\u6563\u5c04" in q) and ("\u589e\u52a0" in q or "\u51cf\u5c0f" in q or "\u53d8\u5f3a" in q or "\u53d8\u5f31" in q):
                return {
                    "answer": "\u53d8\u5f3a\u3002\u58f0\u5b50\u6570\u589e\u52a0\u901a\u5e38\u4f1a\u4f7f\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u589e\u5f3a\uff08\u6563\u5c04\u7387\u589e\u5927\uff09\uff0c\u56e0\u4e3a\u53ef\u4f9b\u4ea4\u6362\u7684\u58f0\u5b50\u66f4\u591a\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.76,
                    "rationale_brief": "\u66f4\u591a\u58f0\u5b50\u610f\u5473\u7740\u66f4\u591a\u6563\u5c04\u4e8b\u4ef6\u3002",
                }
            if ("\u5ba4\u6e29" in q or "\u9644\u8fd1" in q) and ("\u7535\u5b50-\u58f0\u5b50" in q or "\u6563\u5c04" in q) and ("\u53d8\u5f3a" in q or "\u53d8\u5f31" in q or "\u589e\u52a0" in q or "\u51cf\u5c0f" in q):
                return {
                    "answer": "\u53d8\u5f3a\u3002\u5ba4\u6e29\u9644\u8fd1\u5347\u6e29\u901a\u5e38\u4f1a\u8ba9\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u589e\u5f3a\uff08\u6563\u5c04\u7387\u589e\u5927\uff09\uff0c\u5bf9\u5e94\u5f1b\u8c6b\u65f6\u95f4 τ \u53d8\u77ed\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.74,
                    "rationale_brief": "\u66f4\u9ad8\u6e29\u5ea6\u5bf9\u5e94\u66f4\u591a\u58f0\u5b50\u4e0e\u66f4\u5f3a\u6563\u5c04\u3002",
                }
            if ("\u6563\u5c04" in q) and ("\u5f1b\u8c6b\u65f6\u95f4" in q or "τ" in q) and ("\u53d8\u5927" in q or "\u53d8\u5c0f" in q):
                return {
                    "answer": "\u53d8\u5c0f\u3002\u6563\u5c04\u589e\u5f3a\u65f6\u5f1b\u8c6b\u65f6\u95f4 τ \u901a\u5e38\u53d8\u5c0f\uff08\u66f4\u9891\u7e41\u78b0\u649e\uff09\uff0cτ \u53d8\u5c0f\u4f1a\u964d\u4f4e\u8fc1\u79fb\u7387 μ\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.75,
                    "rationale_brief": "τ \u8868\u793a\u5e73\u5747\u4e24\u6b21\u6563\u5c04\u4e4b\u95f4\u7684\u65f6\u95f4\u3002",
                }
            if ("drude" in ql or "drude" in q) and ("σ" in q or "\u7535\u5bfc\u7387" in q or "μ" in q or "τ" in q) and ("\u5173\u7cfb" in q or "\u5199\u51fa" in q):
                return {
                    "answer": "Drude \u6a21\u578b\uff1aσ = neμ = ne²τ/m\uff0c\u7535\u963b\u7387 ρ = 1/σ\u3002n \u4e0d\u53d8\u65f6\uff0cτ\uff08\u6216 μ\uff09\u53d8\u5c0f\u4f1a\u4f7f ρ \u53d8\u5927\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.78,
                    "rationale_brief": "\u8fd9\u662f Drude \u4f20\u8f93\u7684\u57fa\u672c\u516c\u5f0f\u3002",
                }
            if ("τ" in q) and ("\u8fc1\u79fb\u7387" in q or "μ" in q) and ("\u53d8\u5927" in q or "\u53d8\u5c0f" in q):
                return {
                    "answer": "\u53d8\u5c0f\u3002Drude \u6a21\u578b\u4e2d μ ∝ τ\uff08μ = eτ/m\uff09\uff0c\u56e0\u6b64 τ \u53d8\u5c0f\u4f1a\u8ba9\u8fc1\u79fb\u7387 μ \u53d8\u5c0f\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.76,
                    "rationale_brief": "\u8fc1\u79fb\u7387\u4e0e\u5f1b\u8c6b\u65f6\u95f4\u6210\u6b63\u6bd4\u3002",
                }
            if ("\u8fc1\u79fb\u7387" in q or "μ" in q) and ("\u7535\u963b\u7387" in q or "ρ" in q) and ("\u53d8\u5927" in q or "\u53d8\u5c0f" in q):
                return {
                    "answer": "\u53d8\u5927\u3002\u82e5 n \u8fd1\u4f3c\u4e0d\u53d8\uff0cσ≈neμ\uff0cμ \u53d8\u5c0f\u4f1a\u8ba9 σ \u53d8\u5c0f\uff0c\u4ece\u800c\u7535\u963b\u7387 ρ=1/σ \u53d8\u5927\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.75,
                    "rationale_brief": "μ \u4e0b\u964d\u4f1a\u964d\u4f4e\u7535\u5bfc\u7387\u5e76\u62ac\u9ad8\u7535\u963b\u7387\u3002",
                }

            if "\u8d8b\u52bf" in q and ("\u7ebf\u6027" in q or "\u5ba4\u6e29" in q):
                return {
                    "answer": "\u591a\u6570\u7eaf\u91d1\u5c5e\u5728\u5ba4\u6e29\u9644\u8fd1\u7535\u963b\u7387\u968f\u6e29\u5ea6\u5347\u9ad8\u800c\u589e\u5927\uff0c\u5e38\u53ef\u7528\u8fd1\u4f3c\u7ebf\u6027\u5173\u7cfb\u63cf\u8ff0\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.78,
                    "rationale_brief": "\u8fd9\u662f\u7ecf\u5178\u91d1\u5c5e\u7535\u963b\u6e29\u5ea6\u7cfb\u6570\u7684\u7ecf\u9a8c\u89c4\u5f8b\uff08\u5ba4\u6e29\u9644\u8fd1\u5e38\u8fd1\u4f3c\u7ebf\u6027\uff09\u3002",
                }
            if ("yes/no" in ql or "answer yes/no" in ql) and ("cryogenic" in ql or "less linear" in ql or "low" in ql):
                return {
                    "answer": "Yes. At cryogenic temperatures, resistivity can deviate from a simple linear-in-T form compared with near room temperature.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.7,
                    "rationale_brief": "Different scattering regimes lead to different scalings at low temperature.",
                }
            if ("yes/no" in ql or "answer yes/no" in ql) and ("linear" in ql or "roughly linear" in ql):
                return {
                    "answer": "Yes. Near room temperature, resistivity vs. temperature for many metals is often approximated as roughly linear over a limited range.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.76,
                    "rationale_brief": "A linear approximation is commonly used around room temperature for simple metals.",
                }
            if ("yes/no" in ql or "answer yes/no" in ql) and ("temperature coefficient" in ql or "dρ/dt" in ql or "positive" in ql):
                return {
                    "answer": "Yes. For most metals near room temperature, the temperature coefficient of resistivity is typically positive (dρ/dT > 0).",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.74,
                    "rationale_brief": "Electron–phonon scattering increases with temperature in typical metals.",
                }
            if ("near room temperature" in ql or "linear" in ql) and ("resistivity" in ql or "resistance" in ql):
                return {
                    "answer": "Increase. For many pure metals near room temperature, resistivity increases as temperature rises and is often approximated as roughly linear over a limited range.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.78,
                    "rationale_brief": "This matches the standard temperature coefficient behavior for metals near room temperature.",
                }
            if "\u6676\u683c" in q or "\u6563\u5c04" in q:
                return {
                    "answer": "\u6e29\u5ea6\u5347\u9ad8\u4f7f\u6676\u683c\u70ed\u632f\u52a8\uff08\u58f0\u5b50\u5360\u636e\u6570\uff09\u589e\u52a0\uff0c\u7535\u5b50\u4e0e\u58f0\u5b50\u7684\u76f8\u4e92\u4f5c\u7528\u66f4\u9891\u7e41\uff0c\u4ece\u800c\u6563\u5c04\u589e\u5f3a\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.8,
                    "rationale_brief": "\u66f4\u9ad8\u6e29\u5ea6\u5bf9\u5e94\u66f4\u591a\u58f0\u5b50\u4e0e\u66f4\u5f3a\u6563\u5c04\u901a\u9053\u3002",
                }
            if (
                "phonon population" in ql
                and ("temperature" in ql or "with temperature" in ql or "as temperature increases" in ql)
                and ("how" in ql or "change" in ql)
            ):
                return {
                    "answer": "Increase. Phonon population (lattice vibrations) rises with temperature because thermal energy excites more phonon modes.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.78,
                    "rationale_brief": "Phonon occupation numbers rise as T increases.",
                }
            if ("room temperature" in ql or "near room temperature" in ql) and ("scattering" in ql) and ("increase" in ql or "decrease" in ql):
                return {
                    "answer": "Increase. Near room temperature, raising temperature tends to increase electron–phonon scattering (shorter relaxation time τ).",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.74,
                    "rationale_brief": "More phonons at higher T increase scattering rates in metals.",
                }
            if ("phonon" in ql) and ("scattering" in ql) and ("increase" in ql or "decrease" in ql):
                return {
                    "answer": "Increase. More phonons generally increase electron–phonon scattering because they provide more scattering events.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.77,
                    "rationale_brief": "Electron–phonon scattering strength grows with phonon population.",
                }
            if "lattice" in ql and "scattering" in ql:
                return {
                    "answer": "Increase. Higher temperature increases lattice vibrations (phonons), which increases electron–phonon scattering in metals.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.79,
                    "rationale_brief": "More phonons provide more scattering opportunities for conduction electrons.",
                }
            if ("scattering" in ql) and ("relaxation time" in ql or "tau" in ql or "τ" in q):
                return {
                    "answer": "Decrease. Stronger scattering generally decreases the relaxation time τ (more frequent collisions), which reduces mobility μ.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.73,
                    "rationale_brief": "Relaxation time is the average time between scattering events.",
                }
            if ("tau" in ql or "τ" in q) and ("mobility" in ql or "μ" in q):
                return {
                    "answer": "Decrease. In the Drude model, mobility μ is proportional to relaxation time τ (μ = eτ/m), so τ↓ implies μ↓.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.76,
                    "rationale_brief": "Mobility tracks how long carriers accelerate between scattering events.",
                }
            if ("mobility" in ql or "μ" in q) and ("resistivity" in ql or "ρ" in q):
                return {
                    "answer": "Increase. With roughly constant carrier density n, resistivity ρ increases when mobility μ decreases (σ≈neμ, ρ=1/σ).",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.75,
                    "rationale_brief": "Lower mobility reduces conductivity, increasing resistivity.",
                }
            if ("drude" in ql) and ("relation" in ql or "link" in ql or "write" in ql) and (("sigma" in ql) or ("ρ" in q) or ("σ" in q) or ("conductivity" in ql)):
                return {
                    "answer": "Drude: σ = neμ = ne^2 τ / m, and ρ = 1/σ. With n constant, decreasing τ (or μ) increases ρ.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.78,
                    "rationale_brief": "These are the standard Drude transport formulas.",
                }
            if "matthiessen" in ql:
                return {
                    "answer": "Matthiessen’s rule states that different scattering contributions to resistivity are approximately additive (e.g., impurity + phonon). It helps separate temperature-independent residual resistivity from temperature-dependent phonon terms, though it can break down when scattering mechanisms are not independent.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.68,
                    "rationale_brief": "It’s a standard heuristic for analyzing temperature-dependent resistivity in metals.",
                }
            if "impurit" in ql or "defect" in ql or "residual" in ql:
                return {
                    "answer": "Impurities/defects add a largely temperature-independent residual resistivity (ρ₀) by providing elastic scattering. The total resistivity is often modeled as ρ(T)≈ρ₀+ρ_ph(T), so dirtier samples show a higher baseline and a different apparent temperature dependence.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.7,
                    "rationale_brief": "Residual resistivity is a classic feature of metallic transport due to impurity scattering.",
                }
            if ("low t" in ql) or ("deviation" in ql) or ("temperature range" in ql) or ("roughly linear" in ql and "range" in ql):
                return {
                    "answer": "The near-linear ρ∝T trend is often a decent approximation around room temperature for many simple metals. At low temperatures, resistivity can deviate (e.g., phonon contribution drops rapidly and residual resistivity dominates; electron–phonon terms can scale like ~T^5 in the Bloch–Grüneisen regime). At very high temperatures, deviations such as resistivity saturation can occur.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.66,
                    "rationale_brief": "Standard transport theory predicts different temperature scalings in different regimes.",
                }
            if "relaxation time" in ql or "mean free path" in ql:
                return {
                    "answer": "More frequent scattering events shorten the average time between collisions (relaxation time τ) and reduce the mean free path ℓ≈v_F τ. That reduces mobility and conductivity in the Drude picture.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.7,
                    "rationale_brief": "In Drude-like models, τ and ℓ encode how scattering controls transport.",
                }
            if "\u8fc1\u79fb\u7387" in q and ("\u7535\u963b\u7387" in q or "\u7535\u963b" in q):
                return {
                    "answer": "\u5728\u8f7d\u6d41\u5b50\u6d53\u5ea6\u8fd1\u4f3c\u4e0d\u53d8\u65f6\uff0c\u7535\u5bfc\u7387\u4e0e\u8fc1\u79fb\u7387\u6210\u6b63\u6bd4\uff1b\u8fc1\u79fb\u7387\u964d\u4f4e\u4f1a\u4f7f\u7535\u5bfc\u7387\u4e0b\u964d\uff0c\u4ece\u800c\u7535\u963b\u7387\u4e0a\u5347\u3002",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.75,
                    "rationale_brief": "Drude \u6a21\u578b\u4e2d σ≈neμ\uff0cρ=1/σ\u3002",
                }
            if "mobility" in ql and ("resistivity" in ql or "drude" in ql or "conductivity" in ql):
                return {
                    "answer": "With roughly constant carrier density, conductivity scales with mobility (σ≈neμ), so reduced mobility lowers conductivity and increases resistivity (ρ=1/σ).",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.75,
                    "rationale_brief": "This is the basic Drude relationship linking mobility to resistivity.",
                }
            if "semiconductor" in ql and ("temperature" in ql or "resistance" in ql):
                return {
                    "answer": "Semiconductors often become more conductive as temperature increases because thermal excitation increases carrier concentration; this can outweigh mobility decreases over many ranges.",
                    "stance_wrt_claim": "SUPPORTS",
                    "confidence": 0.72,
                    "rationale_brief": "Carrier concentration is strongly temperature-dependent in semiconductors, commonly driving resistance down as T rises.",
                }
            return {
                "answer": "\u4fe1\u606f\u4e0d\u8db3\uff0c\u65e0\u6cd5\u786e\u5b9a\u3002" if lang == "zh" else "Insufficient information to determine reliably.",
                "stance_wrt_claim": "UNCERTAIN",
                "confidence": 0.35,
                "rationale_brief": "\u8be5\u95ee\u9898\u9700\u8981\u66f4\u5177\u4f53\u7684\u4e0a\u4e0b\u6587\u4e0e\u53c2\u6570\u3002" if lang == "zh" else "The question needs more specific context or parameters.",
            }

        # Default: return empty object shaped by schema? We'll be conservative.
        return {}
