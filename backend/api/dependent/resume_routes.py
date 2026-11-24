"""Resume, job posting, matching, tailoring and history endpoints (C1, C2, C3, C4)."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from backend.api.independent.schemas import (
    ApplyRequest,
    MatchRequest,
    PostingLink,
    PostingText,
    ResumeFromTailored,
    ResumeText,
    SaveRequest,
    TailoredEdit,
    TailorRequest,
)
from backend.applications.dependent.application_service import resume_from_tailored
from backend.applications.independent.application_rules import ApplicationError
from backend.image_recognition.independent.ocr import SUPPORTED_IMAGES, OCRUnavailable, image_to_text
from backend.job_tracker.dependent.tracker_service import add_job
from backend.profile.dependent.profile_service import profile_resume_text
from backend.storage.dependent.store import CREDENTIALS, POSTINGS, RESUMES, TAILORED, get_store
from backend.text_generation.dependent.resume_writer import analyse_match, tailor_resume
from backend.text_recognition.dependent.posting_reader import PostingFetchError, fetch_posting
from backend.text_recognition.independent.file_reader import read_file
from backend.text_recognition.independent.skill_extractor import analyse_document
from configuration.local_delete import delete_resume
from configuration.local_save import list_history, safe_name, save_resume
from configuration.settings import settings

router = APIRouter(tags=["Resumes & postings"])


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > settings.upload_max_mb * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {settings.upload_max_mb} MB")
    if not data:
        raise HTTPException(400, "The file is empty")
    return data


def _get_or_404(collection: str, row_id: str) -> dict:
    row = get_store().get(collection, row_id)
    if not row:
        raise HTTPException(404, f"{collection[:-1].replace('_', ' ')} not found")
    return row


def _resume_text(resume_id: str | None) -> str:
    if resume_id:
        return _get_or_404(RESUMES, resume_id)["text"]
    try:
        return profile_resume_text()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


def _save_posting(text: str, source: str, url: str | None = None, extra: dict | None = None) -> dict:
    analysis = analyse_document(text, "posting")
    return get_store().insert(POSTINGS, {
        "text": text, "source": source, "url": url, "analysis": analysis,
        "title": analysis.get("title"), "company": analysis.get("company"),
        "city": analysis["location"]["city"], "province": analysis["location"]["province"],
        **(extra or {}),
    })


# ---- Resumes ---------------------------------------------------------------
@router.post("/resumes/upload", summary="Upload a resume (PDF, DOCX or TXT) - C1")
async def upload_resume(file: UploadFile = File(...)):
    data = await _read_upload(file)
    try:
        text = await run_in_threadpool(read_file, file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(415, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - corrupt PDF/DOCX
        raise HTTPException(422, f"Could not read the file: {exc}") from exc
    if len(text.strip()) < 30:
        raise HTTPException(422, "Could not find text in this file (is it a scanned image?)")
    return get_store().insert(RESUMES, {"name": file.filename, "text": text, "source": "upload",
                                        "analysis": analyse_document(text, "resume")})


@router.post("/resumes/text", summary="Paste a resume as text - C1")
def add_resume_text(body: ResumeText):
    return get_store().insert(RESUMES, {"name": body.name, "text": body.text, "source": "text",
                                        "analysis": analyse_document(body.text, "resume")})


@router.post("/resumes/from-tailored", summary="Reuse the resume of a submitted application as a starting resume")
def add_resume_from_tailored(body: ResumeFromTailored):
    try:
        return resume_from_tailored(body.tailored_id)
    except ApplicationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.get("/resumes")
def list_resumes():
    return [{k: v for k, v in r.items() if k != "text"} for r in get_store().all(RESUMES)]


@router.get("/resumes/{resume_id}")
def get_resume(resume_id: str):
    return _get_or_404(RESUMES, resume_id)


@router.delete("/resumes/{resume_id}")
def remove_resume(resume_id: str):
    if not get_store().delete(RESUMES, resume_id):
        raise HTTPException(404, "resume not found")
    return {"deleted": resume_id}


# ---- Job postings ----------------------------------------------------------
@router.post("/postings/link", summary="Read a job posting from a link - C1")
async def posting_from_link(body: PostingLink):
    try:
        fetched = await run_in_threadpool(fetch_posting, str(body.url))
    except PostingFetchError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _save_posting(fetched["text"], "link", fetched["url"], {"parser": fetched["source"]})


@router.post("/postings/text", summary="Paste a job posting as text - C1")
def posting_from_text(body: PostingText):
    return _save_posting(body.text, "text", body.url)


@router.post("/postings/image", summary="Read a job posting from a screenshot - C3")
async def posting_from_image(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(SUPPORTED_IMAGES):
        raise HTTPException(415, f"Use an image: {', '.join(SUPPORTED_IMAGES)}")
    data = await _read_upload(file)
    try:
        ocr = await run_in_threadpool(image_to_text, data, settings.tesseract_cmd)
    except OCRUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if len(ocr["text"].split()) < 10:
        raise HTTPException(422, "Could not read enough text from the image. Try a clearer screenshot.")
    return _save_posting(ocr["text"], "image", extra={"ocr_confidence": ocr["confidence"], "image_name": file.filename})


@router.get("/postings")
def list_postings():
    return [{k: v for k, v in p.items() if k != "text"} for p in get_store().all(POSTINGS)]


@router.get("/postings/{posting_id}")
def get_posting(posting_id: str):
    return _get_or_404(POSTINGS, posting_id)


@router.delete("/postings/{posting_id}")
def remove_posting(posting_id: str):
    if not get_store().delete(POSTINGS, posting_id):
        raise HTTPException(404, "job posting not found")
    return {"deleted": posting_id}


# ---- Match (C1 + C4) and tailor (C2) ------------------------------------
@router.post("/match", summary="Matching and missing skills + related graph skills - C1 + C4")
def match(body: MatchRequest):
    posting = _get_or_404(POSTINGS, body.posting_id)
    return analyse_match(_resume_text(body.resume_id), posting["text"])


@router.post("/tailor", summary="Write the tailored resume - C2")
async def tailor(body: TailorRequest):
    posting = _get_or_404(POSTINGS, body.posting_id)
    resume_text = _resume_text(body.resume_id)
    try:
        result = await run_in_threadpool(
            tailor_resume, resume_text, posting["text"], body.instructions, body.provider
        )
    except Exception as exc:  # noqa: BLE001 - LLM errors when fallback disabled
        raise HTTPException(502, str(exc)) from exc
    row = get_store().insert(TAILORED, {
        "resume_id": body.resume_id, "posting_id": body.posting_id,
        "company": posting.get("company"), "title": posting.get("title"),
        "text": result["tailored_resume"], "llm": result["llm"],
        "score": result["analysis"]["score"],
    })
    return {**result, "id": row["id"]}


@router.get("/tailored")
def list_tailored():
    return [{k: v for k, v in t.items() if k != "text"} for t in get_store().all(TAILORED)]


@router.get("/tailored/{tailored_id}")
def get_tailored(tailored_id: str):
    return _get_or_404(TAILORED, tailored_id)


@router.put("/tailored/{tailored_id}", summary="Save the user's edits to a tailored resume")
def edit_tailored(tailored_id: str, body: TailoredEdit):
    _get_or_404(TAILORED, tailored_id)
    return get_store().update(TAILORED, tailored_id, {"text": body.text, "edited": True})


@router.post("/tailored/{tailored_id}/save", summary="Save as DOCX, PDF or TXT into history/<company>/")
def save_tailored(tailored_id: str, body: SaveRequest):
    tailored = _get_or_404(TAILORED, tailored_id)
    company = body.company or tailored.get("company") or "unknown_company"
    name = body.file_name or f"{safe_name(tailored.get('title') or 'resume')}_tailored"
    path = save_resume(company, name, tailored["text"], body.format)
    rel = path.relative_to(settings.history_dir).as_posix()
    get_store().update(TAILORED, tailored_id, {"saved_path": rel})
    return {"saved": rel, "download_url": f"{settings.api_prefix}/history/download?path={rel}"}


# ---- History ----------------------------------------------------------------
@router.get("/history", summary="Saved resumes in history/")
def history():
    return list_history()


@router.get("/history/download")
def download_history(path: str):
    full = (settings.history_dir / path).resolve()
    if settings.history_dir.resolve() not in full.parents or not full.is_file():
        raise HTTPException(404, "file not found")
    return FileResponse(full, filename=Path(full).name)


@router.delete("/history", summary="Delete 'all' saved resumes or one file name")
def delete_history_files(target: str):
    try:
        return {"deleted": delete_resume(target)}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


# ---- Apply -------------------------------------------------------------------
@router.post("/apply", summary="Apply with a tailored resume and add the job to the tracker")
def apply(body: ApplyRequest):
    tailored = _get_or_404(TAILORED, body.tailored_id)
    posting = get_store().get(POSTINGS, tailored["posting_id"]) or {}
    automation = "manual"
    if body.credential_id:
        cred = _get_or_404(CREDENTIALS, body.credential_id)
        if not cred.get("permission_to_apply"):
            raise HTTPException(403, "You have not given permission to apply on this website.")
        # Browser automation (sign in + apply) is a later step; the app never
        # opens a site without this permission.
        automation = "permitted - open the site to finish applying"
    job = add_job({
        "title": posting.get("title") or tailored.get("title"),
        "company": posting.get("company") or tailored.get("company"),
        "city": posting.get("city"), "province": posting.get("province"),
        "url": posting.get("url"), "resume_id": body.tailored_id,
    })
    return {"job": job, "automation": automation, "open_url": posting.get("url")}
