"""
Same behaviour checks for both data stores (C5).

The PostgreSQL run needs a throwaway database, set in TEST_DATABASE_URL, e.g.
    $env:TEST_DATABASE_URL = "postgresql://postgres:PASSWORD@localhost:5432/irish_test"
It is created if missing and its tables are emptied. Without it, only the
JSON store is tested.
"""
import os

import pytest

from backend.storage.independent.json_store import JsonStore

TEST_DB = os.getenv("TEST_DATABASE_URL", "").strip()


def _postgres_store():
    if not TEST_DB:
        pytest.skip("TEST_DATABASE_URL not set - PostgreSQL store not tested")
    from scripts.setup_postgres import create_database_if_missing
    from backend.storage.independent.postgres_store import PostgresStore

    create_database_if_missing(TEST_DB)
    store = PostgresStore(TEST_DB)
    for table in ("resumes", "tracked_jobs", "_singletons"):
        store.clear(table)
    return store


@pytest.fixture(params=["json", "postgres"])
def store(request, tmp_path):
    if request.param == "json":
        yield JsonStore(tmp_path / "store.json")
    else:
        s = _postgres_store()
        yield s
        s.close()


def test_insert_get_and_defaults(store):
    row = store.insert("resumes", {"name": "Dev resume", "skills": ["python", "sql"]})
    assert row["id"] and row["created_at"] and row["updated_at"]
    got = store.get("resumes", row["id"])
    assert got == row
    assert store.get("resumes", "missing") is None


def test_update_keeps_id_and_created_at(store):
    row = store.insert("resumes", {"name": "A"})
    updated = store.update("resumes", row["id"], {"name": "B", "id": "hack", "created_at": "x"})
    assert updated["name"] == "B"
    assert updated["id"] == row["id"]
    assert updated["created_at"] == row["created_at"]
    assert store.update("resumes", "missing", {"name": "C"}) is None


def test_all_order_filter_delete_clear(store):
    a = store.insert("tracked_jobs", {"company": "A", "status": "Applied", "created_at": "2026-01-01T00:00:00+00:00"})
    b = store.insert("tracked_jobs", {"company": "B", "status": "Interview", "created_at": "2026-02-01T00:00:00+00:00"})
    assert [r["company"] for r in store.all("tracked_jobs")] == ["B", "A"]
    assert [r["company"] for r in store.all("tracked_jobs", newest_first=False)] == ["A", "B"]
    assert [r["id"] for r in store.all("tracked_jobs", where=lambda r: r["status"] == "Applied")] == [a["id"]]
    assert store.delete("tracked_jobs", b["id"]) is True
    assert store.delete("tracked_jobs", b["id"]) is False
    assert store.clear("tracked_jobs") == 1
    assert store.all("tracked_jobs") == []


def test_singletons(store):
    assert store.get_singleton("profile") is None
    store.set_singleton("profile", {"name": "Sam"})
    store.set_singleton("profile", {"email": "sam@example.com"})
    assert store.get_singleton("profile")["name"] == "Sam"
    assert store.get_singleton("profile")["email"] == "sam@example.com"
