---
# Fill in all the fields below.
# See projects/00-demo-solha-park/project.md for a completed reference.

slug: lucene
# Your pre-created folder name — exactly as it appears under projects/.
# Example: if your folder is projects/aayush-nair, write: aayush-nair

title: Lucent: AI-Powered Listing Truth Detector

students:
  - TBD
# If multiple authors, add more lines:
#   - Another Name

tags:
  - chrome-extension
  - fastapi
  - anthropic
  - real-estate
  - trust-scoring
# 3–5 tags. Lowercase, hyphens only (no spaces, no uppercase).

category: lifestyle
# Pick exactly one:
# data-analysis, developer-tools, education, enterprise-tools,
# finance, health, lifestyle, productivity, research, other

tagline: Chrome extension that audits Airbnb listings for misleading claims.

featuredEligible: true
# Set to false only if you don't want your project featured on the home page.


# --- Preset (do not change) ---

semester: "Spring 2026"


# --- Add when you have them; leave as "" otherwise ---

shortTitle: "Lucent"
# Fill in only if your full title is long (25+ characters).
# Example: "Multi-Agent Meeting Intelligence System" → "Meeting Intelligence"

studentId: ""
# Your 9-digit Stony Brook ID, in quotes. Example: "123456789"
# Used for grading. Not displayed on the site.

videoUrl: ""
# Google Drive share link to your demo video.
# You can leave this empty in your first PR and add it once your video is ready.

thumbnail: ""
# Upload your thumbnail image to Google Drive and paste the share link here.
# You can leave this empty in your first PR and add it once your image is ready.

githubUrl: ""
# Only if you host your project's source code in your own GitHub repo.
---


## Problem

Airbnb listings often rely on vague marketing language, selective photos, and fuzzy location claims that are hard for renters to verify quickly. A user may need to cross-check the description, map, amenities, photos, and reviews manually before deciding whether a listing is trustworthy.


## Solution

Lucent is a Chrome extension backed by a FastAPI service that scans Airbnb listings and produces a structured trust report. It combines language analysis, location verification, photo analysis, review summarization, and a Trust Score so users can spot misleading or unverifiable claims before booking.


## User Flow

- The user opens an Airbnb listing page in Chrome.
- The user opens the Lucent sidebar and clicks `Scan Listing`.
- The extension scrapes listing details from the page, including description, location, amenities, photos, rating, and review snippets.
- The backend runs language analysis, location verification, photo consistency checks, review summarization, and Trust Score calculation.
- Lucent returns a report showing points to note, missing information, location checks, photo analysis, guest review summary, and the final Trust Score.


## LLM Components

- **Language Analysis** — uses Claude to detect materially vague, misleading, or unverifiable listing language and identify missing renter-critical details.
- **Location Claim Extraction** — uses Claude as a fallback extractor for travel-time claims when deterministic parsing is not enough.
- **Review-Based Origin Inference** — uses Claude to infer a likely neighborhood-level origin from review text when Airbnb exposes only a broad city.
- **Photo Analysis** — uses Claude Vision to compare listing claims against host photos and identify supported claims, contradictions, or major unverified visual claims.


## Tools

- **Frontend:** Chrome Extension (Manifest V3), vanilla JavaScript, CSS
- **Backend:** Python, FastAPI, Uvicorn, httpx, Pydantic
- **LLM:** Anthropic Claude Sonnet, Claude Vision
- **APIs:** Google Maps Geocoding API, Google Maps Distance Matrix API
