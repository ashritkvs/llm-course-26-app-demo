import json
import os
import re
from typing import Literal, Optional, Tuple, List

import httpx
from anthropic import AsyncAnthropic
from pydantic import BaseModel, ConfigDict, ValidationError

from config import settings


class ExtractedLocationClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phrase: str
    destination: str
    claimedMinutes: int
    mode: Literal["driving", "walking", "transit", "bicycling", "unspecified"]
    modeExplicit: bool


class LocationVerificationCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phrase: str
    destination: str
    claimedMinutes: int
    actualMinutes: Optional[int]
    actualDurationText: Optional[str]
    modeUsed: str
    modeExplicit: bool
    accurate: Optional[bool]
    differenceMinutes: Optional[int]
    severity: Optional[Literal["high", "medium", "low"]]
    verdict: str


class LocationVerificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "no_claims", "unavailable", "imprecise_origin", "error"]
    summary: str
    originQuery: Optional[str]
    resolvedOrigin: Optional[str]
    originSource: Optional[Literal["listing_location", "listing_text_inferred", "review_inferred"]]
    originConfidence: Optional[Literal["high", "medium", "low"]]
    checks: list[LocationVerificationCheck]


LOCATION_CLAIMS_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "phrase": {"type": "string"},
                    "destination": {"type": "string"},
                    "claimedMinutes": {"type": "integer"},
                    "mode": {
                        "type": "string",
                        "enum": ["driving", "walking", "transit", "bicycling", "unspecified"],
                    },
                    "modeExplicit": {"type": "boolean"},
                },
                "required": [
                    "phrase",
                    "destination",
                    "claimedMinutes",
                    "mode",
                    "modeExplicit",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["claims"],
    "additionalProperties": False,
}


REVIEW_ORIGIN_SCHEMA = {
    "type": "object",
    "properties": {
        "originCandidate": {"type": "string"},
        "confidence": {
            "type": "string",
            "enum": ["high", "medium", "low", "none"],
        },
        "evidence": {
            "type": "array",
            "items": {"type": "string"},
        },
        "rationale": {"type": "string"},
    },
    "required": ["originCandidate", "confidence", "evidence", "rationale"],
    "additionalProperties": False,
}


LOCATION_EXTRACTION_PROMPT = """
You extract verifiable travel-time claims from Airbnb listing text.

Rules:
- Use only the listing JSON provided by the user.
- Extract only claims that mention a specific travel time in minutes and a specific searchable destination.
- If one phrase mentions multiple destinations, split it into separate claim objects.
- Skip vague claims like "near everything" or "close to shops".
- Destination names must be concrete enough for Google Maps search.
- Infer the most likely mode only when the text does not specify one:
  - walking terms -> walking
  - subway/train/bus/transit terms -> transit
  - bike terms -> bicycling
  - otherwise -> unspecified
- Set `modeExplicit` to true only when the listing explicitly states the transport mode.
- Keep `phrase` as close as possible to the exact original wording.
- Return only structured output.
""".strip()


REVIEW_ORIGIN_PROMPT = """
You infer the most likely neighborhood-level origin for an Airbnb listing when Airbnb only exposes a broad city.

Rules:
- Use only the listing JSON provided.
- Prioritize direct location mentions in guest reviews.
- Favor neighborhood-level origins such as "Wynwood, Miami, FL" or "Brickell, Miami, FL", not street addresses.
- Only return medium or high confidence when multiple review snippets or multiple listing signals point to the same neighborhood.
- If the evidence is weak, conflicting, or absent, return confidence "none" or "low".
- Do not invent addresses.
- Return only structured output.
""".strip()


class ReviewInferredOrigin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    originCandidate: str
    confidence: Literal["high", "medium", "low", "none"]
    evidence: list[str]
    rationale: str


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 3:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
    return cleaned.strip()


def _build_origin_query(listing: dict) -> Optional[str]:
    location = (listing.get("location") or "").strip()
    return location or None


