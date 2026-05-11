import json
import os
import re

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set.")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL)


def call_text(prompt: str) -> str:
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.4,
            "max_output_tokens": 1200,
        },
    )
    return response.text.strip()


def _extract_json_candidate(text: str) -> str:
    cleaned = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        return match.group()
    return cleaned


def _repair_json(text: str) -> dict:
    repair_prompt = f"""
Return valid JSON only.
Repair the malformed JSON below without changing its meaning.
If a field is incomplete, finish it conservatively so the JSON is valid.

Malformed JSON:
{_extract_json_candidate(text)}
"""
    repaired = model.generate_content(
        repair_prompt,
        generation_config={
            "temperature": 0,
            "max_output_tokens": 1400,
            "response_mime_type": "application/json",
        },
    )
    return json.loads(_extract_json_candidate(repaired.text.strip()))


def call_json(prompt: str) -> dict:
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.2,
            "max_output_tokens": 1200,
            "response_mime_type": "application/json",
        },
    )
    text = response.text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        candidate = _extract_json_candidate(text)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return _repair_json(text)
