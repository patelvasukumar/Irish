"""
Applications in progress (Tailor tab -> "Application progress").

Every change on the Tailor screen is saved here, so an application can be
continued later from its card. "Mark as submitted" adds the job to the Job
Application Tracker (C7) and takes it out of the in-progress list.
"""
from __future__ import annotations

from datetime import datetime, timezone

from backend.applications.independent.application_rules import (
    EDITABLE_FIELDS,
    IN_PROGRESS,
    RESUME_SOURCES,
    SUBMITTED,
    ApplicationError,
    recent_upload_entries,
    resets_for,
    submitted_resume_entries,
    with_progress,
)
from backend.job_tracker.dependent.tracker_service import add_job
from backend.job_tracker.independent.filters import filter_jobs
from backend.profile.dependent.profile_service import get_profile
from backend.storage.dependent.store import (
    APPLICATIONS,
    CREDENTIALS,
    JOBS,
    POSTINGS,
    RESUMES,
    TAILORED,
    get_store,
)
from backend.text_recognition.independent.skill_extractor import analyse_document

PROFILE_RESUME_NAME = "My profile"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _without_text(row: dict | None) -> dict | None:
    return {k: v for k, v in row.items() if k != "text"} if row else None


def _get_app(app_id: str) -> dict:
    app = get_store().get(APPLICATIONS, app_id)
    if not app:
        raise ApplicationError("application not found", 404)
    return app


def _require(collection: str, row_id: str, what: str) -> dict:
    row = get_store().get(collection, row_id)
    if not row:
        raise ApplicationError(f"{what} not found", 404)
    return row


# ---- reading ----------------------------------------------------------------
def list_in_progress() -> list[dict]:
    """In-progress applications, the one you touched last first."""
    rows = get_store().all(APPLICATIONS, where=lambda a: a.get("status", IN_PROGRESS) == IN_PROGRESS)
    rows.sort(key=lambda a: a.get("updated_at") or a.get("created_at") or "", reverse=True)
    return [with_progress(a) for a in rows]


def get_detail(app_id: str) -> dict:
    """Everything the Tailor screen needs to continue where you left off."""
    app = _get_app(app_id)
    store = get_store()
    resume = store.get(RESUMES, app["resume_id"]) if app.get("resume_id") else None
    posting = store.get(POSTINGS, app["posting_id"]) if app.get("posting_id") else None
    tailored = store.get(TAILORED, app["tailored_id"]) if app.get("tailored_id") else None
    return {
        **with_progress(app),
        "resume": _without_text(resume),
        "posting": _without_text(posting),
        "tailored": tailored,
    }


# ---- changing ---------------------------------------------------------------
def _validate(app: dict, changes: dict) -> dict:
    """Check the ids exist and copy the display fields the cards need."""
    out = dict(changes)

    if "resume_source" in out or "resume_id" in out:
        source = out.get("resume_source", app.get("resume_source"))
        resume_id = out.get("resume_id", app.get("resume_id"))
        if source is None:
            out.update({"resume_source": None, "resume_id": None, "resume_name": None})
        elif source not in RESUME_SOURCES:
            raise ApplicationError(f"resume_source must be one of {RESUME_SOURCES}")
        elif source == "profile":
            if not get_profile().get("full_name"):
                raise ApplicationError("The profile is empty. Fill in the profile form first.")
            out.update({"resume_source": "profile", "resume_id": None, "resume_name": PROFILE_RESUME_NAME})
        else:
            if not resume_id:
                raise ApplicationError("resume_id is needed for an uploaded or submitted resume")
            resume = _require(RESUMES, resume_id, "resume")
            out.update({"resume_source": source, "resume_id": resume_id, "resume_name": resume.get("name")})

    if "posting_id" in out:
        if out["posting_id"]:
            posting = _require(POSTINGS, out["posting_id"], "job posting")
            out.update({
                "title": posting.get("title"), "company": posting.get("company"),
                "city": posting.get("city"), "province": posting.get("province"), "url": posting.get("url"),
            })
        else:
            out.update({"posting_id": None, "title": None, "company": None, "city": None, "province": None, "url": None})

    if out.get("tailored_id"):
        tailored = _require(TAILORED, out["tailored_id"], "tailored resume")
        posting_id = out.get("posting_id", app.get("posting_id"))
        if tailored.get("posting_id") != posting_id:
            raise ApplicationError("This tailored resume was written for a different job posting.")

    if out.get("credential_id"):
        _require(CREDENTIALS, out["credential_id"], "credential")

    if out.get("match_score") is not None and not 0 <= int(out["match_score"]) <= 100:
        raise ApplicationError("match_score must be between 0 and 100")

    return out


