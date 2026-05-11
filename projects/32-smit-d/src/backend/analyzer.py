import json
import logging
import os
import re
from typing import Literal

from anthropic import AsyncAnthropic
from pydantic import BaseModel, ConfigDict, ValidationError

from config import settings


logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are Lucent, an Airbnb listing honesty analyzer.

Your job is to identify misleading language, vague claims, and missing practical information that a renter needs to make an informed decision.

Rules:
- Focus only on information that is actually present in the listing text provided.
- Do not invent problems.
- Do not flag claims that are ordinary factual statements unless they are misleading, unverifiable, or materially vague.
- When you flag language, use the exact phrase from the listing whenever possible.
- Be conservative: honest listings should produce few or zero red flags.
- Treat the structured input JSON as ground truth.
- If a field in the JSON contains a real value, do not say that field is missing.
- If `description` contains text, you must not claim the description is missing.
- If `location` contains text, you must not claim the location is missing.
- If `rating` is numeric, use that exact value and do not invent another one.
- If `reviewCount` is null, do not invent a review count.
- If the `amenities` array is empty but the description text mentions amenities, do not say "no amenities are listed."
- Use only the provided JSON. Never substitute outside knowledge or guessed values.

Known euphemisms and risky phrases to watch for:
- cozy / intimate -> may indicate a very small space
- charming -> may indicate dated finishes or decor
- full of character -> may indicate quirks, age, or practical issues
- unique -> may indicate unusual or potentially inconvenient features
- rustic -> may indicate limited modernization
- vintage details -> may indicate outdated fixtures
- up-and-coming area -> may indicate a rough or transitional neighborhood
- vibrant neighborhood -> may indicate noise, congestion, or safety concerns
- lively area -> may indicate significant noise
- urban convenience -> may indicate traffic, density, or noise
- easy highway access -> may indicate traffic noise
- commuter's dream -> may emphasize commute over livability
- tucked away -> may indicate isolation or awkward access
- efficient layout -> may indicate limited space
- cozy studio -> may indicate cramped space
- open concept -> can be vague if used to imply spaciousness without evidence
- spacious -> should be treated as potentially misleading if unsupported
- bright and airy -> unverifiable without visual evidence
- great natural light -> unverifiable without visual evidence
- stunning views -> unverifiable without visual evidence
- luxury bathroom -> may be exaggerated marketing language
- chef's kitchen -> may be exaggerated marketing language
- recently renovated -> vague unless date or scope is given
- newly updated -> vague unless date or scope is given
- move-in ready -> vague marketing language
- well appointed -> vague marketing language
- peaceful retreat -> may hide isolation or distance
- private oasis -> vague marketing language
- steps from -> vague without measurable distance
- short walk to -> vague without measurable distance
- minutes from -> vague if no transport mode is given
- close to everything -> unverifiable and non-specific
- conveniently located -> vague and non-specific
- quiet street -> unverifiable from text alone
- safe neighborhood -> unverifiable from text alone
- perfect for entertaining -> vague marketing language
- blank canvas -> may indicate unfinished or poor condition
- needs TLC -> likely needs repairs
- handyman special -> likely needs significant work
- starter home -> may imply compromises in size or condition

Missing fields checklist:
- Square footage or room dimensions
- Parking details
- Laundry details
- Pet policy
- Utilities included or not
- Lease length or minimum stay
- Floor number
- Heating and cooling type
- Noise levels

Severity guide:
- high: directly affects livability, safety, major cost, or significant repairs
- medium: important practical information or materially misleading phrasing
- low: minor marketing puffery or softer unverifiable language

