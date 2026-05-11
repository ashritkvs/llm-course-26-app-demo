from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

from config import settings


class ScoreDeduction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Literal["language", "missing_info", "location", "photo", "reviews"]
    reason: str
    severity: Optional[Literal["high", "medium", "low"]]
    points: int


class ScoreResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: int
    verdict: str
    color: Literal["green", "amber", "orange", "red"]
    deductions: list[ScoreDeduction]
    totalDeductions: int


def _location_points(check: dict) -> int:
    difference = check.get("differenceMinutes")
    if isinstance(difference, int):
        if difference > settings.location.high_difference_minutes:
            return settings.scoring.location_severity_deduction_map["high"]
        if difference >= settings.location.medium_difference_minutes:
            return settings.scoring.location_severity_deduction_map["medium"]
        return settings.scoring.location_severity_deduction_map["low"]

    severity = check.get("severity")
    return settings.scoring.location_severity_deduction_map.get(severity, 0)


def _score_band(score: int) -> tuple[str, Literal["green", "amber", "orange", "red"]]:
    for threshold, verdict, color in settings.scoring.score_bands:
        if score >= threshold:
            return verdict, color
    return "Highly Misleading", "red"


def _is_review_reputation_flag(flag: dict) -> bool:
    combined = f"{flag.get('phrase') or ''} {flag.get('explanation') or ''}".lower()
    return any(
        marker in combined
        for marker in [
            "star rating",
            "review count",
            "rating:",
            "reviews:",
            "guest reviews",
            "low rating",
            "extremely low",
        ]
    )


def _missing_field_points(field_name: str) -> int:
    normalized = field_name.lower()
    for marker, points in settings.scoring.missing_field_weights.items():
        if marker in normalized:
            return points
    return 1


def _review_reputation_adjustment(listing: dict) -> Optional[ScoreDeduction]:
    rating = listing.get("rating")
    review_count = listing.get("reviewCount")

    if rating is None:
        return None

    review_context = (
        f"{review_count} review(s)"
        if isinstance(review_count, int)
        else "an unknown review count"
    )

    if rating >= settings.scoring.strong_rating_threshold:
        if (
            isinstance(review_count, int)
            and review_count >= settings.scoring.strong_rating_many_reviews_threshold
        ):
            return ScoreDeduction(
                category="reviews",
                reason=f"Strong review reputation supports trust: rating {rating:.2f} across {review_context}.",
                severity=None,
                points=settings.scoring.strong_rating_bonus_many_reviews,
            )
        return ScoreDeduction(
            category="reviews",
            reason=f"Strong review reputation supports trust: rating {rating:.2f} across {review_context}.",
            severity=None,
            points=settings.scoring.strong_rating_bonus_default,
        )

    if rating >= settings.scoring.good_rating_threshold:
        if (
            isinstance(review_count, int)
            and review_count >= settings.scoring.good_rating_many_reviews_threshold
        ):
            return ScoreDeduction(
                category="reviews",
                reason=f"Good review reputation modestly supports trust: rating {rating:.2f} across {review_context}.",
                severity=None,
                points=settings.scoring.good_rating_bonus,
            )
        return None

    if rating >= settings.scoring.neutral_rating_threshold:
        return None

    if rating < settings.scoring.low_rating_major_threshold:
        if (
            isinstance(review_count, int)
            and review_count >= settings.scoring.low_rating_many_reviews_threshold
        ):
            points = settings.scoring.low_rating_major_points_many_reviews
        elif (
            isinstance(review_count, int)
            and review_count >= settings.scoring.low_rating_some_reviews_threshold
        ):
            points = settings.scoring.low_rating_major_points_some_reviews
        else:
            points = settings.scoring.low_rating_major_points_default
        severity = "high"
    elif rating < settings.scoring.low_rating_medium_threshold:
        if (
            isinstance(review_count, int)
            and review_count >= settings.scoring.low_rating_many_reviews_threshold
        ):
            points = settings.scoring.low_rating_medium_points_many_reviews
            severity = "high"
        elif (
            isinstance(review_count, int)
            and review_count >= settings.scoring.low_rating_some_reviews_threshold
        ):
            points = settings.scoring.low_rating_medium_points_some_reviews
            severity = "high"
        else:
            points = settings.scoring.low_rating_medium_points_default
            severity = "medium"
    else:
        if (
            isinstance(review_count, int)
            and review_count >= settings.scoring.low_rating_many_reviews_threshold
        ):
            points = settings.scoring.low_rating_minor_points_many_reviews
            severity = "medium"
        elif (
            isinstance(review_count, int)
            and review_count >= settings.scoring.low_rating_some_reviews_threshold
        ):
            points = settings.scoring.low_rating_minor_points_some_reviews
            severity = "medium"
        else:
            points = settings.scoring.low_rating_minor_points_default
            severity = "low"

    return ScoreDeduction(
        category="reviews",
        reason=f"Review reputation is concerning: rating {rating:.2f} across {review_context}.",
        severity=severity,
        points=points,
    )


