import base64
import io
import fitz
import pandas as pd
import docx


def is_image(content_type: str) -> bool:
    return content_type.startswith("image/")


def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)


def extract_text_from_excel(file_bytes: bytes) -> str:
    xls = pd.ExcelFile(io.BytesIO(file_bytes))
    parts = []
    for sheet in xls.sheet_names:
        df = xls.parse(sheet)
        parts.append(f"Sheet: {sheet}\n{df.to_string(index=False)}")
    return "\n\n".join(parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    document = docx.Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in document.paragraphs if p.text.strip())


def extract_text(file_bytes: bytes, content_type: str) -> str:
    if "pdf" in content_type:
        return extract_text_from_pdf(file_bytes)
    if "spreadsheet" in content_type or "excel" in content_type or content_type.endswith(".sheet"):
        return extract_text_from_excel(file_bytes)
    if "wordprocessingml" in content_type or "msword" in content_type:
        return extract_text_from_docx(file_bytes)
    return ""


def image_to_base64_url(file_bytes: bytes, content_type: str) -> str:
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{content_type};base64,{b64}"
