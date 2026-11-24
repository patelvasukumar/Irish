"""
Semantic match - compares resumes, postings and tracked jobs by meaning.

  fit_for()        "Overall fit: 82 %" next to the skill score       (Tailor)
  best_resumes()   which saved resume fits this posting best          (Tailor)
  duplicates()     the same posting saved before / already applied    (Tailor)
  similar_jobs()   past applications like this one and how they went  (Tracker)

Vectors are stored with pgvector when the PostgreSQL store has it, and in
the normal store otherwise. Nothing here may break the main flow: if the
model cannot load, every function reports `available: False` instead.
"""
from __future__ import annotations

import logging
import threading
from backend.semantic_match.independent.embedder import (
    DUPLICATE_SIMILARITY,
    Embedder,
    EmbeddingUnavailable,
    Vector,
    cosine,
    fit_score,
)
from backend.semantic_match.independent.vector_index import MemoryVectorIndex, PgVectorIndex, VectorIndex
from backend.storage.dependent.store import JOBS, POSTINGS, RESUMES, TAILORED, get_store
from backend.text_recognition.independent.skill_extractor import compare_skills
from configuration.settings import settings

log = logging.getLogger(__name__)

RESUME, POSTING = "resume", "posting"
_COLLECTION = {RESUME: RESUMES, POSTING: POSTINGS}

_lock = threading.Lock()
_embedder: Embedder | None = None
_index: VectorIndex | None = None


class SemanticUnavailable(RuntimeError):
    pass


# ---- setup ------------------------------------------------------------------
def _get_embedder() -> Embedder:
    global _embedder
    if not settings.embeddings_enabled:
        raise SemanticUnavailable("Semantic match is turned off (EMBEDDINGS_ENABLED=false).")
    with _lock:
        if _embedder is None:
            _embedder = Embedder(settings.embedding_model, settings.embedding_cache_dir)
        return _embedder


def _embed(text: str) -> Vector:
    try:
        return _get_embedder().embed(text)
    except EmbeddingUnavailable as exc:
        raise SemanticUnavailable(str(exc)) from exc


def _get_index() -> VectorIndex:
    global _index
    with _lock:
        if _index is not None:
            return _index
    store = get_store()
    index: VectorIndex
    pool = getattr(store, "pool", None)  # only the PostgreSQL store has one
    if pool is not None and PgVectorIndex.available(pool):
        dims = len(_embed("dimension check"))
        index = PgVectorIndex(pool, settings.embedding_model, dims)
    else:
        index = MemoryVectorIndex(store, settings.embedding_model)
    log.info("Semantic match index: %s", index.backend_name)
    with _lock:
        _index = _index or index
        return _index


def reset() -> None:
    """Forget the cached model/index (used by tests)."""
    global _embedder, _index
    with _lock:
        _embedder, _index = None, None


def status() -> dict:
    if not settings.embeddings_enabled:
        return {"available": False, "reason": "turned off (EMBEDDINGS_ENABLED=false)"}
    try:
        index = _get_index()
    except SemanticUnavailable as exc:
        return {"available": False, "reason": str(exc)}
    return {"available": True, "model": settings.embedding_model, "index": index.backend_name}


# ---- keeping vectors up to date ------------------------------------------------
def index_row(kind: str, row: dict) -> None:
    """Embed a newly saved resume/posting. Never raises."""
    if not settings.embeddings_enabled or not row.get("text"):
        return
    try:
        _get_index().upsert(kind, row["id"], _embed(row["text"]))
    except Exception as exc:  # noqa: BLE001 - the save itself already succeeded
        log.warning("Could not index %s %s: %s", kind, row.get("id"), exc)


def remove_row(kind: str, row_id: str) -> None:
    if not settings.embeddings_enabled:
        return
    try:
        _get_index().delete(kind, row_id)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not remove %s %s from index: %s", kind, row_id, exc)


def _vector(kind: str, row: dict) -> Vector:
    index = _get_index()
    vec = index.get(kind, row["id"])
    if vec is None:
        vec = _embed(row.get("text") or "")
        index.upsert(kind, row["id"], vec)
    return vec


def _backfill(kind: str) -> None:
    """Embed rows saved before semantic match existed (or while it was off)."""
    index = _get_index()
    known = index.known_ids(kind)
    for row in get_store().all(_COLLECTION[kind]):
        if row["id"] not in known and row.get("text"):
            index.upsert(kind, row["id"], _embed(row["text"]))