Return a structured analysis with:
- summary: one sentence in plain English
- redFlags: a list of flags with phrase, explanation, severity
- missingFields: only items from the checklist above that are absent from the listing text
""".strip()


class AnalyzerConfigurationError(RuntimeError):
    pass


class LanguageAnalysisError(RuntimeError):
    pass


class RedFlag(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phrase: str
    explanation: str
    severity: Literal["high", "medium", "low"]


class LanguageAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    redFlags: list[RedFlag]
    missingFields: list[str]


LANGUAGE_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "redFlags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "phrase": {"type": "string"},
                    "explanation": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                    },
                },
                "required": ["phrase", "explanation", "severity"],
                "additionalProperties": False,
            },
        },
        "missingFields": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["summary", "redFlags", "missingFields"],
    "additionalProperties": False,
}


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 3:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
    return cleaned.strip()


def _format_listing_prompt(listing: dict) -> str:
    normalized_listing = {
        "title": listing.get("title") or "",
        "description": listing.get("description") or "",
        "price": listing.get("price"),
        "location": listing.get("location") or "",
        "amenities": listing.get("amenities") or [],
        "rating": listing.get("rating"),
        "reviewCount": listing.get("reviewCount"),
    }

    return (
        "Analyze this Airbnb listing for misleading language and missing information.\n\n"
        "Use only the following JSON payload. Empty strings or null values mean the extractor did not find a value.\n"
        "Important grounding checks:\n"
        "- If `description` is non-empty, do not say the description is missing.\n"
        "- If `location` is non-empty, do not say the location is missing.\n"
        "- If `rating` is 4.9, do not claim the rating is 2.0 or any other value.\n"
        "- If `reviewCount` is null, do not invent a review count.\n"
        "- If `amenities` is empty but the description includes amenity details, do not say that no amenities are listed.\n\n"
        "LISTING_JSON:\n"
        f"{json.dumps(normalized_listing, indent=2, ensure_ascii=True)}"
    )


def _description_mentions_amenities(description: str) -> bool:
    lowered = description.lower()
    amenity_markers = [
        "amenities:",
        "following amenities",
        "includes:",
        "features:",
        "washer",
        "dryer",
        "parking",
        "kitchen",
        "air conditioning",
        "ac",
        "wifi",
    ]
    return any(marker in lowered for marker in amenity_markers)


def _stabilize_summary(listing: dict, result: LanguageAnalysisResult) -> str:
    summary = result.summary
    lowered = summary.lower()

    description = listing.get("description") or ""
    location = listing.get("location") or ""
    amenities = listing.get("amenities") or []
    rating = listing.get("rating")

    has_description = bool(description.strip())
    has_location = bool(location.strip())
    has_amenities = bool(amenities) or _description_mentions_amenities(description)
    has_high_rating = rating is not None and rating >= 4.5

    contradictions = [
        has_description and ("no description" in lowered or "almost no usable information" in lowered),
        has_location and ("no location" in lowered or "location" in lowered and "not provided" in lowered),
        has_amenities and ("no amenities" in lowered or "amenities" in lowered and "not listed" in lowered),
        has_high_rating and ("critically low" in lowered or "2.0 rating" in lowered or "low rating" in lowered),
    ]

    if any(contradictions):
        return (
            "This listing includes some concrete details, but it still uses vague or unverifiable language "
            "and omits several practical details a renter may want to confirm."
        )

    return summary


def _filter_inconsistent_flags(listing: dict, result: LanguageAnalysisResult) -> LanguageAnalysisResult:
    description = listing.get("description") or ""
    location = listing.get("location") or ""
    amenities = listing.get("amenities") or []
    rating = listing.get("rating")
    review_count = listing.get("reviewCount")

    filtered_flags = []
    for flag in result.redFlags:
        combined = f"{flag.phrase} {flag.explanation}".lower()

        if description and (
            "no description" in combined
            or "description is missing" in combined
            or "not provided (description)" in combined
        ):
            continue

        if location and (
            "not provided (location)" in combined
            or "location is missing" in combined
            or "no specific address" in combined
        ):
            continue

        if (amenities or _description_mentions_amenities(description)) and (
            "none listed (amenities)" in combined
            or "no amenities are listed" in combined
        ):
            continue

        if rating is not None and rating >= 4.5 and "rating" in combined:
            mentioned_numbers = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", combined)]
            if any(abs(value - rating) > 0.2 for value in mentioned_numbers):
                continue
            if "extremely low" in combined or "serious warning sign" in combined:
                continue

        if review_count is None and (
            re.search(r"review count\s*[:=]?\s*\d", combined)
            or re.search(r"\b\d+\s+reviews?\b", combined)
        ):
                continue

        filtered_flags.append(flag)

    return LanguageAnalysisResult(
        summary=_stabilize_summary(listing, result),
        redFlags=filtered_flags,
        missingFields=list(result.missingFields),
    )


async def analyze_listing_language(listing: dict) -> LanguageAnalysisResult:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    model = os.getenv("ANTHROPIC_MODEL", settings.analyzer.default_anthropic_model)

    if not api_key:
        raise AnalyzerConfigurationError(
            "Missing ANTHROPIC_API_KEY in backend/.env. Add your key and restart the backend."
        )

    client = AsyncAnthropic(api_key=api_key)

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=settings.analyzer.max_tokens,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": _format_listing_prompt(listing),
                }
            ],
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": LANGUAGE_ANALYSIS_SCHEMA,
                }
            },
        )
    except Exception as exc:
        raise LanguageAnalysisError(f"Anthropic request failed: {exc}") from exc

    raw_text = "\n".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()

    if not raw_text:
        raise LanguageAnalysisError("Anthropic returned an empty response.")

    try:
        parsed = json.loads(_strip_code_fences(raw_text))
        result = LanguageAnalysisResult.model_validate(parsed)
        return _filter_inconsistent_flags(listing, result)
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.exception("Failed to parse Anthropic response.")
        stop_reason = getattr(response, "stop_reason", None)
        if stop_reason == "max_tokens":
            raise LanguageAnalysisError(
                "Anthropic hit the token limit before finishing the structured response."
            ) from exc
        raise LanguageAnalysisError(
            "Anthropic returned a response that Lucent could not parse."
        ) from exc


def suppress_redundant_location_flags(
    analysis: LanguageAnalysisResult,
    location_checks: list[dict],
) -> LanguageAnalysisResult:
    if not location_checks:
        return analysis

    normalized_claim_phrases = {
        re.sub(r"\s+", " ", (check.get("phrase") or "").strip().lower())
        for check in location_checks
        if (check.get("phrase") or "").strip()
    }

    if not normalized_claim_phrases:
        return analysis

    filtered_flags = []
    for flag in analysis.redFlags:
        phrase = re.sub(r"\s+", " ", flag.phrase.strip().lower())
        explanation = flag.explanation.lower()

        overlaps_location_check = (
            phrase in normalized_claim_phrases
            or any(phrase in claim or claim in phrase for claim in normalized_claim_phrases)
        )

        low_signal_travel_time_reason = any(
            snippet in explanation
            for snippet in [
                "transport mode",
                "walking time",
                "walk times",
                "travel time claims",
                "without specifying the transport mode",
                "without a specified mode",
            ]
        )

        if overlaps_location_check and low_signal_travel_time_reason:
            continue

        filtered_flags.append(flag)

    return LanguageAnalysisResult(
        summary=analysis.summary,
        redFlags=filtered_flags,
        missingFields=analysis.missingFields,
    )
