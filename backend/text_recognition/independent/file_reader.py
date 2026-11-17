"""
Read plain text out of uploaded resume files (PDF, DOCX, TXT).
Pure functions over bytes - no network or database access.
"""
from __future__ import annotations

import io

SUPPORTED = (".pdf", ".docx", ".txt", ".md")


def read_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def read_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def read_txt(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def read_file(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return read_pdf(data)
    if name.endswith(".docx"):
        return read_docx(data)
    if name.endswith((".txt", ".md")):
        return read_txt(data)
    raise ValueError(f"Unsupported file type. Use one of: {', '.join(SUPPORTED)}")
