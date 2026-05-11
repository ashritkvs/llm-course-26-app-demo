import json
import os
from typing import Literal

import httpx
from anthropic import AsyncAnthropic
from pydantic import BaseModel, ConfigDict, ValidationError

from config import settings


class PhotoMismatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim: str
    observation: str
    severity: Literal["high", "medium", "low"]


class PhotoAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overallMatch: Literal["good", "partial", "poor", "unknown"]
    mismatches: list[PhotoMismatch]
    supportedClaims: list[str]
    unverifiedClaims: list[str]
    summary: str
    analyzedPhotoCount: int


VISION_SCHEMA = {
    "type": "object",
    "properties": {
        "overallMatch": {
            "type": "string",
            "enum": ["good", "partial", "poor", "unknown"],
        },
        "mismatches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "observation": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                    },
                },
                "required": ["claim", "observation", "severity"],
                "additionalProperties": False,
            },
        },
        "unverifiedClaims": {
            "type": "array",
            "items": {"type": "string"},
        },
        "supportedClaims": {
            "type": "array",
            "items": {"type": "string"},
        },
        "summary": {"type": "string"},
        "analyzedPhotoCount": {"type": "integer"},
    },
    "required": [
        "overallMatch",
        "mismatches",
        "supportedClaims",
        "unverifiedClaims",
        "summary",
        "analyzedPhotoCount",
    ],
    "additionalProperties": False,
}


VISION_PROMPT = f"""
You are Lucent, an Airbnb listing photo analyst.

Your job is to compare listing claims against listing photos and identify only material mismatches that affect a renter's decision.

Rules:
- Be conservative and evidence-led.
- Only flag contradictions you can actually see from the images.
- Focus on high-signal issues: size, condition, renovation claims, light, view, kitchen/bathroom quality, and major amenity visibility.
- Do not treat the absence of visual proof for minor amenities as suspicious. Listings often have limited photos.
- Do not use small items like washer/dryer, storage, bed type, linens, or small appliances as reasons to lower the overall match on their own.
- Use `unverifiedClaims` only for materially important claims a renter would reasonably expect to see supported, such as bedroom size/layout, kitchen condition, bathroom condition, views, light, or major renovation claims.
- If the photos show no contradiction, do not return `partial` or `poor` merely because some claims are not pictured.
- Do not nitpick decor style or subjective taste.
- If photos generally support the listing, say so.
- When the photos support the listing well, include 2-{settings.vision.supported_claims_limit} short `supportedClaims` bullets naming the claims the photos do support.
- Keep `supportedClaims` concise and specific, such as "Bright living area", "Clean kitchen", or "Exterior matches residential home description".
- If `overallMatch` is `good` and the photos visibly support at least one claim, `supportedClaims` should not be empty.
- Prefer supported claims over generic praise. Name what the photos actually back up.
- If a claim cannot be checked from the images, put it in `unverifiedClaims` instead of calling it a mismatch.
- Return only structured output.
""".strip()


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 3:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
    return cleaned.strip()


def _is_material_unverified_claim(claim: str) -> bool:
    normalized = (claim or "").strip().lower()
    if not normalized:
        return False

    return not any(
        marker in normalized for marker in settings.vision.low_signal_unverified_markers
    )


def _stabilize_photo_result(result: PhotoAnalysisResult, analyzed_photo_count: int) -> PhotoAnalysisResult:
    filtered_unverified_claims = [
        claim for claim in result.unverifiedClaims if _is_material_unverified_claim(claim)
    ]
    supported_claims = [
        _compact_spaces(claim) for claim in result.supportedClaims if _compact_spaces(claim)
    ][: settings.vision.supported_claims_limit]

    overall_match = result.overallMatch
    summary = result.summary

    if not result.mismatches:
        if overall_match in {"partial", "poor"}:
            overall_match = "good"

        if not filtered_unverified_claims:
            summary = "Photos generally support the listing, with no clear visual contradictions in the images Lucent could access."

    return PhotoAnalysisResult(
        overallMatch=overall_match,
        mismatches=result.mismatches,
        supportedClaims=supported_claims,
        unverifiedClaims=filtered_unverified_claims,
        summary=summary,
        analyzedPhotoCount=analyzed_photo_count,
    )


def _compact_spaces(value: str) -> str:
    return " ".join(str(value or "").split()).strip()


