"""
C7 - Job Application Tracker service (single user, Canada only).
"""
from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone

from backend.job_tracker.independent.email_classifier import (
    JobStatus,
    classify_email,
    guess_company_from_sender,
    should_auto_update,
)
from backend.job_tracker.independent.filters import filter_jobs, filter_options
from backend.storage.dependent.store import EMAILS, JOBS, get_store

TRACKER_STATE = "tracker_state"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- tracker on/off ------------------------------------------------------
def get_state() -> dict:
    return get_store().get_singleton(TRACKER_STATE) or {"id": TRACKER_STATE, "enabled": True}


def set_enabled(enabled: bool) -> dict:
    return get_store().set_singleton(TRACKER_STATE, {"enabled": enabled})


# ---- jobs ----------------------------------------------------------------
def add_job(data: dict) -> dict:
    row = {
        "title": data.get("title") or "Untitled role",
        "company": data.get("company") or "Unknown company",
        "city": data.get("city"),
        "province": data.get("province"),
        "country": "Canada",
        "url": data.get("url"),
        "status": data.get("status") or JobStatus.APPLIED.value,
        "applied_at": data.get("applied_at") or _now(),
        "notes": data.get("notes", ""),
        "resume_id": data.get("resume_id"),
        "status_history": [{"status": data.get("status") or JobStatus.APPLIED.value, "at": _now(), "by": "user"}],
    }
    return get_store().insert(JOBS, row)


def list_jobs(**filters) -> dict:
    jobs = get_store().all(JOBS)
    return {"jobs": filter_jobs(jobs, **filters), "filters": filter_options(jobs), "state": get_state()}


def get_job(job_id: str) -> dict | None:
    job = get_store().get(JOBS, job_id)
    if job:
        job["emails"] = sorted(
            get_store().all(EMAILS, where=lambda e: e.get("job_id") == job_id),
            key=lambda e: e.get("received_at", ""),
        )
    return job


def update_job(job_id: str, changes: dict, by: str = "user") -> dict | None:
    store = get_store()
    job = store.get(JOBS, job_id)
    if not job:
        return None
    changes = {k: v for k, v in changes.items() if v is not None}
    if "status" in changes and changes["status"] != job.get("status"):
        history = job.get("status_history", []) + [{"status": changes["status"], "at": _now(), "by": by}]
        changes["status_history"] = history
    updated = store.update(JOBS, job_id, changes)
    if updated and updated.get("status") == JobStatus.SUCCESSFUL.value:
        updated["prompt_success_options"] = ["delete_history", "save_zip", "stop_tracker"]
    return updated


def delete_job(job_id: str) -> bool:
    store = get_store()
    for email in store.all(EMAILS, where=lambda e: e.get("job_id") == job_id):
        store.delete(EMAILS, email["id"])
    return store.delete(JOBS, job_id)


# ---- emails (C7 agent) ---------------------------------------------------
def _match_job(company: str | None, subject: str) -> dict | None:
    jobs = get_store().all(JOBS)
    subject_l = (subject or "").lower()
    if company:
        same = [j for j in jobs if (j.get("company") or "").lower() == company.lower()]
        if same:
            titled = [j for j in same if (j.get("title") or "").lower() in subject_l]
            return (titled or same)[0]
    for job in jobs:
        if (job.get("company") or "").lower() and (job["company"].lower() in subject_l):
            return job
    return None


def ingest_email(subject: str, sender: str, snippet: str = "", received_at: str | None = None,
                 link: str | None = None, message_id: str | None = None) -> dict:
    """Classify one email; link it to a job (create the job if needed); update status."""
    if not get_state().get("enabled", True):
        return {"is_job": False, "skipped": "tracker is stopped"}
    store = get_store()
    if message_id and store.all(EMAILS, where=lambda e: e.get("message_id") == message_id):
        return {"is_job": True, "skipped": "already processed"}

    result = classify_email(subject, sender, snippet)
    if not result["is_job"]:
        return {**result, "status": None}

    company = guess_company_from_sender(sender)
    job = _match_job(company, subject)
    created = False
    if job is None:
        job = add_job({"title": subject[:120], "company": company or "Unknown company",
                       "status": (result["status"] or JobStatus.APPLIED).value})
        created = True

    # Only the link, time, subject and sender are saved - never the full body (R9).
    email_row = store.insert(EMAILS, {
        "job_id": job["id"], "subject": subject, "sender": sender, "link": link,
        "message_id": message_id, "received_at": received_at or _now(),
        "detected_status": result["status"].value if result["status"] else None,
    })
    status_changed = False
    if result["status"] and not created and should_auto_update(job.get("status"), result["status"]):
        job = update_job(job["id"], {"status": result["status"].value}, by="agent") or job
        status_changed = True

    return {
        "is_job": True,
        "status": result["status"].value if result["status"] else None,
        "confidence": result["confidence"],
        "job_id": job["id"],
        "job_created": created,
        "status_changed": status_changed,
        "email_id": email_row["id"],
        "prompt_success_options": job.get("prompt_success_options"),
    }


def relink_email(email_id: str, job_id: str) -> dict | None:
    """User fixes a wrong link (risk R8)."""
    if not get_store().get(JOBS, job_id):
        return None
    return get_store().update(EMAILS, email_id, {"job_id": job_id})


# ---- success options -----------------------------------------------------
def export_zip() -> bytes:
    store = get_store()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        jobs = store.all(JOBS)
        zf.writestr("jobs.json", json.dumps(jobs, indent=2, ensure_ascii=False))
        zf.writestr("emails.json", json.dumps(store.all(EMAILS), indent=2, ensure_ascii=False))
        lines = ["title,company,city,province,status,applied_at"]
        for j in jobs:
            lines.append(",".join('"' + str(j.get(k) or "").replace('"', "'") + '"'
                                  for k in ["title", "company", "city", "province", "status", "applied_at"]))
        zf.writestr("jobs.csv", "\n".join(lines))
    return buf.getvalue()


def delete_history() -> dict:
    store = get_store()
    return {"jobs_deleted": store.clear(JOBS), "emails_deleted": store.clear(EMAILS)}
