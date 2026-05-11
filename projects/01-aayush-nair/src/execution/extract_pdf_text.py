"""
extract_pdf_text.py — Deterministic PDF text extractor

Uses PyMuPDF (fitz) to extract text from a PDF file page-by-page.
No LLM calls — pure deterministic processing.

Usage:
    python extract_pdf_text.py <pdf_path>

Returns JSON to stdout:
    { "filename": "...", "page_count": N, "text": "..." }
"""

import sys
import json
import fitz  # PyMuPDF


def extract_text(pdf_path: str) -> dict:
    """
    Extract text from every page of a PDF.

    Args:
        pdf_path: Absolute or relative path to the PDF file.

    Returns:
        dict with filename, page_count, and concatenated text.

    Raises:
        FileNotFoundError: If the PDF does not exist.
        RuntimeError: If the PDF is encrypted/password-protected.
    """
    doc = fitz.open(pdf_path)

    if doc.is_encrypted:
        doc.close()
        raise RuntimeError(f"PDF is password-protected: {pdf_path}")

    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())

    doc.close()

    full_text = "\n".join(pages_text).strip()

    # Warn if text is suspiciously short (likely a scanned/image PDF)
    if len(full_text) < 50:
        print(
            "WARNING: Very little text extracted — PDF may be image-based.",
            file=sys.stderr,
        )

    return {
        "filename": pdf_path.split("/")[-1],
        "page_count": len(pages_text),
        "text": full_text,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf_text.py <pdf_path>", file=sys.stderr)
        sys.exit(1)

    result = extract_text(sys.argv[1])
    print(json.dumps(result, indent=2))