async def _url_is_accessible(client: httpx.AsyncClient, url: str) -> bool:
    try:
        head_response = await client.head(
            url,
            follow_redirects=True,
            timeout=settings.vision.request_timeout_seconds,
        )
        content_type = (head_response.headers.get("content-type") or "").lower()
        if head_response.status_code < 400 and content_type.startswith("image/"):
            return True

        if head_response.status_code not in {403, 405}:
            return False
    except httpx.HTTPError:
        pass

    try:
        get_response = await client.get(
            url,
            headers={"Range": "bytes=0-0"},
            follow_redirects=True,
            timeout=settings.vision.request_timeout_seconds,
        )
        content_type = (get_response.headers.get("content-type") or "").lower()
        return get_response.status_code < 400 and content_type.startswith("image/")
    except httpx.HTTPError:
        return False


async def filter_accessible_photos(
    photo_urls: list[str],
    limit: int = settings.vision.max_accessible_photos,
) -> list[str]:
    unique_urls = []
    for url in photo_urls:
        if url and url not in unique_urls:
            unique_urls.append(url)

    accessible = []
    async with httpx.AsyncClient() as client:
        for url in unique_urls:
            if len(accessible) >= limit:
                break
            if await _url_is_accessible(client, url):
                accessible.append(url)

    return accessible


def _build_vision_message_content(listing: dict, photo_urls: list[str]) -> list[dict]:
    text_payload = {
        "title": listing.get("title") or "",
        "description": listing.get("description") or "",
        "amenities": listing.get("amenities") or [],
        "location": listing.get("location") or "",
    }

    content = [
        {
            "type": "text",
            "text": (
                "Compare the following listing claims against the attached photos.\n\n"
                f"LISTING_JSON:\n{json.dumps(text_payload, indent=2, ensure_ascii=True)}"
            ),
        }
    ]

    for index, url in enumerate(photo_urls, start=1):
        content.append({"type": "text", "text": f"Photo {index}:"})
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "url",
                    "url": url,
                },
            }
        )

    return content


async def analyze_listing_photos(listing: dict) -> PhotoAnalysisResult:
    photo_urls = await filter_accessible_photos(
        listing.get("photos") or [],
        limit=settings.vision.max_accessible_photos,
    )
    if not photo_urls:
        return PhotoAnalysisResult(
            overallMatch="unknown",
            mismatches=[],
            supportedClaims=[],
            unverifiedClaims=[],
            summary="Photo analysis is unavailable because Lucent could not access any listing photos reliably.",
            analyzedPhotoCount=0,
        )

    api_key = os.getenv("ANTHROPIC_API_KEY")
    model = os.getenv(
        "ANTHROPIC_VISION_MODEL",
        os.getenv("ANTHROPIC_MODEL", settings.vision.default_anthropic_model),
    )

    if not api_key:
        return PhotoAnalysisResult(
            overallMatch="unknown",
            mismatches=[],
            supportedClaims=[],
            unverifiedClaims=[],
            summary="Photo analysis is unavailable until ANTHROPIC_API_KEY is configured.",
            analyzedPhotoCount=0,
        )

    client = AsyncAnthropic(api_key=api_key)

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=settings.vision.anthropic_max_tokens,
            system=VISION_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": _build_vision_message_content(listing, photo_urls),
                }
            ],
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": VISION_SCHEMA,
                }
            },
        )
    except Exception:
        return PhotoAnalysisResult(
            overallMatch="unknown",
            mismatches=[],
            supportedClaims=[],
            unverifiedClaims=[],
            summary="Photo analysis failed before Claude could evaluate the listing photos.",
            analyzedPhotoCount=len(photo_urls),
        )

    raw_text = "\n".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()

    if not raw_text:
        return PhotoAnalysisResult(
            overallMatch="unknown",
            mismatches=[],
            supportedClaims=[],
            unverifiedClaims=[],
            summary="Claude returned an empty photo-analysis response.",
            analyzedPhotoCount=len(photo_urls),
        )

    try:
        parsed = json.loads(_strip_code_fences(raw_text))
        result = PhotoAnalysisResult.model_validate(parsed)
        return _stabilize_photo_result(result, len(photo_urls))
    except (json.JSONDecodeError, ValidationError):
        return PhotoAnalysisResult(
            overallMatch="unknown",
            mismatches=[],
            supportedClaims=[],
            unverifiedClaims=[],
            summary="Lucent could not parse Claude's photo-analysis response reliably.",
            analyzedPhotoCount=len(photo_urls),
        )
