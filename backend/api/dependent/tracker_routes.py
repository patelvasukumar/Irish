"""Job Application Tracker endpoints (C7)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from backend.api.independent.schemas import (
    EmailIn,
    JobCreate,
    JobUpdate,
    RelinkEmail,
    SuccessAction,
    TrackerToggle,
)
from backend.job_tracker.dependent import tracker_service as svc
from backend.job_tracker.dependent.mailbox import check_mailbox

router = APIRouter(prefix="/tracker", tags=["Job Application Tracker"])


@router.get("/jobs", summary="Jobs, newest first, with filter options found in the list")
def list_jobs(
    days: int | None = Query(None, ge=1, le=3650),
    company: str | None = None,
    city: str | None = None,
    province: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    return svc.list_jobs(days=days, company=company, city=city, province=province, status=status, search=search)


@router.post("/jobs")
def create_job(body: JobCreate):
    return svc.add_job(body.model_dump())


@router.get("/jobs/{job_id}", summary="Job details with notes, resume used and emails in time order")
def get_job(job_id: str):
    job = svc.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


@router.patch("/jobs/{job_id}", summary="Change status / notes by hand")
def update_job(job_id: str, body: JobUpdate):
    job = svc.update_job(job_id, body.model_dump(exclude_unset=True))
    if not job:
        raise HTTPException(404, "job not found")
    return job


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    if not svc.delete_job(job_id):
        raise HTTPException(404, "job not found")
    return {"deleted": job_id}


@router.post("/emails", summary="Send one email to the tracker agent (used for the demo test email)")
def ingest_email(body: EmailIn):
    return svc.ingest_email(body.subject, body.sender, body.snippet, body.received_at, body.link)


@router.patch("/emails/{email_id}", summary="Link an email to a different job")
def relink_email(email_id: str, body: RelinkEmail):
    row = svc.relink_email(email_id, body.job_id)
    if not row:
        raise HTTPException(404, "email or job not found")
    return row


@router.post("/check-mailbox", summary="Read the allowed mailbox (read-only) and update statuses")
async def run_mailbox_check(days: int = Query(14, ge=1, le=90)):
    try:
        return await run_in_threadpool(check_mailbox, days)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - IMAP / network errors
        raise HTTPException(502, f"Mailbox error: {exc}") from exc


@router.get("/state")
def state():
    return svc.get_state()


@router.put("/state", summary="Start or stop the tracker")
def toggle(body: TrackerToggle):
    return svc.set_enabled(body.enabled)


@router.get("/export", summary="Download the tracker history as a ZIP archive")
def export_zip():
    return Response(
        svc.export_zip(), media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="irish_tracker_history.zip"'},
    )


@router.post("/success-action", summary="Option chosen after a job becomes Successful")
def success_action(body: SuccessAction):
    if body.action == "save_zip":
        return {"action": "save_zip", "download_url": "/api/tracker/export"}
    if body.action == "stop_tracker":
        return {"action": "stop_tracker", "state": svc.set_enabled(False)}
    if not body.confirm:  # risk R10 - ask before deleting
        raise HTTPException(409, "Please confirm. Tip: save a ZIP archive first.")
    return {"action": "delete_history", **svc.delete_history()}
