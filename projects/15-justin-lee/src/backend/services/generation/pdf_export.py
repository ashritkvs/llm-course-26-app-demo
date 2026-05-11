from __future__ import annotations

import logging
import subprocess
import tempfile
import textwrap
from pathlib import Path
from typing import Literal

from backend.models.errors import ServiceUnavailableError
from backend.services.generation.models import FinalExamAssembly

logger = logging.getLogger(__name__)

ExportMode = Literal["questions", "solutions"]


def export_exam_to_pdf(
    *,
    assembly: FinalExamAssembly,
    output_dir: str,
    filename: str = "exam.pdf",
    mode: ExportMode = "questions",
) -> Path:
    """Convert a FinalExamAssembly to PDF via Pandoc (falls back to built-in).

    mode="questions"  — questions and MCQ choices only; no answers or explanations.
    mode="solutions"  — questions followed by the correct answer and full worked solution.
    """
    markdown = _render_markdown(assembly, mode=mode)
    output_path = Path(output_dir) / filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as tmp:
        tmp.write(markdown)
        tmp_path = tmp.name

    try:
        subprocess.run(
            ["pandoc", tmp_path, "-o", str(output_path)],
            check=True,
            capture_output=True,
            timeout=30,
        )
    except subprocess.CalledProcessError as exc:
        logger.warning(
            "Pandoc failed, falling back to builtin PDF exporter: %s",
            exc.stderr.decode() if exc.stderr else "unknown error",
        )
        _write_builtin_pdf(output_path=output_path, assembly=assembly, mode=mode)
    except subprocess.TimeoutExpired:
        logger.warning("Pandoc timed out, falling back to builtin PDF exporter")
        _write_builtin_pdf(output_path=output_path, assembly=assembly, mode=mode)
    except FileNotFoundError:
        logger.warning("Pandoc is not installed, falling back to builtin PDF exporter")
        _write_builtin_pdf(output_path=output_path, assembly=assembly, mode=mode)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return output_path


def _render_markdown(assembly: FinalExamAssembly, *, mode: ExportMode) -> str:
    lines: list[str] = [f"# {assembly.title}", ""]

    for question in assembly.questions:
        lines.append(f"## Question {question.question_order}")
        lines.append("")
        lines.append(question.question_text)
        lines.append("")

        if question.options:
            for i, option in enumerate(question.options):
                letter = chr(65 + i)
                lines.append(f"- **{letter}.** {option}")
            lines.append("")

        if mode == "solutions":
            if question.answer_key:
                lines.append(f"**Answer:** {question.answer_key}")
                lines.append("")
            if question.explanation:
                lines.append("**Solution:**")
                lines.append("")
                lines.append(question.explanation)
                lines.append("")

    return "\n".join(lines)


def _write_builtin_pdf(
    *, output_path: Path, assembly: FinalExamAssembly, mode: ExportMode
) -> None:
    pages = _paginate_lines(_render_text_lines(assembly, mode=mode))
    pdf_bytes = _build_pdf_document(pages)

    try:
        output_path.write_bytes(pdf_bytes)
    except OSError as exc:
        raise ServiceUnavailableError("PDF export failed") from exc


def _render_text_lines(assembly: FinalExamAssembly, *, mode: ExportMode) -> list[str]:
    lines = [assembly.title, ""]

    for question in assembly.questions:
        lines.append(f"Question {question.question_order}")
        lines.extend(_wrap_line(question.question_text))
        lines.append("")

        if question.options:
            for i, option in enumerate(question.options):
                letter = chr(65 + i)
                lines.extend(_wrap_line(f"{letter}. {option}"))
            lines.append("")

        if mode == "solutions":
            if question.answer_key:
                lines.extend(_wrap_line(f"Answer: {question.answer_key}"))
                lines.append("")
            if question.explanation:
                lines.append("Solution:")
                lines.extend(_wrap_line(question.explanation))
                lines.append("")

    return lines


def _wrap_line(text: str, width: int = 88) -> list[str]:
    stripped = text.strip()
    if not stripped:
        return [""]
    return textwrap.wrap(stripped, width=width) or [""]


def _paginate_lines(lines: list[str], lines_per_page: int = 46) -> list[list[str]]:
    if not lines:
        return [[""]]

    pages: list[list[str]] = []
    for index in range(0, len(lines), lines_per_page):
        pages.append(lines[index : index + lines_per_page])
    return pages


def _build_pdf_document(pages: list[list[str]]) -> bytes:
    objects: list[bytes] = []
    page_object_numbers: list[int] = []
    font_object_number = 3

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [] /Count 0 >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page_lines in pages:
        content_object_number = len(objects) + 2
        page_object_number = len(objects) + 1
        page_object_numbers.append(page_object_number)

        content_stream = _build_page_content(page_lines)
        page_object = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_object_number} 0 R >> >> "
            f"/Contents {content_object_number} 0 R >>"
        ).encode("ascii")
        content_object = (
            f"<< /Length {len(content_stream)} >>\nstream\n".encode("ascii")
            + content_stream
            + b"\nendstream"
        )

        objects.append(page_object)
        objects.append(content_object)

    kids = " ".join(f"{page_object_number} 0 R" for page_object_number in page_object_numbers)
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_object_numbers)} >>".encode("ascii")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]

    for object_number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_number} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))

    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(pdf)


def _build_page_content(lines: list[str]) -> bytes:
    stream_lines = [
        "BT",
        "/F1 12 Tf",
        "14 TL",
        "72 720 Td",
    ]

    for line in lines:
        escaped = _escape_pdf_text(line)
        stream_lines.append(f"({escaped}) Tj")
        stream_lines.append("T*")

    stream_lines.append("ET")
    return "\n".join(stream_lines).encode("latin-1", errors="replace")


def _escape_pdf_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )
