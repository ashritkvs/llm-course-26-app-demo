from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from analyzer import (
    AnalyzerConfigurationError,
    LanguageAnalysisError,
    analyze_listing_language,
    suppress_redundant_location_flags,
)
from location import verify_location_claims
from reviews import summarize_reviews
from scorer import calculate_score
from vision import analyze_listing_photos


class ListingPayload(BaseModel):
    title: str
    description: str
    price: Optional[float] = None
    location: str
    photos: list[str]
    amenities: list[str]
    rating: Optional[float] = None
    reviewCount: Optional[int] = None
    reviews: list[str] = []


app = FastAPI(title="Lucent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_listing(listing: ListingPayload) -> dict:
    try:
        language_analysis = await analyze_listing_language(listing.model_dump())
    except AnalyzerConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except LanguageAnalysisError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    location_result = await verify_location_claims(listing.model_dump())
    photo_result = await analyze_listing_photos(listing.model_dump())
    review_result = summarize_reviews(listing.model_dump())

    language_analysis = suppress_redundant_location_flags(
        language_analysis,
        [check.model_dump() for check in location_result.checks],
    )

    score_result = calculate_score(
        listing.model_dump(),
        language_analysis.model_dump(),
        location_result.model_dump(),
        photo_result.model_dump(),
    )

    return {
        "stage": "full-analysis",
        "score": score_result.score,
        "verdict": score_result.verdict,
        "color": score_result.color,
        "summary": language_analysis.summary,
        "redFlags": [flag.model_dump() for flag in language_analysis.redFlags],
        "missingFields": language_analysis.missingFields,
        "deductions": [deduction.model_dump() for deduction in score_result.deductions],
        "totalDeductions": score_result.totalDeductions,
        "locationSummary": location_result.summary,
        "locationStatus": location_result.status,
        "locationOrigin": location_result.resolvedOrigin or location_result.originQuery,
        "locationOriginSource": location_result.originSource,
        "locationOriginConfidence": location_result.originConfidence,
        "locationChecks": [check.model_dump() for check in location_result.checks],
        "photoOverallMatch": photo_result.overallMatch,
        "photoSummary": photo_result.summary,
        "photoAnalyzedCount": photo_result.analyzedPhotoCount,
        "photoMismatches": [mismatch.model_dump() for mismatch in photo_result.mismatches],
        "photoSupportedClaims": photo_result.supportedClaims,
        "photoUnverifiedClaims": photo_result.unverifiedClaims,
        "reviewSummary": review_result["summary"],
        "reviewHighlights": review_result["highlights"],
    }