def create_application(data: dict | None = None) -> dict:
    row = get_store().insert(APPLICATIONS, {
        "status": IN_PROGRESS,
        "resume_id": None, "resume_source": None, "resume_name": None,
        "posting_id": None, "title": None, "company": None, "city": None, "province": None, "url": None,
        "match_score": None, "tailored_id": None, "credential_id": None,
        "portal_opened_at": None, "submitted_at": None, "job_id": None,
    })
    changes = {k: v for k, v in (data or {}).items() if k in EDITABLE_FIELDS}
    if changes:
        try:
            return update_application(row["id"], changes)
        except ApplicationError:
            get_store().delete(APPLICATIONS, row["id"])
            raise
    return with_progress(row)


def update_application(app_id: str, changes: dict) -> dict:
    app = _get_app(app_id)
    if app.get("status") == SUBMITTED:
        raise ApplicationError("This application is already submitted.", 409)
    changes = {k: v for k, v in changes.items() if k in EDITABLE_FIELDS}
    validated = _validate(app, changes)
    validated.update(resets_for(app, validated))
    return with_progress(get_store().update(APPLICATIONS, app_id, validated))


def delete_application(app_id: str) -> bool:
    """Removes only the application. Resumes, postings and History files stay."""
    return get_store().delete(APPLICATIONS, app_id)


def open_portal(app_id: str, credential_id: str | None) -> dict:
    """Step 5: the user is about to apply on the job portal -> 'Waiting to submit'."""
    app = _get_app(app_id)
    if app.get("status") == SUBMITTED:
        raise ApplicationError("This application is already submitted.", 409)
    if not app.get("tailored_id"):
        raise ApplicationError("Write the tailored resume first.")
    automation = "manual"
    if credential_id:
        cred = _require(CREDENTIALS, credential_id, "credential")
        if not cred.get("permission_to_apply"):
            raise ApplicationError("You have not given permission to apply on this website.", 403)
        # Browser automation (sign in + apply) is a later step; the app never
        # opens a site without this permission.
        automation = "permitted - open the site to finish applying"
    row = get_store().update(APPLICATIONS, app_id, {"portal_opened_at": _now(), "credential_id": credential_id})
    return {"application": with_progress(row), "open_url": app.get("url"), "automation": automation}


def submit_application(app_id: str) -> dict:
    """'Mark as submitted': add the job to the tracker and leave the in-progress list."""
    app = _get_app(app_id)
    if app.get("status") == SUBMITTED:
        raise ApplicationError("This application is already submitted.", 409)
    if not app.get("tailored_id"):
        raise ApplicationError("Write the tailored resume first.")
    tailored = _require(TAILORED, app["tailored_id"], "tailored resume")
    job = add_job({
        "title": app.get("title") or tailored.get("title"),
        "company": app.get("company") or tailored.get("company"),
        "city": app.get("city"), "province": app.get("province"),
        "url": app.get("url"), "resume_id": app["tailored_id"],
    })
    row = get_store().update(APPLICATIONS, app_id, {"status": SUBMITTED, "submitted_at": _now(), "job_id": job["id"]})
    return {"application": with_progress(row), "job": job}


# ---- the "Choose a resume" popup -------------------------------------------
def resume_options() -> dict:
    store = get_store()
    jobs = filter_jobs(store.all(JOBS))  # same order as the Job Tracker list
    tailored_by_id = {t["id"]: t for t in store.all(TAILORED)}
    submitted = submitted_resume_entries(jobs, tailored_by_id)

    used_resume_ids = {
        tailored_by_id[e["tailored_id"]].get("resume_id")
        for e in submitted
        if tailored_by_id[e["tailored_id"]].get("resume_id")
    }
    profile = get_profile()
    return {
        "submitted": submitted,
        "uploads": recent_upload_entries(store.all(RESUMES), used_resume_ids),
        "profile": {
            "saved": bool(profile.get("full_name")),
            "full_name": profile.get("full_name") or None,
            "updated_at": profile.get("updated_at"),
        },
    }


def resume_from_tailored(tailored_id: str) -> dict:
    """Use the resume of a submitted application as the starting resume of a new one."""
    tailored = _require(TAILORED, tailored_id, "tailored resume")
    store = get_store()
    existing = store.all(RESUMES, where=lambda r: r.get("from_tailored_id") == tailored_id)
    if existing:
        return existing[0]
    name = " · ".join(x for x in (tailored.get("title"), tailored.get("company")) if x) or "Tailored resume"
    return store.insert(RESUMES, {
        "name": name,
        "text": tailored["text"],
        "source": "tailored",
        "from_tailored_id": tailored_id,
        "analysis": analyse_document(tailored["text"], "resume"),
    })