def calculate_score(
    listing: dict,
    language_analysis: dict,
    location_result: dict,
    photo_result: dict,
) -> ScoreResult:
    deductions: list[ScoreDeduction] = []

    language_points = 0
    for flag in language_analysis.get("redFlags", []):
        if listing.get("rating") is not None and _is_review_reputation_flag(flag):
            continue

        severity = flag.get("severity")
        base_points = settings.scoring.language_deduction_map.get(severity, 0)
        remaining_cap = settings.scoring.language_deduction_cap - language_points
        applied_points = min(base_points, max(0, remaining_cap))

        if applied_points <= 0:
            continue

        deductions.append(
            ScoreDeduction(
                category="language",
                reason=f"Language flag: {flag.get('phrase') or 'Unspecified red flag'}",
                severity=severity,
                points=applied_points,
            )
        )
        language_points += applied_points

    missing_info_points = 0
    for missing_field in language_analysis.get("missingFields", []):
        base_points = _missing_field_points(missing_field)
        remaining_cap = settings.scoring.missing_info_cap - missing_info_points
        applied_points = min(base_points, max(0, remaining_cap))

        if applied_points <= 0:
            continue

        deductions.append(
            ScoreDeduction(
                category="missing_info",
                reason=f"Missing information: {missing_field}",
                severity="low" if applied_points == 1 else "medium",
                points=applied_points,
            )
        )
        missing_info_points += applied_points

    review_adjustment = _review_reputation_adjustment(listing)
    if review_adjustment is not None:
        deductions.append(review_adjustment)

    for check in location_result.get("checks", []):
        if check.get("accurate") is not False:
            continue

        severity = check.get("severity")
        points = _location_points(check)
        if points <= 0:
            continue

        deductions.append(
            ScoreDeduction(
                category="location",
                reason=f"Location claim appears overstated: {check.get('phrase') or 'Unnamed location claim'}",
                severity=severity,
                points=points,
            )
        )

    photo_mismatches = photo_result.get("mismatches", [])
    overall_match = photo_result.get("overallMatch")
    if overall_match == "poor" and photo_mismatches:
        deductions.append(
            ScoreDeduction(
                category="photo",
                reason="Photos materially contradict important listing claims.",
                severity="high",
                points=settings.scoring.photo_poor_penalty,
            )
        )
    elif overall_match == "partial" and photo_mismatches:
        deductions.append(
            ScoreDeduction(
                category="photo",
                reason="Photos only partially support the listing's written claims.",
                severity="medium",
                points=settings.scoring.photo_partial_penalty,
            )
        )

    for mismatch in photo_mismatches:
        severity = mismatch.get("severity")
        points = settings.scoring.photo_mismatch_deduction_map.get(severity, 0)
        if points <= 0:
            continue

        deductions.append(
            ScoreDeduction(
                category="photo",
                reason=f"Photo mismatch: {mismatch.get('claim') or 'Unnamed visual mismatch'}",
                severity=severity,
                points=points,
            )
        )

    total_deductions = max(0, sum(item.points for item in deductions))
    score = max(0, min(100, 100 - total_deductions))
    verdict, color = _score_band(score)

    return ScoreResult(
        score=score,
        verdict=verdict,
        color=color,
        deductions=deductions,
        totalDeductions=100 - score,
    )
