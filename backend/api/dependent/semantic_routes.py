"""Semantic match endpoints - compare by meaning with embeddings + pgvector."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.semantic_match.dependent import semantic_service as semantic
from backend.storage.dependent.store import JOBS, POSTINGS, get_store

router = APIRouter(tags=["Semantic match"])


def _get(collection: str, row_id: str, label: str) -> dict:
    row = get_store().get(collection, row_id)
    if not row:
        raise HTTPException(404, f"{label} not found")
    return row


@router.get("/semantic/status", summary="Is semantic match ready, which model and index (pgvector or in-app)")
def semantic_status():
    return semantic.status()


@router.get("/postings/{posting_id}/best-resumes", summary="Saved resumes ranked by overall fit for this posting")
def best_resumes(posting_id: str, limit: int = Query(3, ge=1, le=10)):
    return semantic.best_resumes(_get(POSTINGS, posting_id, "job posting"), limit)


@router.get("/postings/{posting_id}/duplicates", summary="Same job saved before (reworded or from another site)")
def posting_duplicates(posting_id: str):
    return semantic.duplicates(_get(POSTINGS, posting_id, "job posting"))


@router.get("/tracker/jobs/{job_id}/similar", summary="Past applications like this one and how they turned out")
def similar_jobs(job_id: str, limit: int = Query(5, ge=1, le=20)):
    return semantic.similar_jobs(_get(JOBS, job_id, "job"), limit)
