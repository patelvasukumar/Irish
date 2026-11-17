"""
C3 - Image recognition: read the text of a job posting from a screenshot/photo.

Uses Tesseract OCR (free). Install on Windows from
https://github.com/UB-Mannheim/tesseract/wiki and set TESSERACT_CMD in .env
if tesseract.exe is not on PATH.
"""
from __future__ import annotations

import io

SUPPORTED_IMAGES = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")


class OCRUnavailable(Exception):
    pass


def preprocess(image):
    """Grayscale + upscale small screenshots + light threshold for better OCR."""
    from PIL import ImageOps

    img = ImageOps.exif_transpose(image).convert("L")
    if img.width < 1400:
        scale = 1400 / img.width
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    img = ImageOps.autocontrast(img)
    return img


def image_to_text(data: bytes, tesseract_cmd: str = "") -> dict:
    try:
        import pytesseract
        from PIL import Image, UnidentifiedImageError
    except ImportError as exc:
        raise OCRUnavailable("Install pillow and pytesseract (pip install -r requirements.txt).") from exc

    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    try:
        image = Image.open(io.BytesIO(data))
    except UnidentifiedImageError as exc:
        raise ValueError("The file is not a readable image.") from exc

    try:
        processed = preprocess(image)
        text = pytesseract.image_to_string(processed, config="--psm 6")
        data_conf = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRUnavailable(
            "Tesseract OCR is not installed. Install it and set TESSERACT_CMD in .env."
        ) from exc

    confs = [float(c) for c in data_conf.get("conf", []) if str(c) not in ("-1", "")]
    return {
        "text": text.strip(),
        "confidence": round(sum(confs) / len(confs), 1) if confs else None,
        "width": image.width,
        "height": image.height,
    }
