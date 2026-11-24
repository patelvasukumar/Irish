"""
The one shared store instance used by every backend component.

- DATABASE_URL set in .env  -> PostgreSQL (C5), see database/postgres_schema.sql
- DATABASE_URL empty        -> local JSON file (data/irish_store.json)

Both stores have the same methods, so the rest of the code does not care
which one is used.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import TYPE_CHECKING, Union

from backend.storage.independent.json_store import JsonStore
from configuration.settings import settings

log = logging.getLogger(__name__)

# Collection names (= PostgreSQL table names)
RESUMES = "resumes"
POSTINGS = "job_postings"
TAILORED = "tailored_resumes"
JOBS = "tracked_jobs"
EMAILS = "job_emails"
CREDENTIALS = "credentials"

if TYPE_CHECKING:  # avoid importing psycopg when it is not installed
    from backend.storage.independent.postgres_store import PostgresStore

Store = Union[JsonStore, "PostgresStore"]


@lru_cache(maxsize=1)
def get_store() -> Store:
    if settings.database_url:
        from backend.storage.independent.postgres_store import PostgresStore

        log.info("Data store: PostgreSQL")
        return PostgresStore(settings.database_url)
    log.info("Data store: local JSON file %s", settings.local_store_file)
    return JsonStore(settings.local_store_file)

