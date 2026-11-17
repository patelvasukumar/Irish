"""
Save a generated resume locally.

The file goes to history/<company>/<name>.<docx|pdf|txt>.

CLI:  python -m configuration.local_save "Company" "my_resume" pdf path/to/resume.txt
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from configuration.settings import settings

ALLOWED_FORMATS = ("docx", "pdf", "txt")


def safe_name(value: str, fallback: str = "untitled") -> str:
    """Make a string safe to use as a file or folder name."""
    cleaned = re.sub(r"[^A-Za-z0-9 _.-]", "", value or "").strip().strip(".")
    cleaned = re.sub(r"\s+", "_", cleaned)
    return cleaned[:80] or fallback


def _inline(text: str) -> tuple[str, bool, bool]:
    """Strip simple Markdown emphasis. Returns (plain_text, bold, italic)."""
    bold = italic = False
    m = re.fullmatch(r"\*\*(.+)\*\*", text)
    if m:
        text, bold = m.group(1), True
    m = re.fullmatch(r"_(.+)_", text)
    if m:
        text, italic = m.group(1), True
    return text.replace("**", ""), bold, italic


def _write_txt(path: Path, text: str) -> None:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            lines += ["", stripped[3:].upper()]
        elif stripped.startswith("# "):
            lines.append(stripped[2:])
        else:
            lines.append(_inline(stripped)[0])
    path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def _write_docx(path: Path, text: str) -> None:
    from docx import Document  # python-docx

    doc = Document()
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            doc.add_heading(stripped[2:], level=0)
        elif stripped.startswith("## "):
            doc.add_heading(stripped[3:], level=1)
        elif stripped.startswith(("- ", "* ")):
            doc.add_paragraph(_inline(stripped[2:])[0], style="List Bullet")
        elif stripped:
            plain, bold, italic = _inline(stripped)
            run = doc.add_paragraph().add_run(plain)
            run.bold, run.italic = bold, italic
    doc.save(str(path))


def _write_pdf(path: Path, text: str) -> None:
    from fpdf import FPDF  # fpdf2

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    width = pdf.w - pdf.l_margin - pdf.r_margin
    for line in text.splitlines():
        stripped = line.strip()
        # Core PDF fonts are latin-1 only.
        safe = stripped.encode("latin-1", "replace").decode("latin-1")
        if stripped.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            pdf.multi_cell(width, 9, safe[2:])
        elif stripped.startswith("## "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(width, 7, safe[3:])
        elif stripped.startswith(("- ", "* ")):
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(width, 5, "  - " + _inline(safe[2:])[0])
        elif stripped:
            plain, bold, italic = _inline(safe)
            pdf.set_font("Helvetica", ("B" if bold else "") + ("I" if italic else ""), 10)
            pdf.multi_cell(width, 5, plain)
        else:
            pdf.ln(3)
    pdf.output(str(path))


def save_resume(company: str, file_name: str, text: str, fmt: str = "txt") -> Path:
    """Create history/<company>/ and save the resume there. Returns the path."""
    fmt = fmt.lower().lstrip(".")
    if fmt not in ALLOWED_FORMATS:
        raise ValueError(f"Format must be one of {ALLOWED_FORMATS}")
    folder = settings.history_dir / safe_name(company, "unknown_company")
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{safe_name(file_name, 'resume')}.{fmt}"
    {"txt": _write_txt, "docx": _write_docx, "pdf": _write_pdf}[fmt](path, text)
    return path


def list_history() -> list[dict]:
    """List every saved resume in history/."""
    items: list[dict] = []
    if not settings.history_dir.exists():
        return items
    for path in sorted(settings.history_dir.rglob("*")):
        if path.is_file() and path.suffix.lstrip(".") in ALLOWED_FORMATS:
            items.append(
                {
                    "company": path.parent.name,
                    "file_name": path.name,
                    "path": path.relative_to(settings.history_dir).as_posix(),
                    "format": path.suffix.lstrip("."),
                    "size_bytes": path.stat().st_size,
                    "modified": path.stat().st_mtime,
                }
            )
    return items


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(1)
    _, company, name, fmt, source = sys.argv
    print(save_resume(company, name, Path(source).read_text(encoding="utf-8"), fmt))
