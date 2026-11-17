"""Credential manager (C8), profile form, skill graph (C4) and system endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.api.independent.schemas import CredentialCreate, CredentialUpdate, Profile
from backend.credential_manager.dependent import credential_service as creds
from backend.graph_rag.dependent.graph_service import get_graph
from backend.image_recognition.independent.ocr import OCRUnavailable
from backend.profile.dependent.profile_service import get_profile, profile_resume_text, save_profile
from backend.text_generation.dependent.llm_factory import get_llm
from backend.text_recognition.independent.skill_extractor import SKILL_ALIASES
from configuration.settings import settings

# ---- Credential manager ------------------------------------------------
cred_router = APIRouter(prefix="/credentials", tags=["Credential manager"])


@cred_router.get("", summary="All saved company logins (passwords are never returned)")
def list_credentials():
    return creds.list_credentials()


@cred_router.post("", summary="Add company credential")
def add_credential(body: CredentialCreate):
    return creds.add_credential(body.company, str(body.site_url), body.username, body.password,
                                body.permission_to_apply)


@cred_router.patch("/{cred_id}", summary="Change a login or the permission to apply")
def update_credential(cred_id: str, body: CredentialUpdate):
    changes = body.model_dump(exclude_unset=True)
    if "site_url" in changes and changes["site_url"] is not None:
        changes["site_url"] = str(changes["site_url"])
    row = creds.update_credential(cred_id, changes)
    if not row:
        raise HTTPException(404, "credential not found")
    return row


@cred_router.delete("/{cred_id}")
def delete_credential(cred_id: str):
    if not creds.delete_credential(cred_id):
        raise HTTPException(404, "credential not found")
    return {"deleted": cred_id}


# ---- Profile -------------------------------------------------------------
profile_router = APIRouter(prefix="/profile", tags=["Profile"])


@profile_router.get("")
def read_profile():
    return get_profile()


@profile_router.put("")
def write_profile(body: Profile):
    return save_profile(body.model_dump())


@profile_router.get("/resume-preview", summary="Resume text built from the profile (used when there is no resume)")
def resume_preview():
    try:
        return {"text": profile_resume_text()}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


# ---- Skill graph -----------------------------------------------------------
graph_router = APIRouter(prefix="/graph", tags=["Skill graph (Graph RAG)"])


@graph_router.get("/related/{skill}")
def related(skill: str):
    return {"skill": skill, "related": get_graph().neighbours(skill), "backend": get_graph().backend_name}


@graph_router.get("/subgraph", summary="Nodes and edges around skills, for drawing")
def subgraph(skills: list[str] = Query(...), depth: int = Query(1, ge=1, le=2)):
    return get_graph().subgraph(skills, depth)


@graph_router.get("/title", summary="Skills a job title needs")
def title(title: str):
    return get_graph().skills_for_title(title)


@graph_router.get("/skills", summary="All skills the recognizer knows")
def known_skills():
    return sorted(SKILL_ALIASES)


# ---- System ---------------------------------------------------------------
system_router = APIRouter(tags=["System"])


@system_router.get("/health")
def health():
    llm = get_llm()
    try:
        import pytesseract

        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        ocr = f"tesseract {pytesseract.get_tesseract_version()}"
    except (ImportError, OCRUnavailable, Exception):  # noqa: BLE001
        ocr = "not installed"
    return {
        "status": "ok",
        "app": settings.app_name,
        "llm": llm.describe(),
        "llm_fallback_to_stub": settings.llm_fallback_to_stub,
        "graph": get_graph().backend_name,
        "database": "postgresql" if settings.database_url else "local json (temporary)",
        "ocr": ocr,
    }
