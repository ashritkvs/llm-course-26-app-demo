"""
process_pdf.py — PDF processing and concept extraction pipeline

5-step pipeline:
  1. Extract text using PyMuPDF
  2. Clean formatting and remove references
  3. Chunk text safely for LLM context
  4. Extract concepts using Gemini
  5. Store concepts in Supabase

Usage:
    python process_pdf.py --pdf-path /path/to/file.pdf

Returns JSON to stdout:
    {
      "concepts": [...],
      "definitions": [...],
      "dependencies": [...]
    }
"""

import os
import sys
import re
import json
import argparse
import fitz  # PyMuPDF
from dotenv import load_dotenv
from google import genai

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY must be set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-pro"

# Add parent dir for supabase imports
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase

# Max characters per chunk (~1500 tokens)
CHUNK_SIZE = 6000
MAX_CHUNKS = 30


# ===========================================================
# Step 1: Extract text using PyMuPDF
# ===========================================================
def extract_text(pdf_path: str) -> str:
    """
    Extract raw text from a PDF file page-by-page.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        Concatenated text from all pages.

    Raises:
        FileNotFoundError: If the file doesn't exist.
        RuntimeError: If the PDF is password-protected.
        ValueError: If the PDF appears to be scanned/image-based.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)

    if doc.is_encrypted:
        doc.close()
        raise RuntimeError("PDF is password-protected and cannot be processed.")

    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()

    full_text = "\n".join(pages_text).strip()

    if len(full_text) < 50:
        raise ValueError(
            "Very little text extracted — PDF may be scanned/image-based. "
            "OCR is not currently supported."
        )

    return full_text


# ===========================================================
# Step 2: Clean formatting and remove references
# ===========================================================
def clean_text(raw_text: str) -> str:
    """
    Clean extracted PDF text by removing references, headers/footers,
    page numbers, and normalizing whitespace.

    Args:
        raw_text: Raw text from PyMuPDF extraction.

    Returns:
        Cleaned text string.
    """
    text = raw_text

    # Remove reference/bibliography sections
    # Look for common headings and trim everything after
    ref_patterns = [
        r'\n\s*References\s*\n',
        r'\n\s*Bibliography\s*\n',
        r'\n\s*Works Cited\s*\n',
        r'\n\s*REFERENCES\s*\n',
        r'\n\s*BIBLIOGRAPHY\s*\n',
    ]
    for pattern in ref_patterns:
        match = re.search(pattern, text)
        if match:
            text = text[:match.start()]
            break

    # Remove page numbers (standalone numbers on their own line)
    text = re.sub(r'\n\s*\d{1,4}\s*\n', '\n', text)

    # Remove common header/footer patterns (repeated short lines)
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip very short lines that look like headers/footers
        if stripped and len(stripped) < 5 and not stripped[0].isalpha():
            continue
        cleaned_lines.append(line)
    text = '\n'.join(cleaned_lines)

    # Normalize whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)  # Collapse triple+ newlines
    text = re.sub(r'[ \t]+', ' ', text)       # Collapse spaces/tabs
    text = text.strip()

    return text


# ===========================================================
# Step 3: Chunk text safely for LLM context
# ===========================================================
def chunk_text(text: str, max_chars: int = CHUNK_SIZE) -> list[str]:
    """
    Split text into chunks on paragraph boundaries.

    Args:
        text: Cleaned text to chunk.
        max_chars: Maximum characters per chunk.

    Returns:
        List of text chunks, each ≤ max_chars.
    """
    if len(text) <= max_chars:
        return [text]

    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        # If adding this paragraph would exceed the limit, save current and start new
        if len(current_chunk) + len(para) + 2 > max_chars:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            # If a single paragraph exceeds max_chars, split it further
            if len(para) > max_chars:
                words = para.split()
                current_chunk = ""
                for word in words:
                    if len(current_chunk) + len(word) + 1 > max_chars:
                        chunks.append(current_chunk.strip())
                        current_chunk = word
                    else:
                        current_chunk += " " + word if current_chunk else word
            else:
                current_chunk = para
        else:
            current_chunk += "\n\n" + para if current_chunk else para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    # Enforce max chunks limit
    return chunks[:MAX_CHUNKS]


# ===========================================================
# Step 4: Extract concepts using Gemini
# ===========================================================

EXTRACTION_PROMPT = """You are an expert educator analyzing academic text. Extract the key learning concepts from the following text.

Text:
---
{chunk}
---

Return ONLY valid JSON (no markdown fences, no extra text) in this exact format:
{{
  "concepts": ["concept1", "concept2", ...],
  "definitions": [
    {{"concept": "concept1", "definition": "Clear, concise definition"}}
  ],
  "dependencies": [
    {{"concept": "concept2", "requires": ["concept1"]}}
  ]
}}

