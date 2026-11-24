"""
Semantic match (embeddings + pgvector).

A tiny fake model (word counts hashed into a vector) stands in for the real
one, so these tests are fast and need no download. Same words -> similar
vectors, unrelated words -> different vectors, which is all the logic needs.

The pgvector test runs only when TEST_DATABASE_URL is set and the pgvector
extension is installed.
"""
import dataclasses
import hashlib
import math
import os
import re

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.semantic_match.dependent import semantic_service as semantic
from backend.semantic_match.independent.embedder import chunks, cosine, fit_score
from backend.semantic_match.independent.vector_index import MemoryVectorIndex, PgVectorIndex
from backend.storage.independent.json_store import JsonStore

DIMS = 64

DEV = ("Junior Python Developer at Northwind Apps, Ottawa ON. Build web apps with Python, Flask, "
       "React and PostgreSQL. Write unit tests, use Git, work in an Agile team.")
DEV_REWORDED = ("Junior Python Developer at Northwind Apps, Ottawa ON. We build web apps with Python, Flask, "
                "React and PostgreSQL. You write unit tests, use Git and work in an Agile team.")
NURSE = ("Registered Nurse at Riverside Hospital, Kingston ON. Patient care, medication, vital signs, "
         "night shifts, CNO registration required.")
DEV_RESUME = ("Sam Lee. Python developer. Skills: Python, Flask, React, PostgreSQL, Git, unit tests, Agile. "
              "Built web apps for a student team.")
NURSE_RESUME = ("Pat Kim. Registered nurse. Patient care, medication administration, vital signs, "
                "night shifts at a hospital. CNO registration.")


class FakeEmbedder:
    def embed(self, text: str):
        v = [0.0] * DIMS
        for word in re.findall(r"[a-z]{4,}", text.lower()):  # skip small words like "we", "and"
            v[int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMS] += 1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]


@pytest.fixture
def fake_model(monkeypatch):
    monkeypatch.setattr(semantic, "settings", dataclasses.replace(semantic.settings, embeddings_enabled=True))
    monkeypatch.setattr(semantic, "_get_embedder", lambda: FakeEmbedder())
    semantic.reset()
    yield
    semantic.reset()


# ---- pure helpers -------------------------------------------------------------
def test_fit_score_and_cosine():
    assert fit_score(0.40) == 0 and fit_score(0.95) == 100
    assert 0 < fit_score(0.70) < 100
    assert cosine([1, 0], [1, 0]) == pytest.approx(1.0)
    assert cosine([1, 0], [0, 1]) == pytest.approx(0.0)
    assert len(chunks("a " * 2000)) > 1 and chunks("") == [""]


def test_memory_index_search_and_exclude(tmp_path):
    index = MemoryVectorIndex(JsonStore(tmp_path / "s.json"), "fake")
    f = FakeEmbedder()
    index.upsert("posting", "dev", f.embed(DEV))
    index.upsert("posting", "nurse", f.embed(NURSE))
    hits = index.search("posting", f.embed(DEV_REWORDED), limit=2)
    assert [h[0] for h in hits] == ["dev", "nurse"] and hits[0][1] > 0.9
    assert [h[0] for h in index.search("posting", f.embed(DEV), exclude=["dev"])] == ["nurse"]
    index.delete("posting", "dev")
    assert index.known_ids("posting") == {"nurse"}


