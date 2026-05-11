"""
Edit this file to tune Lucent's backend behavior.

Most commonly adjusted knobs:
- `settings.vision.max_accessible_photos`
- `settings.location.accurate_time_multiplier`
- `settings.scoring.*`
- `settings.reviews.highlight_limit`
- `settings.analyzer.max_tokens`
"""

from dataclasses import dataclass, field
from typing import Dict, Literal, Tuple


@dataclass(frozen=True)
class AnalyzerSettings:
    default_anthropic_model: str = "claude-sonnet-4-6"
    max_tokens: int = 1400


@dataclass(frozen=True)
class VisionSettings:
    default_anthropic_model: str = "claude-sonnet-4-6"
    max_accessible_photos: int = 5
    anthropic_max_tokens: int = 1200
    request_timeout_seconds: float = 20.0
    supported_claims_limit: int = 5
    low_signal_unverified_markers: Tuple[str, ...] = (
        "washer",
        "dryer",
        "storage",
        "linens",
        "appliance",
        "microwave",
        "toaster",
        "coffee maker",
        "bed type",
        "full bed",
        "queen bed",
        "king bed",
        "small appliance",
    )


@dataclass(frozen=True)
class LocationSettings:
    default_anthropic_model: str = "claude-sonnet-4-6"
    geocode_url: str = "https://maps.googleapis.com/maps/api/geocode/json"
    distance_matrix_url: str = "https://maps.googleapis.com/maps/api/distancematrix/json"
    request_timeout_seconds: float = 20.0
    extraction_max_tokens: int = 1000
    review_origin_max_tokens: int = 800
    anthropic_temperature: float = 0.0
    accurate_time_multiplier: float = 2.0
    medium_difference_minutes: int = 5
    high_difference_minutes: int = 15


@dataclass(frozen=True)
class ReviewSettings:
    clip_max_chars: int = 170
    highlight_limit: int = 3
    theme_limit: int = 3
    theme_keywords: Dict[str, Tuple[str, ...]] = field(
        default_factory=lambda: {
            "cleanliness": ("clean", "spotless", "tidy", "well kept"),
            "location": ("location", "close", "near", "convenient", "airport", "downtown", "subway"),
            "host": ("host", "kind", "friendly", "helpful", "responsive", "welcoming"),
            "check-in": ("check in", "check-in", "easy to get in", "smooth", "arrival"),
            "comfort": ("comfortable", "comfort", "cozy", "bed", "sleep"),
            "value": ("value", "worth", "price", "affordable"),
            "quiet": ("quiet", "peaceful"),
        }
    )


@dataclass(frozen=True)
class ScoringSettings:
    language_deduction_map: Dict[str, int] = field(
        default_factory=lambda: {
            "high": 8,
            "medium": 4,
            "low": 1,
        }
    )
    photo_mismatch_deduction_map: Dict[str, int] = field(
        default_factory=lambda: {
            "high": 8,
            "medium": 4,
            "low": 2,
        }
    )
    location_severity_deduction_map: Dict[str, int] = field(
        default_factory=lambda: {
            "high": 12,
            "medium": 8,
            "low": 3,
        }
    )
    missing_field_weights: Dict[str, int] = field(
        default_factory=lambda: {
            "square footage": 2,
            "room dimensions": 2,
            "parking": 2,
            "laundry": 2,
            "pet policy": 2,
            "utilities": 1,
            "lease length": 1,
            "minimum stay": 1,
            "floor number": 1,
            "heating": 2,
            "cooling": 2,
            "noise": 2,
        }
    )
    language_deduction_cap: int = 18
    missing_info_cap: int = 12
    photo_partial_penalty: int = 6
    photo_poor_penalty: int = 12
    score_bands: Tuple[Tuple[int, str, Literal["green", "amber", "orange", "red"]], ...] = (
        (80, "Trustworthy", "green"),
        (60, "Some Concerns", "amber"),
        (40, "Significant Red Flags", "orange"),
        (0, "Highly Misleading", "red"),
    )
    strong_rating_threshold: float = 4.85
    strong_rating_many_reviews_threshold: int = 20
    strong_rating_bonus_many_reviews: int = -6
    strong_rating_bonus_default: int = -4
    good_rating_threshold: float = 4.70
    good_rating_many_reviews_threshold: int = 10
    good_rating_bonus: int = -2
    neutral_rating_threshold: float = 4.40
    low_rating_major_threshold: float = 4.0
    low_rating_medium_threshold: float = 4.2
    low_rating_minor_threshold: float = 4.4
    low_rating_many_reviews_threshold: int = 20
    low_rating_some_reviews_threshold: int = 5
    low_rating_major_points_many_reviews: int = 26
    low_rating_major_points_some_reviews: int = 18
    low_rating_major_points_default: int = 12
    low_rating_medium_points_many_reviews: int = 20
    low_rating_medium_points_some_reviews: int = 16
    low_rating_medium_points_default: int = 10
    low_rating_minor_points_many_reviews: int = 12
    low_rating_minor_points_some_reviews: int = 10
    low_rating_minor_points_default: int = 6


@dataclass(frozen=True)
class LucentSettings:
    analyzer: AnalyzerSettings = AnalyzerSettings()
    vision: VisionSettings = VisionSettings()
    location: LocationSettings = LocationSettings()
    reviews: ReviewSettings = ReviewSettings()
    scoring: ScoringSettings = ScoringSettings()


settings = LucentSettings()