def _posting_id_for_job(job: dict) -> str | None:
    if job.get("posting_id"):
        return job["posting_id"]
    tailored = get_store().get(TAILORED, job["resume_id"]) if job.get("resume_id") else None
    return (tailored or {}).get("posting_id")


def _job_vector(job: dict) -> Vector:
    posting_id = _posting_id_for_job(job)
    posting = get_store().get(POSTINGS, posting_id) if posting_id else None
    if posting and posting.get("text"):
        return _vector(POSTING, posting)
    # Job added by hand without a posting: use what we know about it.
    return _embed(" ".join(filter(None, [job.get("title"), "at", job.get("company"), job.get("notes")])))


# ---- features -------------------------------------------------------------------
def _unavailable(exc: Exception) -> dict:
    return {"available": False, "reason": str(exc)}


def fit_for(posting: dict, resume_text: str, resume: dict | None = None) -> dict:
    """Overall fit of a resume (saved one or profile text) for a posting."""
    try:
        p_vec = _vector(POSTING, posting)
        r_vec = _vector(RESUME, resume) if resume else _embed(resume_text)
    except SemanticUnavailable as exc:
        return _unavailable(exc)
    similarity = cosine(r_vec, p_vec)
    return {"available": True, "score": fit_score(similarity), "similarity": round(similarity, 4)}


def best_resumes(posting: dict, limit: int = 3) -> dict:
    try:
        _backfill(RESUME)
        hits = _get_index().search(RESUME, _vector(POSTING, posting), limit=limit)
    except SemanticUnavailable as exc:
        return _unavailable(exc)
    store, out = get_store(), []
    posting_skills = posting.get("analysis", {}).get("skills", [])
    for resume_id, similarity in hits:
        resume = store.get(RESUMES, resume_id)
        if not resume:
            continue
        skills = compare_skills(resume.get("analysis", {}).get("skills", []), posting_skills)
        out.append({
            "resume_id": resume_id, "name": resume.get("name"), "created_at": resume.get("created_at"),
            "fit": fit_score(similarity), "similarity": round(similarity, 4), "skill_score": skills["score"],
        })
    return {"available": True, "resumes": out}


def duplicates(posting: dict) -> dict:
    """Postings saved before that are the same job (reworded or from another site)."""
    try:
        _backfill(POSTING)
        hits = _get_index().search(POSTING, _vector(POSTING, posting), limit=10, exclude=[posting["id"]])
    except SemanticUnavailable as exc:
        return _unavailable(exc)
    store = get_store()
    dup_ids = {pid: sim for pid, sim in hits if sim >= DUPLICATE_SIMILARITY}
    jobs_by_posting: dict[str, list[dict]] = {}
    for job in store.all(JOBS):
        pid = _posting_id_for_job(job)
        if pid in dup_ids or pid == posting["id"]:
            jobs_by_posting.setdefault(pid, []).append(
                {"job_id": job["id"], "status": job.get("status"), "applied_at": job.get("applied_at")}
            )
    out = []
    for pid, similarity in dup_ids.items():
        other = store.get(POSTINGS, pid)
        if other:
            out.append({
                "posting_id": pid, "title": other.get("title"), "company": other.get("company"),
                "created_at": other.get("created_at"), "similarity": round(similarity, 4),
                "applications": jobs_by_posting.get(pid, []),
            })
    return {"available": True, "duplicates": out,
            "already_applied": bool(jobs_by_posting.get(posting["id"])) or any(d["applications"] for d in out)}


def similar_jobs(job: dict, limit: int = 5, min_fit: int = 40) -> dict:
    """Past applications that look like this one, with how they turned out."""
    try:
        target = _job_vector(job)
        scored: list[tuple[dict, float]] = []
        for other in get_store().all(JOBS):
            if other["id"] != job["id"]:
                scored.append((other, cosine(target, _job_vector(other))))
    except SemanticUnavailable as exc:
        return _unavailable(exc)
    scored.sort(key=lambda x: x[1], reverse=True)
    out = [{
        "job_id": o["id"], "title": o.get("title"), "company": o.get("company"),
        "status": o.get("status"), "applied_at": o.get("applied_at"),
        "fit": fit_score(sim), "similarity": round(sim, 4),
    } for o, sim in scored if fit_score(sim) >= min_fit][:limit]
    summary: dict[str, int] = {}
    for j in out:
        summary[j["status"]] = summary.get(j["status"], 0) + 1
    return {"available": True, "jobs": out, "summary": summary}