Rules:
- Extract only educational/academic concepts, not general words.
- Concepts should be lowercase, concise phrases (2–5 words).
- Include definitions only for concepts that have clear definitions in the text.
- Include dependencies only when a concept clearly depends on understanding another.
- If no meaningful concepts can be extracted, return: {{"concepts": [], "definitions": [], "dependencies": []}}
"""


def extract_concepts_from_chunk(chunk: str) -> dict:
    """
    Call Gemini to extract concepts from a single text chunk.

    Args:
        chunk: Text chunk to analyze.

    Returns:
        Dict with concepts, definitions, dependencies.
    """
    prompt = EXTRACTION_PROMPT.format(chunk=chunk)

    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = response.text.strip()

    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Retry once with stricter instruction
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON object."
        response = client.models.generate_content(model=MODEL, contents=retry_prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        data = json.loads(text)

    return data


def merge_chunk_results(results: list[dict]) -> dict:
    """
    Merge concept extraction results from multiple chunks,
    deduplicating by concept name.

    Args:
        results: List of per-chunk extraction dicts.

    Returns:
        Merged dict with deduplicated concepts, definitions, dependencies.
    """
    seen_concepts = set()
    seen_definitions = {}  # concept -> definition (keep first)
    seen_dependencies = {}  # concept -> set of requires

    for r in results:
        for c in r.get("concepts", []):
            seen_concepts.add(c)

        for d in r.get("definitions", []):
            concept = d.get("concept", "")
            if concept and concept not in seen_definitions:
                seen_definitions[concept] = d.get("definition", "")

        for dep in r.get("dependencies", []):
            concept = dep.get("concept", "")
            requires = dep.get("requires", [])
            if concept:
                if concept not in seen_dependencies:
                    seen_dependencies[concept] = set()
                seen_dependencies[concept].update(requires)

    return {
        "concepts": sorted(seen_concepts),
        "definitions": [
            {"concept": c, "definition": d}
            for c, d in sorted(seen_definitions.items())
        ],
        "dependencies": [
            {"concept": c, "requires": sorted(reqs)}
            for c, reqs in sorted(seen_dependencies.items())
            if reqs
        ],
    }


# ===========================================================
# Step 5: Store concepts in Supabase
# ===========================================================
def store_concepts(user_id: str, concepts: list[str]) -> None:
    """
    Upsert extracted concepts into the concept_mastery table.
    Creates rows with 0 attempts / 0 score if they don't exist.

    Args:
        user_id: UUID of the user.
        concepts: List of concept tag strings.
    """
    for concept in concepts:
        existing = (
            supabase.table("concept_mastery")
            .select("user_id")
            .eq("user_id", user_id)
            .eq("concept_tag", concept)
            .execute()
        )

        if not existing.data:
            supabase.table("concept_mastery").insert({
                "user_id": user_id,
                "concept_tag": concept,
                "attempts": 0,
                "correct_answers": 0,
                "mastery_score": 0.0,
            }).execute()


# ===========================================================
# Schema validation
# ===========================================================
def validate_schema(data: dict) -> None:
    """
    Validate the merged extraction output.

    Raises:
        ValueError: If validation fails.
    """
    if not isinstance(data.get("concepts"), list):
        raise ValueError("'concepts' must be a list")

    concept_set = set(data["concepts"])

    for d in data.get("definitions", []):
        if not isinstance(d, dict) or "concept" not in d or "definition" not in d:
            raise ValueError(f"Invalid definition entry: {d}")

    for dep in data.get("dependencies", []):
        if not isinstance(dep, dict) or "concept" not in dep or "requires" not in dep:
            raise ValueError(f"Invalid dependency entry: {dep}")
        if not isinstance(dep["requires"], list):
            raise ValueError(f"'requires' must be a list in: {dep}")


# ===========================================================
# Main pipeline
# ===========================================================
def process_pdf(pdf_path: str, user_id: str = None) -> dict:
    """
    Full 5-step pipeline: extract → clean → chunk → Gemini → store.

    Args:
        pdf_path: Path to the PDF file.
        user_id: Optional user UUID for storing concepts.

    Returns:
        Structured dict with concepts, definitions, dependencies.
    """
    # Step 1: Extract
    raw_text = extract_text(pdf_path)

    # Step 2: Clean
    cleaned = clean_text(raw_text)

    # Step 3: Chunk
    chunks = chunk_text(cleaned)

    # Step 4: Extract concepts per chunk via Gemini
    chunk_results = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i + 1}/{len(chunks)}...", file=sys.stderr)
        result = extract_concepts_from_chunk(chunk)
        chunk_results.append(result)

    # Merge and deduplicate
    merged = merge_chunk_results(chunk_results)

    # Validate
    validate_schema(merged)

    # Step 5: Store in Supabase
    if user_id and merged["concepts"]:
        store_concepts(user_id, merged["concepts"])

    return merged


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process PDF and extract learning concepts")
    parser.add_argument("--pdf-path", required=True, help="Path to the PDF file")
    parser.add_argument("--user-id", default=None, help="User UUID (optional, for storing concepts)")
    args = parser.parse_args()

    result = process_pdf(args.pdf_path, args.user_id)
    print(json.dumps(result, indent=2))
