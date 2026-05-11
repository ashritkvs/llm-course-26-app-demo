# Directive: PDF Processing

## Goal
Process an uploaded PDF to extract structured learning concepts, definitions, and concept dependencies. These become question tags for quiz generation and analytics tracking.

## Inputs
| Input | Type | Source |
|---|---|---|
| `pdf_path` | string | File path of the uploaded PDF (saved to `.tmp/uploads/`) |

## Execution Script
- `execution/process_pdf.py`

## Process
1. User uploads a PDF via `POST /upload/pdf`.
2. Backend saves the file to `.tmp/uploads/<uuid>.pdf`.
3. Call `process_pdf.py` with the file path, which runs a 5-step pipeline:

### Step 1 — Extract text using PyMuPDF
- Open the PDF with `fitz` and extract text page-by-page.
- If the PDF is password-protected, raise an error.
- If extracted text is < 50 characters, warn that it may be a scanned/image PDF.

### Step 2 — Clean formatting and remove references
- Strip headers, footers, page numbers.
- Remove reference/bibliography sections (detect "References", "Bibliography" headings).
- Normalize whitespace and encoding issues.

### Step 3 — Chunk text safely for LLM context
- Split cleaned text into chunks of ≤ 6000 characters (~1500 tokens).
- Chunk on paragraph boundaries to preserve context.
- If the PDF is short enough (< 6000 chars), use a single chunk.

### Step 4 — Extract concepts using Gemini
- For each chunk, call Gemini with a structured prompt asking for:
  - `concepts`: key learning topics found in the text
  - `definitions`: concept-definition pairs
  - `dependencies`: which concepts depend on understanding other concepts
- Merge results across chunks, deduplicating concepts.

### Step 5 — Store concepts as tags in Supabase
- Upsert each extracted concept into the user's `concept_mastery` table.
- Return the full structured output.

## Expected Output
```json
{
  "concepts": [
    "mutual exclusion",
    "semaphores",
    "deadlock prevention",
    "banker's algorithm"
  ],
  "definitions": [
    {
      "concept": "mutual exclusion",
      "definition": "A property ensuring that only one process can access a critical section at a time."
    },
    {
      "concept": "semaphores",
      "definition": "Integer variables used to control access to shared resources through wait and signal operations."
    }
  ],
  "dependencies": [
    {
      "concept": "banker's algorithm",
      "requires": ["mutual exclusion", "deadlock prevention"]
    }
  ]
}
```

## Schema Validation Rules
- `concepts` must be a list of ≥ 1 non-empty strings.
- `definitions` must be a list of objects, each with `concept` (string) and `definition` (string).
- `dependencies` must be a list of objects, each with `concept` (string) and `requires` (list of strings).
- Every concept in `definitions` and `dependencies` must appear in the `concepts` list.

## Edge Cases & Learnings
- **Scanned/image PDFs**: Detected by short text length. Return a clear error — OCR is not yet supported.
- **Very large PDFs (> 50 pages)**: Chunking handles this, but limit to first 30 chunks to stay within API budget.
- **Non-academic PDFs**: Gemini may extract irrelevant concepts. The prompt includes "extract only educational/academic concepts."
- **Multi-language PDFs**: Currently English-only. Log a warning for non-English text.
- **Cleanup**: Delete uploaded files from `.tmp/uploads/` after processing.
