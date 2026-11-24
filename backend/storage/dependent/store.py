"""
The one shared store instance used by every backend component.

When the PostgreSQL database is set up, replace `get_store()` with a
repository that talks to PostgreSQL; the rest of the code stays the same.
"""
from __future__ import annotations

from functools import lru_cache

from backend.storage.independent.json_store import JsonStore
from configuration.settings import settings

# Collection names (future table names)
RESUMES = "resumes"
POSTINGS = "job_postings"
TAILORED = "tailored_resumes"
JOBS = "tracked_jobs"
EMAILS = "job_emails"
CREDENTIALS = "credentials"
APPLICATIONS = "applications"  # in-progress applications (Tailor tab)


@lru_cache(maxsize=1)
def get_store() -> JsonStore:
    return JsonStore(settings.local_store_file)
