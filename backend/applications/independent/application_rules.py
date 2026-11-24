"""
Applications in progress - pure rules (no imports from other app files).

An application is one job you are working on in the Tailor tab:
resume -> job posting -> skill match -> tailored resume -> submit on the
job portal. It stays "in progress" until you mark it submitted; then it is
added to the Job Application Tracker.
"""
from __future__ import annotations

IN_PROGRESS = "in_progress"
SUBMITTED = "submitted"

# Where the selected resume came from (the "Choose a resume" popup).
RESUME_SOURCES = ("upload", "submitted", "profile")

TOTAL_STEPS = 5
STEP_LABELS = {
    1: "Choose a resume",
    2: "Job posting",
    3: "Skill match",
    4: "Tailored resume",
    5: "Submit on the job portal",
}

# Fields the app can change with PATCH /applications/{id}.
EDITABLE_FIELDS = ("resume_id", "resume_source", "posting_id", "tailored_id", "match_score", "credential_id")


class ApplicationError(Exception):
    """Error with an HTTP status code, raised by the application service."""

    status_code = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code


def has_resume(app: dict) -> bool:
    return bool(app.get("resume_source"))


def current_step(app: dict) -> int:
    """The first step that is not done yet (1-5)."""
    if not has_resume(app):
        return 1
    if not app.get("posting_id"):
        return 2
    if app.get("match_score") is None:
        return 3
    if not app.get("tailored_id"):
        return 4
    return 5


def is_waiting_to_submit(app: dict) -> bool:
    """The job portal was opened but the application is not marked submitted yet."""
    return bool(app.get("tailored_id") and app.get("portal_opened_at") and app.get("status", IN_PROGRESS) == IN_PROGRESS)


def progress_percent(app: dict) -> int:
    if app.get("status") == SUBMITTED:
        return 100
    if is_waiting_to_submit(app):
        return 90
    done = sum([
        has_resume(app),
        bool(app.get("posting_id")),
        app.get("match_score") is not None,
        bool(app.get("tailored_id")),
    ])
    return round(100 * done / TOTAL_STEPS)


def with_progress(app: dict) -> dict:
    """Copy of the row with the computed step fields the cards show."""
    step = current_step(app)
    waiting = is_waiting_to_submit(app)
    return {
        **app,
        "step": step,
        "total_steps": TOTAL_STEPS,
        "step_label": "Waiting to submit" if waiting else STEP_LABELS[step],
        "waiting_to_submit": waiting,
        "progress": progress_percent(app),
    }


def resets_for(app: dict, changes: dict) -> dict:
    """
    When an earlier step changes, the later steps are no longer valid
    (same rule as the screen: a new resume or posting means a new match
    and a new tailored resume).
    """
    reset: dict = {}
    resume_changed = (
        ("resume_id" in changes and changes["resume_id"] != app.get("resume_id"))
        or ("resume_source" in changes and changes["resume_source"] != app.get("resume_source"))
    )
    posting_changed = "posting_id" in changes and changes["posting_id"] != app.get("posting_id")
    if resume_changed or posting_changed:
        reset.update({"match_score": None, "tailored_id": None, "portal_opened_at": None})
    if "tailored_id" in changes and changes["tailored_id"] != app.get("tailored_id"):
        reset["portal_opened_at"] = None
    # Values sent in the same request win over the resets.
    return {k: v for k, v in reset.items() if k not in changes}


def submitted_resume_entries(jobs: list[dict], tailored_by_id: dict[str, dict]) -> list[dict]:
    """
    Resumes used in submitted applications, in the same order as the Job
    Tracker list (`jobs` must already be sorted newest first). Jobs added
    by hand or from an email have no tailored resume and are skipped.
    """
    entries = []
    for job in jobs:
        tailored = tailored_by_id.get(job.get("resume_id") or "")
        if not tailored:
            continue
        entries.append({
            "job_id": job.get("id"),
            "tailored_id": tailored["id"],
            "title": job.get("title") or tailored.get("title"),
            "company": job.get("company") or tailored.get("company"),
            "city": job.get("city"),
            "province": job.get("province"),
            "status": job.get("status"),
            "applied_at": job.get("applied_at") or job.get("created_at"),
            "score": tailored.get("score"),
        })
    return entries


def recent_upload_entries(resumes: list[dict], used_resume_ids: set[str]) -> list[dict]:
    """Uploaded resumes (newest first) that were not used in a submitted application yet."""
    return [
        {k: v for k, v in r.items() if k != "text"}
        for r in resumes
        if r.get("source", "upload") != "tailored" and r.get("id") not in used_resume_ids
    ]
