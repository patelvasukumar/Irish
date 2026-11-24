"""Applications in progress (Tailor tab -> "Application progress")."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.api.independent.schemas import ApplicationChanges, OpenPortalRequest
from backend.applications.dependent import application_service as svc
from backend.applications.independent.application_rules import ApplicationError

router = APIRouter(prefix="/applications", tags=["Applications in progress"])


def _call(fn, *args):
    try:
        return fn(*args)
    except ApplicationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.get("", summary="Applications not submitted yet, the last one you worked on first")
def list_applications():
    return svc.list_in_progress()


@router.post("", summary="Start a new application (optionally with a resume and/or posting)")
def create_application(body: ApplicationChanges | None = None):
    return _call(svc.create_application, body.model_dump(exclude_unset=True) if body else {})


@router.get("/resume-options", summary="Choices for the 'Choose a resume' popup")
def resume_options():
    return svc.resume_options()


@router.get("/{app_id}", summary="One application with its resume, posting and tailored resume")
def get_application(app_id: str):
    return _call(svc.get_detail, app_id)


@router.patch("/{app_id}", summary="Save a step (resume, posting, match score, tailored resume, login)")
def update_application(app_id: str, body: ApplicationChanges):
    return _call(svc.update_application, app_id, body.model_dump(exclude_unset=True))


@router.delete("/{app_id}", summary="Delete an application (resume files and History stay)")
def delete_application(app_id: str):
    if not svc.delete_application(app_id):
        raise HTTPException(404, "application not found")
    return {"deleted": app_id}


@router.post("/{app_id}/open-portal", summary="Step 5: open the job portal -> 'Waiting to submit'")
def open_portal(app_id: str, body: OpenPortalRequest):
    return _call(svc.open_portal, app_id, body.credential_id)


@router.post("/{app_id}/submit", summary="Mark as submitted: add to the Job Tracker, leave Application progress")
def submit_application(app_id: str):
    return _call(svc.submit_application, app_id)