def _dedupe_claims(claims: list[ExtractedLocationClaim]) -> list[ExtractedLocationClaim]:
    seen = set()
    deduped = []

    for claim in claims:
        key = (
            claim.phrase.lower(),
            claim.destination.lower(),
            claim.claimedMinutes,
            claim.mode,
            claim.modeExplicit,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(claim)

    return deduped


def _mode_for_maps(mode: str) -> Literal["driving", "walking", "transit", "bicycling"]:
    if mode in {"driving", "walking", "transit", "bicycling"}:
        return mode
    return "driving"


def _severity_for_difference(difference_minutes: int) -> Literal["high", "medium", "low"]:
    if difference_minutes > settings.location.high_difference_minutes:
        return "high"
    if difference_minutes >= settings.location.medium_difference_minutes:
        return "medium"
    return "low"


def _format_location_prompt(listing: dict) -> str:
    payload = {
        "title": listing.get("title") or "",
        "location": listing.get("location") or "",
        "description": listing.get("description") or "",
    }
    return (
        "Extract verifiable location or travel-time claims from this Airbnb listing.\n\n"
        "LISTING_JSON:\n"
        f"{json.dumps(payload, indent=2, ensure_ascii=True)}"
    )


def _format_review_origin_prompt(listing: dict) -> str:
    payload = {
        "title": listing.get("title") or "",
        "location": listing.get("location") or "",
        "description": listing.get("description") or "",
        "reviews": listing.get("reviews") or [],
    }
    return (
        "Infer the most likely neighborhood-level origin for this listing from review snippets.\n\n"
        "LISTING_JSON:\n"
        f"{json.dumps(payload, indent=2, ensure_ascii=True)}"
    )


def _compact_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _normalize_destination(destination: str, listing_location: str) -> str:
    cleaned = _compact_spaces(destination.strip(" .,;:"))
    cleaned = re.sub(r"^(the)\s+", "", cleaned, flags=re.IGNORECASE)

    replacements = {
        "cruise port": "PortMiami",
        "miami airport": "Miami International Airport",
        "logan airport": "Logan Airport",
        "downtown": "Downtown",
    }

    normalized_key = cleaned.lower()
    cleaned = replacements.get(normalized_key, cleaned)

    if not cleaned:
        return ""

    broad_city = _compact_spaces((listing_location or "").split(",")[0])
    if broad_city and "," not in cleaned and broad_city.lower() not in cleaned.lower():
        return f"{cleaned}, {broad_city}"

    return cleaned


def _looks_like_concrete_destination(destination: str) -> bool:
    normalized = destination.lower()
    blocked_fragments = [
        "major bus routes",
        "bus routes",
        "everything",
        "shops",
        "restaurants",
        "nightlife",
        "attractions",
        "and more",
        "you'll",
        "you’ll",
        "convenience",
        "comfort",
        "during your stay",
        "subway stops",
        "stops to",
        "close to",
    ]

    if any(fragment in normalized for fragment in blocked_fragments):
        return False

    return len(normalized) >= 3


def _infer_mode_from_phrase_text(phrase: str) -> Tuple[
    Literal["driving", "walking", "transit", "bicycling", "unspecified"],
    bool,
]:
    lowered = phrase.lower()

    if any(term in lowered for term in ["walk", "walking", "on foot"]):
        return "walking", True
    if any(term in lowered for term in ["subway", "train", "bus", "transit", "metro", "tram"]):
        return "transit", True
    if any(term in lowered for term in ["bike", "bicycle", "cycling"]):
        return "bicycling", True
    if any(term in lowered for term in ["drive", "driving", "by car", "car "]):
        return "driving", True

    return "unspecified", False


def _extract_route_parts(phrase: str) -> Optional[Tuple[str, Literal["to", "from"], str]]:
    lowered = phrase.lower()
    candidates = []

    to_index = lowered.find(" to ")
    if to_index != -1:
        candidates.append((to_index, 4, "to"))

    from_index = lowered.find(" from ")
    if from_index != -1:
        candidates.append((from_index, 6, "from"))

    if candidates:
        split_index, offset, connector = min(candidates, key=lambda item: item[0])
        prefix = _compact_spaces(phrase[:split_index])
        destination_text = phrase[split_index + offset :]
        return prefix, connector, destination_text

    return None


def _trim_destination_text(destination_text: str) -> str:
    cleaned = _compact_spaces(destination_text)
    if not cleaned:
        return ""

    second_claim_patterns = [
        r"\s+and\s+(?:only\s+)?(?:a\s+few|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:subway\s+)?stops?\b.*$",
        r"\s+and\s+close\s+to\b.*$",
        r"\s+and\s+more\b.*$",
        r"\s*,\s+and\s+more\b.*$",
        r"\s*,\s+you['’]ll\b.*$",
        r"\s+you['’]ll\b.*$",
        r"\s+with\b.*$",
        r"\s+during\s+your\s+stay\b.*$",
    ]

    for pattern in second_claim_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    return _compact_spaces(cleaned.strip(" .,;:"))


def _split_destinations(destination_text: str) -> list[str]:
    cleaned = _trim_destination_text(destination_text)
    if not cleaned:
        return []

    cleaned = re.sub(
        r"\b(?:by car(?: or transit)?|by transit|by bus|by train|driving|drive|walking|walk|on foot)\b.*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = _compact_spaces(cleaned.strip(" .,;:"))

    candidates = re.split(r"\s*,\s*|\s+(?:and|&)\s+", cleaned)
    return [_compact_spaces(item.strip(" .,;:")) for item in candidates if _compact_spaces(item)]


def _extract_location_claims_rule_based(listing: dict) -> list[ExtractedLocationClaim]:
    description = listing.get("description") or ""
    if not description.strip():
        return []

    normalized_description = description.replace("•", "\n").replace("|", "\n")
    for marker in ["Live in comfort", "Note:", "Amenities:", "Show more", "Show less"]:
        normalized_description = normalized_description.replace(marker, f"\n{marker}")

    listing_location = listing.get("location") or ""
    time_pattern = re.compile(
        r"(?:~\s*)?\d{1,3}(?:\s*[–-]\s*\d{1,3})?\s*[- ]?(?:minutes?|minute|mins?|min)\b",
        flags=re.IGNORECASE,
    )

    claims: list[ExtractedLocationClaim] = []
    fragments = re.split(r"[\n\r]+|(?<=[.!?])\s+", normalized_description)

    for fragment in fragments:
        compact_fragment = _compact_spaces(fragment)
        if not compact_fragment:
            continue

        time_match = time_pattern.search(compact_fragment)
        if not time_match:
            continue

        phrase = _compact_spaces(compact_fragment[time_match.start() :])
        if not phrase:
            continue

        minutes_match = re.search(r"(\d{1,3})", phrase)
        if not minutes_match:
            continue

        claimed_minutes = int(minutes_match.group(1))
        route_parts = _extract_route_parts(phrase)
        if not route_parts:
            continue

        prefix, connector, destination_text = route_parts
        mode_phrase = f"{prefix} {connector} {_trim_destination_text(destination_text)}"
        mode, mode_explicit = _infer_mode_from_phrase_text(mode_phrase)

        for destination_part in _split_destinations(destination_text):
            if not _looks_like_concrete_destination(destination_part):
                continue

            destination = _normalize_destination(destination_part, listing_location)
            if not destination:
                continue

            claim_phrase = _compact_spaces(f"{prefix} {connector} {destination_part}")

            claims.append(
                ExtractedLocationClaim(
                    phrase=claim_phrase,
                    destination=destination,
                    claimedMinutes=claimed_minutes,
                    mode=mode,
                    modeExplicit=mode_explicit,
                )
            )

    return _dedupe_claims(claims)


def _infer_origin_from_listing_text(
    listing: dict,
    broad_origin: Optional[str],
) -> Optional[Tuple[str, Literal["high", "medium"]]]:
    text = " ".join(
        [
            listing.get("title") or "",
            listing.get("description") or "",
        ]
    )

    if not text.strip():
        return None

    patterns = [
        (r"located in the center of ([A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’.-]+){0,3})", "high"),
        (r"located in the heart of ([A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’.-]+){0,3})", "high"),
        (r"in the center of ([A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’.-]+){0,3})", "high"),
        (r"in the heart of ([A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’.-]+){0,3})", "high"),
        (r"located in ([A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’.-]+){0,3})", "medium"),
    ]

    blocked = {
        "airport",
        "subway",
        "station",
        "downtown",
        "beach",
        "port",
        "fields corner station",
        "logan airport",
    }

    for pattern, confidence in patterns:
        match = re.search(pattern, text)
        if not match:
            continue

        candidate = match.group(1).strip(" .,")
        normalized = candidate.lower()
        if not candidate or normalized in blocked:
            continue

        if broad_origin and broad_origin.lower() not in normalized:
            return (f"{candidate}, {broad_origin}", confidence)
        return (candidate, confidence)

    return None


def _build_unverified_checks(
    claims: List[ExtractedLocationClaim],
    verdict: str,
) -> List[LocationVerificationCheck]:
    checks = [
        LocationVerificationCheck(
            phrase=claim.phrase,
            destination=claim.destination,
            claimedMinutes=claim.claimedMinutes,
            actualMinutes=None,
            actualDurationText=None,
            modeUsed=_mode_for_maps(claim.mode),
            modeExplicit=claim.modeExplicit,
            accurate=None,
            differenceMinutes=None,
            severity=None,
            verdict=verdict,
        )
        for claim in claims
    ]
    return _merge_similar_checks(checks)


def _build_imprecise_origin_checks(
    claims: List[ExtractedLocationClaim],
    origin_label: Optional[str],
    source: Literal["listing_location", "review_inferred", "missing_origin"],
) -> List[LocationVerificationCheck]:
    resolved_origin = origin_label or "the listing location"
    checks = []

    for claim in claims:
        mode_used = _mode_for_maps(claim.mode)
        if source == "listing_location":
            verdict = (
                f"Google Maps resolved the origin only to '{resolved_origin}'. "
                f"Lucent did not compare a {mode_used} route to {claim.destination} because a city-level origin "
                "would make that result misleading."
            )
        elif source == "review_inferred":
            verdict = (
                f"Lucent found a review-based origin candidate, but Google Maps could only resolve it broadly as "
                f"'{resolved_origin}'. Lucent therefore did not compare a {mode_used} route to {claim.destination}."
            )
        else:
            verdict = (
                f"Airbnb did not expose a precise enough origin for this listing, so Lucent could not run a reliable "
                f"Google Maps {mode_used} route to {claim.destination}."
            )

        checks.append(
            LocationVerificationCheck(
                phrase=claim.phrase,
                destination=claim.destination,
                claimedMinutes=claim.claimedMinutes,
                actualMinutes=None,
                actualDurationText=None,
                modeUsed=mode_used,
                modeExplicit=claim.modeExplicit,
                accurate=None,
                differenceMinutes=None,
                severity=None,
                verdict=verdict,
            )
        )

    return _merge_similar_checks(checks)


def _merge_similar_checks(
    checks: List[LocationVerificationCheck],
) -> List[LocationVerificationCheck]:
    grouped: dict[
        tuple[
            str,
            str,
            int,
            Optional[int],
            Optional[str],
            Optional[bool],
            Optional[int],
            Optional[str],
            str,
        ],
        List[LocationVerificationCheck],
    ] = {}

    for check in checks:
        key = (
            check.phrase.strip().lower(),
            check.destination.strip().lower(),
            check.claimedMinutes,
            check.actualMinutes,
            check.actualDurationText,
            check.accurate,
            check.differenceMinutes,
            check.severity,
            check.verdict,
        )
        grouped.setdefault(key, []).append(check)

    merged: List[LocationVerificationCheck] = []
    for group in grouped.values():
        if len(group) == 1:
            merged.append(group[0])
            continue

        modes = []
        for item in group:
            normalized_mode = item.modeUsed.strip().lower()
            if normalized_mode and normalized_mode not in modes:
                modes.append(normalized_mode)

        primary = group[0]
        merged.append(
            LocationVerificationCheck(
                phrase=primary.phrase,
                destination=primary.destination,
                claimedMinutes=primary.claimedMinutes,
                actualMinutes=primary.actualMinutes,
                actualDurationText=primary.actualDurationText,
                modeUsed="/".join(modes) if modes else primary.modeUsed,
                modeExplicit=any(item.modeExplicit for item in group),
                accurate=primary.accurate,
                differenceMinutes=primary.differenceMinutes,
                severity=primary.severity,
                verdict=primary.verdict,
            )
        )

    return merged


def _is_precise_enough_geocode(result_types: List[str]) -> bool:
    precise_types = {
        "street_address",
        "premise",
        "subpremise",
        "route",
        "intersection",
        "neighborhood",
        "sublocality",
        "sublocality_level_1",
        "point_of_interest",
        "airport",
    }
    return any(result_type in precise_types for result_type in result_types)


async def _infer_origin_from_reviews(listing: dict) -> Optional[ReviewInferredOrigin]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    model = os.getenv("ANTHROPIC_MODEL", settings.location.default_anthropic_model)
    reviews = listing.get("reviews") or []

    if not api_key or not reviews:
        return None

    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=settings.location.review_origin_max_tokens,
        temperature=settings.location.anthropic_temperature,
        system=REVIEW_ORIGIN_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _format_review_origin_prompt(listing),
            }
        ],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": REVIEW_ORIGIN_SCHEMA,
            }
        },
    )

    raw_text = "\n".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()
    if not raw_text:
        return None

    parsed = json.loads(_strip_code_fences(raw_text))
    inferred = ReviewInferredOrigin.model_validate(parsed)
    if inferred.confidence in {"none", "low"} or not inferred.originCandidate.strip():
        return None
    return inferred