# ---- API flow -------------------------------------------------------------------
def test_semantic_api_flow(fake_model):
    client = TestClient(app)
    dev_resume = client.post("/api/resumes/text", json={"name": "Dev resume", "text": DEV_RESUME}).json()
    nurse_resume = client.post("/api/resumes/text", json={"name": "Nurse resume", "text": NURSE_RESUME}).json()
    dev = client.post("/api/postings/text", json={"text": DEV}).json()
    nurse = client.post("/api/postings/text", json={"text": NURSE}).json()

    # 1. Overall fit next to the skill score
    good = client.post("/api/match", json={"resume_id": dev_resume["id"], "posting_id": dev["id"]}).json()["fit"]
    bad = client.post("/api/match", json={"resume_id": nurse_resume["id"], "posting_id": dev["id"]}).json()["fit"]
    assert good["available"] and good["score"] > bad["score"]

    # 2. Best resume for each posting
    best = client.get(f"/api/postings/{dev['id']}/best-resumes").json()
    assert best["available"] and best["resumes"][0]["resume_id"] == dev_resume["id"]
    best = client.get(f"/api/postings/{nurse['id']}/best-resumes").json()
    assert best["resumes"][0]["resume_id"] == nurse_resume["id"]

    # 3. Apply to the dev job, then the same job shows up again reworded
    tailored = client.post("/api/tailor", json={"resume_id": dev_resume["id"], "posting_id": dev["id"]}).json()
    job = client.post("/api/apply", json={"tailored_id": tailored["id"]}).json()["job"]
    assert job["posting_id"] == dev["id"]
    again = client.post("/api/postings/text", json={"text": DEV_REWORDED}).json()
    dup = client.get(f"/api/postings/{again['id']}/duplicates").json()
    assert dup["already_applied"] is True
    assert dup["duplicates"][0]["posting_id"] == dev["id"]
    assert dup["duplicates"][0]["applications"][0]["job_id"] == job["id"]
    assert client.get(f"/api/postings/{nurse['id']}/duplicates").json()["duplicates"] == []

    # 4. Similar past applications, with their outcome
    client.patch(f"/api/tracker/jobs/{job['id']}", json={"status": "Interview in progress"})
    tailored2 = client.post("/api/tailor", json={"resume_id": dev_resume["id"], "posting_id": again["id"]}).json()
    job2 = client.post("/api/apply", json={"tailored_id": tailored2["id"]}).json()["job"]
    similar = client.get(f"/api/tracker/jobs/{job2['id']}/similar").json()
    assert similar["available"] and similar["jobs"][0]["job_id"] == job["id"]
    assert similar["jobs"][0]["status"] == "Interview in progress"
    assert similar["summary"]["Interview in progress"] >= 1

    # Deleting removes it from the index too
    assert client.delete(f"/api/resumes/{nurse_resume['id']}").status_code == 200
    ids = [r["resume_id"] for r in client.get(f"/api/postings/{nurse['id']}/best-resumes").json()["resumes"]]
    assert nurse_resume["id"] not in ids


def test_turned_off_never_breaks_the_app():
    # conftest sets EMBEDDINGS_ENABLED=false
    semantic.reset()
    client = TestClient(app)
    resume = client.post("/api/resumes/text", json={"text": DEV_RESUME}).json()
    posting = client.post("/api/postings/text", json={"text": DEV}).json()
    m = client.post("/api/match", json={"resume_id": resume["id"], "posting_id": posting["id"]}).json()
    assert m["fit"]["available"] is False and "score" in m  # skill score still there
    assert client.get(f"/api/postings/{posting['id']}/best-resumes").json()["available"] is False
    assert client.get("/api/semantic/status").json()["available"] is False


# ---- pgvector -----------------------------------------------------------------
def test_pgvector_index():
    url = os.getenv("TEST_DATABASE_URL", "").strip()
    if not url:
        pytest.skip("TEST_DATABASE_URL not set")
    from backend.storage.independent.postgres_store import PostgresStore
    from scripts.setup_postgres import create_database_if_missing

    create_database_if_missing(url)
    store = PostgresStore(url)
    try:
        if not PgVectorIndex.available(store.pool):
            pytest.skip("pgvector extension not installed")
        index = PgVectorIndex(store.pool, "fake-test", DIMS)
        for kind, ref in (("posting", "dev"), ("posting", "nurse"), ("resume", "dev")):
            index.delete(kind, ref)
        f = FakeEmbedder()
        index.upsert("posting", "dev", f.embed(DEV))
        index.upsert("posting", "nurse", f.embed(NURSE))
        index.upsert("resume", "dev", f.embed(DEV_RESUME))
        hits = index.search("posting", f.embed(DEV_REWORDED), limit=5)
        assert [h[0] for h in hits] == ["dev", "nurse"]
        assert hits[0][1] == pytest.approx(cosine(f.embed(DEV), f.embed(DEV_REWORDED)), abs=1e-4)
        assert [h[0] for h in index.search("posting", f.embed(DEV), exclude=["dev"])] == ["nurse"]
        assert index.get("posting", "dev") == pytest.approx(f.embed(DEV), abs=1e-6)
        assert index.known_ids("resume") == {"dev"}
        index.upsert("posting", "dev", f.embed(NURSE))  # update in place
        assert index.search("posting", f.embed(NURSE), limit=1)[0][1] == pytest.approx(1.0, abs=1e-4)
    finally:
        store.close()
