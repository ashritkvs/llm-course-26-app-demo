import re
from typing import Optional

from config import settings


def _compact_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _clip_review(
    text: str,
    max_chars: int = settings.reviews.clip_max_chars,
) -> str:
    cleaned = _compact_spaces(text)
    if len(cleaned) <= max_chars:
        return cleaned

    snippet = cleaned[: max_chars - 1].rsplit(" ", 1)[0].strip()
    return f"{snippet}…"


def _review_tone(rating: Optional[float], review_count: Optional[int]) -> str:
    if rating is None:
        return "Lucent could not read enough guest feedback from this page to summarize review sentiment."

    if rating >= 4.85:
        tone = "Guest feedback looks very strong overall"
    elif rating >= 4.65:
        tone = "Guest feedback looks strong overall"
    elif rating >= 4.4:
        tone = "Guest feedback looks fairly solid overall, with some room for caution"
    elif rating >= 4.0:
        tone = "Guest feedback raises some caution"
    else:
        tone = "Guest feedback raises significant concern"

    if isinstance(review_count, int) and review_count > 0:
        return f"{tone}, with an overall rating of {rating:.2f} across about {review_count} review(s)."

    return f"{tone}, with an overall rating of {rating:.2f}."


def _top_review_themes(
    reviews: list[str],
    limit: int = settings.reviews.theme_limit,
) -> list[str]:
    counts: dict[str, int] = {}

    for review in reviews:
        lowered = review.lower()
        for theme, keywords in settings.reviews.theme_keywords.items():
            if any(keyword in lowered for keyword in keywords):
                counts[theme] = counts.get(theme, 0) + 1

    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    labels = {
        "cleanliness": "cleanliness",
        "location": "location convenience",
        "host": "host friendliness",
        "check-in": "easy check-in",
        "comfort": "comfort",
        "value": "value",
        "quiet": "quietness",
    }

    return [labels[key] for key, _count in ordered[:limit]]


def summarize_reviews(listing: dict) -> dict:
    reviews = [_compact_spaces(review) for review in (listing.get("reviews") or []) if _compact_spaces(review)]
    rating = listing.get("rating")
    review_count = listing.get("reviewCount")

    if not reviews:
        return {
            "summary": (
                f"{_review_tone(rating, review_count)} Airbnb did not expose readable review text on this page, "
                "so Lucent could not extract recurring guest themes or snippets."
            ),
            "highlights": [],
        }

    themes = _top_review_themes(reviews)
    summary = _review_tone(rating, review_count)
    if themes:
        if len(themes) == 1:
            summary = f"Guests most often praise {themes[0]}. {summary}"
        elif len(themes) == 2:
            summary = f"Guests most often praise {themes[0]} and {themes[1]}. {summary}"
        else:
            summary = f"Guests most often praise {themes[0]}, {themes[1]}, and {themes[2]}. {summary}"

    highlights = [
        _clip_review(review)
        for review in reviews[: settings.reviews.highlight_limit]
    ]

    return {
        "summary": summary,
        "highlights": highlights,
    }
