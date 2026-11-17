"""C7 - Tracker list filtering (pure functions)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _parse(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def filter_jobs(
    jobs: list[dict],
    days: int | None = None,
    company: str | None = None,
    city: str | None = None,
    province: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    out = []
    for job in jobs:
        applied = _parse(job.get("applied_at") or job.get("created_at"))
        if since and (applied is None or applied < since):
            continue
        if company and (job.get("company") or "").lower() != company.lower():
            continue
        if city and (job.get("city") or "").lower() != city.lower():
            continue
        if province and (job.get("province") or "").lower() != province.lower():
            continue
        if status and job.get("status") != status:
            continue
        if search and search.lower() not in f"{job.get('title', '')} {job.get('company', '')}".lower():
            continue
        out.append(job)
    out.sort(key=lambda j: j.get("applied_at") or j.get("created_at") or "", reverse=True)
    return out


def filter_options(jobs: list[dict]) -> dict:
    """Only values that exist in the list (Ottawa appears only if a job is in Ottawa)."""
    def distinct(key: str) -> list[str]:
        return sorted({j[key] for j in jobs if j.get(key)})

    return {
        "companies": distinct("company"),
        "cities": distinct("city"),
        "provinces": distinct("province"),
        "statuses": distinct("status"),
    }