async def _extract_location_claims(listing: dict) -> list[ExtractedLocationClaim]:
    rule_based_claims = _extract_location_claims_rule_based(listing)
    if rule_based_claims:
        return rule_based_claims

    api_key = os.getenv("ANTHROPIC_API_KEY")
    model = os.getenv("ANTHROPIC_MODEL", settings.location.default_anthropic_model)

    if not api_key or not (listing.get("description") or "").strip():
        return []

    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=settings.location.extraction_max_tokens,
        temperature=settings.location.anthropic_temperature,
        system=LOCATION_EXTRACTION_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _format_location_prompt(listing),
            }
        ],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": LOCATION_CLAIMS_SCHEMA,
            }
        },
    )

    raw_text = "\n".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()
    if not raw_text:
        return []

    parsed = json.loads(_strip_code_fences(raw_text))
    claims = [
        ExtractedLocationClaim.model_validate(item)
        for item in parsed.get("claims", [])
    ]
    return _dedupe_claims(claims)


async def _geocode_origin(
    client: httpx.AsyncClient,
    api_key: str,
    origin_query: str,
) -> Tuple[Optional[str], Optional[str], List[str], Optional[str]]:
    response = await client.get(
        settings.location.geocode_url,
        params={"address": origin_query, "key": api_key},
        timeout=settings.location.request_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()

    if payload.get("status") != "OK" or not payload.get("results"):
        error_message = payload.get("error_message") or payload.get("status")
        return None, None, [], error_message

    result = payload["results"][0]
    geometry = result.get("geometry", {}).get("location", {})
    lat = geometry.get("lat")
    lng = geometry.get("lng")
    if lat is None or lng is None:
        return None, result.get("formatted_address"), result.get("types", []), "Geocode result had no coordinates"

    return (
        f"{lat},{lng}",
        result.get("formatted_address"),
        result.get("types", []),
        None,
    )


async def _verify_claim(
    client: httpx.AsyncClient,
    api_key: str,
    origin_coords: str,
    claim: ExtractedLocationClaim,
) -> LocationVerificationCheck:
    mode_used = _mode_for_maps(claim.mode)
    response = await client.get(
        settings.location.distance_matrix_url,
        params={
            "origins": origin_coords,
            "destinations": claim.destination,
            "mode": mode_used,
            "key": api_key,
        },
        timeout=settings.location.request_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()

    if payload.get("status") != "OK":
        return LocationVerificationCheck(
            phrase=claim.phrase,
            destination=claim.destination,
            claimedMinutes=claim.claimedMinutes,
            actualMinutes=None,
            actualDurationText=None,
            modeUsed=mode_used,
            modeExplicit=claim.modeExplicit,
            accurate=None,
            differenceMinutes=None,
            severity=None,
            verdict="Google Maps could not verify this claim for the extracted destination.",
        )

    element = payload.get("rows", [{}])[0].get("elements", [{}])[0]
    if element.get("status") != "OK":
        return LocationVerificationCheck(
            phrase=claim.phrase,
            destination=claim.destination,
            claimedMinutes=claim.claimedMinutes,
            actualMinutes=None,
            actualDurationText=None,
            modeUsed=mode_used,
            modeExplicit=claim.modeExplicit,
            accurate=None,
            differenceMinutes=None,
            severity=None,
            verdict="Google Maps returned no route for this destination and mode.",
        )

    duration = element.get("duration", {})
    actual_seconds = duration.get("value")
    if actual_seconds is None:
        return LocationVerificationCheck(
            phrase=claim.phrase,
            destination=claim.destination,
            claimedMinutes=claim.claimedMinutes,
            actualMinutes=None,
            actualDurationText=None,
            modeUsed=mode_used,
            modeExplicit=claim.modeExplicit,
            accurate=None,
            differenceMinutes=None,
            severity=None,
            verdict="Google Maps did not return a usable travel time.",
        )

    actual_minutes = max(1, round(actual_seconds / 60))
    difference_minutes = max(0, actual_minutes - claim.claimedMinutes)
    accurate = actual_minutes <= claim.claimedMinutes * settings.location.accurate_time_multiplier
    severity = None if accurate else _severity_for_difference(difference_minutes)

    if accurate:
        verdict = (
            f"Google Maps estimates about {actual_minutes} minutes by {mode_used}, "
            "which is broadly plausible for this claim."
        )
    else:
        verdict = (
            f"Google Maps estimates about {actual_minutes} minutes by {mode_used}, "
            f"which is {difference_minutes} minutes longer than the listing claims."
        )

    if not claim.modeExplicit:
        verdict += " The listing did not specify a transport mode, so this check assumes the most practical mode."

    return LocationVerificationCheck(
        phrase=claim.phrase,
        destination=claim.destination,
        claimedMinutes=claim.claimedMinutes,
        actualMinutes=actual_minutes,
        actualDurationText=duration.get("text"),
        modeUsed=mode_used,
        modeExplicit=claim.modeExplicit,
        accurate=accurate,
        differenceMinutes=difference_minutes,
        severity=severity,
        verdict=verdict,
    )


async def verify_location_claims(listing: dict) -> LocationVerificationResult:
    origin_query = _build_origin_query(listing)
    api_key = os.getenv("GOOGLE_MAPS_KEY")
    if not api_key:
        return LocationVerificationResult(
            status="unavailable",
            summary="Location verification is unavailable until GOOGLE_MAPS_KEY is configured in backend/.env.",
            originQuery=origin_query,
            resolvedOrigin=None,
            originSource=None,
            originConfidence=None,
            checks=[],
        )

    try:
        claims = await _extract_location_claims(listing)
    except (json.JSONDecodeError, ValidationError, Exception):
        return LocationVerificationResult(
            status="error",
            summary="Lucent could not extract structured location claims from this listing.",
            originQuery=origin_query,
            resolvedOrigin=None,
            originSource=None,
            originConfidence=None,
            checks=[],
        )

    if not claims:
        return LocationVerificationResult(
            status="no_claims",
            summary="No specific travel-time claims were found that Lucent could verify.",
            originQuery=origin_query,
            resolvedOrigin=None,
            originSource=None,
            originConfidence=None,
            checks=[],
        )

    if not origin_query:
        inferred_origin = None
        try:
            inferred_origin = await _infer_origin_from_reviews(listing)
        except (json.JSONDecodeError, ValidationError, Exception):
            inferred_origin = None

        if not inferred_origin:
            return LocationVerificationResult(
                status="imprecise_origin",
                summary=(
                    "Lucent extracted travel-time claims, but Airbnb did not expose a usable listing location "
                    "and review snippets did not provide a confident enough neighborhood-level fallback."
                ),
                originQuery=None,
                resolvedOrigin=None,
                originSource=None,
                originConfidence=None,
                checks=_build_imprecise_origin_checks(
                    claims,
                    None,
                    "missing_origin",
                ),
            )

        try:
            async with httpx.AsyncClient() as client:
                inferred_coords, inferred_resolved_origin, inferred_types, inferred_error = await _geocode_origin(
                    client, api_key, inferred_origin.originCandidate
                )
                if inferred_coords and _is_precise_enough_geocode(inferred_types):
                    checks = _merge_similar_checks([
                        await _verify_claim(client, api_key, inferred_coords, claim)
                        for claim in claims
                    ])
                    inaccurate_count = len([check for check in checks if check.accurate is False])
                    plausible_count = len([check for check in checks if check.accurate is True])
                    summary = (
                        f"Verified {len(checks)} location claim(s) using a review-inferred origin "
                        f"'{inferred_resolved_origin or inferred_origin.originCandidate}' "
                        f"({inferred_origin.confidence} confidence): {plausible_count} look plausible and "
                        f"{inaccurate_count} appear overstated by Google Maps estimates."
                    )
                    return LocationVerificationResult(
                        status="ok",
                        summary=summary,
                        originQuery=None,
                        resolvedOrigin=inferred_resolved_origin or inferred_origin.originCandidate,
                        originSource="review_inferred",
                        originConfidence=inferred_origin.confidence,
                        checks=checks,
                    )
        except httpx.HTTPError:
            return LocationVerificationResult(
                status="error",
                summary="Google Maps request failed while verifying travel-time claims from a review-inferred origin.",
                originQuery=None,
                resolvedOrigin=None,
                originSource="review_inferred",
                originConfidence=inferred_origin.confidence,
                checks=_build_unverified_checks(
                    claims,
                    "Lucent extracted this claim and found a review-based origin fallback, but the Google Maps verification request failed before it could be checked.",
                ),
            )

        return LocationVerificationResult(
            status="imprecise_origin",
            summary=(
                "Lucent extracted travel-time claims and found a review-based location fallback, "
                "but it was not precise enough to verify responsibly."
            ),
            originQuery=None,
            resolvedOrigin=inferred_origin.originCandidate,
            originSource="review_inferred",
            originConfidence=inferred_origin.confidence,
            checks=_build_imprecise_origin_checks(
                claims,
                inferred_origin.originCandidate,
                "review_inferred",
            ),
        )

    try:
        async with httpx.AsyncClient() as client:
            origin_coords, resolved_origin, geocode_types, geocode_error = await _geocode_origin(
                client, api_key, origin_query
            )
            if not origin_coords:
                return LocationVerificationResult(
                    status="error",
                    summary=(
                        "Google Maps could not geocode the listing location well enough to verify claims."
                        + (f" ({geocode_error})" if geocode_error else "")
                    ),
                    originQuery=origin_query,
                    resolvedOrigin=resolved_origin,
                    originSource="listing_location",
                    originConfidence=None,
                    checks=_build_unverified_checks(
                        claims,
                        "Lucent extracted this claim, but Google Maps could not geocode the listing origin well enough to verify it.",
                    ),
                )

            if not _is_precise_enough_geocode(geocode_types):
                listing_text_origin = _infer_origin_from_listing_text(listing, resolved_origin or origin_query)
                if listing_text_origin:
                    listing_text_query, listing_text_confidence = listing_text_origin
                    inferred_coords, inferred_resolved_origin, inferred_types, inferred_error = await _geocode_origin(
                        client, api_key, listing_text_query
                    )
                    if inferred_coords and _is_precise_enough_geocode(inferred_types):
                        checks = _merge_similar_checks([
                            await _verify_claim(client, api_key, inferred_coords, claim)
                            for claim in claims
                        ])
                        inaccurate_count = len([check for check in checks if check.accurate is False])
                        plausible_count = len([check for check in checks if check.accurate is True])
                        summary = (
                            f"Verified {len(checks)} location claim(s) using a listing-text-inferred origin "
                            f"'{inferred_resolved_origin or listing_text_query}' "
                            f"({listing_text_confidence} confidence): {plausible_count} look plausible and "
                            f"{inaccurate_count} appear overstated by Google Maps estimates."
                        )
                        return LocationVerificationResult(
                            status="ok",
                            summary=summary,
                            originQuery=origin_query,
                            resolvedOrigin=inferred_resolved_origin or listing_text_query,
                            originSource="listing_text_inferred",
                            originConfidence=listing_text_confidence,
                            checks=checks,
                        )

                inferred_origin = None
                try:
                    inferred_origin = await _infer_origin_from_reviews(listing)
                except (json.JSONDecodeError, ValidationError, Exception):
                    inferred_origin = None

                if inferred_origin:
                    inferred_coords, inferred_resolved_origin, inferred_types, inferred_error = await _geocode_origin(
                        client, api_key, inferred_origin.originCandidate
                    )
                    if inferred_coords and _is_precise_enough_geocode(inferred_types):
                        checks = _merge_similar_checks([
                            await _verify_claim(client, api_key, inferred_coords, claim)
                            for claim in claims
                        ])
                        inaccurate_count = len([check for check in checks if check.accurate is False])
                        plausible_count = len([check for check in checks if check.accurate is True])
                        summary = (
                            f"Verified {len(checks)} location claim(s) using a review-inferred origin "
                            f"'{inferred_resolved_origin or inferred_origin.originCandidate}' "
                            f"({inferred_origin.confidence} confidence): {plausible_count} look plausible and "
                            f"{inaccurate_count} appear overstated by Google Maps estimates."
                        )
                        return LocationVerificationResult(
                            status="ok",
                            summary=summary,
                            originQuery=origin_query,
                            resolvedOrigin=inferred_resolved_origin or inferred_origin.originCandidate,
                            originSource="review_inferred",
                            originConfidence=inferred_origin.confidence,
                            checks=checks,
                        )

                imprecise_checks = _build_imprecise_origin_checks(
                    claims,
                    resolved_origin or origin_query,
                    "listing_location",
                )
                return LocationVerificationResult(
                    status="imprecise_origin",
                    summary=(
                        f"Lucent extracted {len(imprecise_checks)} travel-time claim(s), but the listing location is only "
                        f"'{resolved_origin or origin_query}', which is too broad to verify precisely."
                        + (
                            " Listing text and review snippets did not provide a confident enough neighborhood-level fallback."
                            if not inferred_origin
                            else " Lucent found a review-based fallback candidate, but it was not precise enough to verify responsibly."
                        )
                    ),
                    originQuery=origin_query,
                    resolvedOrigin=resolved_origin,
                    originSource="listing_location",
                    originConfidence=None,
                    checks=imprecise_checks,
                )

            checks = _merge_similar_checks([
                await _verify_claim(client, api_key, origin_coords, claim)
                for claim in claims
            ])
    except httpx.HTTPError:
        return LocationVerificationResult(
            status="error",
            summary="Google Maps request failed while verifying travel-time claims.",
            originQuery=origin_query,
            resolvedOrigin=None,
            originSource="listing_location",
            originConfidence=None,
            checks=_build_unverified_checks(
                claims,
                "Lucent extracted this claim, but the Google Maps verification request failed before it could be checked.",
            ),
        )

    inaccurate_count = len([check for check in checks if check.accurate is False])
    plausible_count = len([check for check in checks if check.accurate is True])
    summary = (
        f"Verified {len(checks)} location claim(s): {plausible_count} look plausible and "
        f"{inaccurate_count} appear overstated by Google Maps estimates."
    )

    return LocationVerificationResult(
        status="ok",
        summary=summary,
        originQuery=origin_query,
        resolvedOrigin=resolved_origin,
        originSource="listing_location",
        originConfidence="high",
        checks=checks,
    )
