import json
import logging
from typing import Any, Dict, Optional

from anthropic import Anthropic

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()
_client: Optional[Anthropic] = None


def _get_client() -> Optional[Anthropic]:
    global _client
    api_key = _settings.claude_api_key
    if not api_key:
        logger.warning("Claude API key not configured; AI features are disabled.")
        return None
    if _client is None:
        _client = Anthropic(api_key=api_key)
    return _client


def _call_claude_for_json(system_prompt: str, user_payload: Dict[str, Any], schema_hint: str) -> Optional[Dict[str, Any]]:
    """Call Claude with a JSON-only contract.

    Returns parsed JSON dict on success, or None on any error.
    """

    client = _get_client()
    if client is None:
        return None

    try:
        content = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"You are a wellness-focused assistant (not a medical provider).\n"
                            f"You will receive a JSON payload and must respond with STRICTLY valid JSON, "
                            f"matching this schema: {schema_hint}.\n"
                            "Do not include any explanation, markdown, or extra text outside the JSON.\n"
                            "Here is the input JSON you should analyze:\n" + json.dumps(user_payload)
                        ),
                    }
                ],
            }
        ]

        response = client.messages.create(
            model=_settings.claude_model,
            max_tokens=800,
            temperature=0.2,
            system=system_prompt,
            messages=content,
        )

        # Anthropic messages API returns a list of content blocks; we expect a single text block
        if not response.content:
            return None
        text_blocks = [b.text for b in response.content if getattr(b, "type", "text") == "text"]
        if not text_blocks:
            return None
        raw = text_blocks[0].strip()

        # Helpful for debugging when AI output doesn't parse as expected.
        logger.debug("Raw Claude response text (truncated): %s", raw[:500])

        # Some models may still wrap JSON in extra text; try to isolate the JSON payload.
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        candidate = raw[start : end + 1]
        parsed = json.loads(candidate)

        # Normal case: single JSON object
        if isinstance(parsed, dict):
            return parsed

        # Sometimes models return a top-level list; try to use the first object element.
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict):
                    return item

        return None
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Claude call failed: %s", exc)
        return None


def get_burnout_insights(history_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Ask Claude to interpret burnout history.

    Expected JSON shape in response:
    {
      "burnoutLevel": "Low|Moderate|High|Critical",
      "trendLabel": "Improving|Stable|Worsening",
      "summary": "...",
      "interventions": ["...", "...", "..."]
    }
    """

    schema_hint = (
        '{"burnoutLevel":"Low|Moderate|High|Critical",'
        '"trendLabel":"Improving|Stable|Worsening",'
        '"summary":"string",'
        '"interventions":["string","string","string"]}'
    )

    system_prompt = (
        "You help users understand burnout risk in everyday wellness language. "
        "You are not a doctor and do not give medical advice. "
        "Focus on gentle, practical suggestions for sleep, stress, and activity. "
        "The input JSON may include numeric burnout scores (for example 'risk_score'). "
        "When it is genuinely helpful, you can refer to these numbers in natural language, "
        "such as saying that the burnout score is around a certain value, but avoid sounding overly clinical."
    )

    return _call_claude_for_json(system_prompt, history_payload, schema_hint)


def get_workout_plan(context_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Ask Claude to propose a burnout-aware workout plan.

    Expected JSON shape in response:
    {
      "title": "string",
      "durationMinutes": 25,
      "adaptationReason": "string",
      "sections": [
        {
          "title": "Warm-up",
          "exercises": [
            {"name":"...","sets":2,"reps":"8-10","rest":"60 sec","notes":"..."}
          ]
        }
      ]
    }
    """

    schema_hint = (
        '{"title":"string","durationMinutes":25,'
        '"adaptationReason":"string",'
        '"sections":[{"title":"string",'
        '"exercises":[{"name":"string","sets":2,"reps":"string",'
        '"rest":"string","notes":"string"}]}]}'
    )

    system_prompt = (
        "You are designing short, safe workouts that adapt to a user's burnout level. "
        "The app already decides overall structure (sections, duration, and total volume) based on burnout. "
        "Your role is to: (1) provide a clear adaptationReason that explains the burnout-aware adjustment, "
        "and (2) suggest supportive, burnout-aware exercise notes and tone. "
        "Always respect the intensity rules: Low = normal workout, Moderate = slightly reduced volume, "
        "High = simplified lower-load, Critical = restorative / recovery-only. "
        "Prefer simple bodyweight or light equipment exercises that most people can do at home, and keep notes warm and encouraging."
    )

    return _call_claude_for_json(system_prompt, context_payload, schema_hint)


def get_dashboard_pattern_insight(context_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Ask Claude for a short pattern insight for the dashboard.

        Expected JSON shape in response:
        {
            "patternSummary": "string",
            "recommendation": "string"
        }
        """

        schema_hint = '{"patternSummary":"string","recommendation":"string"}'

        system_prompt = (
                "You analyze short-term patterns between burnout and workouts. "
                "Use the aggregated metrics provided (recent burnout scores and levels, trend direction, "
                "workout counts, and recovery vs training mix) to write: "
                "(1) a one- or two-line patternSummary and (2) a single-line recommendation. "
                "Make both concrete and specific to the numbers provided, avoid generic wellness advice, "
                "and stay strictly non-medical."
        )

        return _call_claude_for_json(system_prompt, context_payload, schema_hint)
