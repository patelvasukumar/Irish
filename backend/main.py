"""
Irish - AI-Powered Resume Tailoring and Job Application Agent.

Run from the Irish/ folder:
    uvicorn backend.main:app --reload
Docs: http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from backend.api.dependent.application_routes import router as application_router
from backend.api.dependent.other_routes import cred_router, graph_router, profile_router, system_router
from backend.api.dependent.resume_routes import router as resume_router
from backend.api.dependent.tracker_routes import router as tracker_router
from configuration.settings import ROOT_DIR, settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="Irish API",
    version="0.1.0",
    description="AI-Powered Resume Tailoring and Job Application Agent",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (
    system_router, resume_router, application_router, tracker_router, cred_router, profile_router, graph_router,
):
    app.include_router(r, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/logo.png", include_in_schema=False)
def logo():
    return FileResponse(ROOT_DIR / "assets" / "logo.png")
