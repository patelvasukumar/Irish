"""Applications in progress (Tailor tab): resume popup options, steps, submit -> tracker."""
from pathlib import Path

from fastapi.testclient import TestClient

from backend.applications.independent.application_rules import (
    current_step,
    progress_percent,
    recent_upload_entries,
    resets_for,
    submitted_resume_entries,
)
from backend.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
RESUME = (ROOT / "data" / "resumes" / "sample_resume.txt").read_text(encoding="utf-8")
POSTING = (ROOT / "data" / "postings" / "sample_posting.txt").read_text(encoding="utf-8")


def _upload(name="resume.txt"):
    r = client.post("/api/resumes/upload", files={"file": (name, RESUME.encode(), "text/plain")})
    assert r.status_code == 200, r.text
    return r.json()


def _posting():
    r = client.post("/api/postings/text", json={"text": POSTING})
    assert r.status_code == 200, r.text
    return r.json()


# ---- pure rules -------------------------------------------------------------
def test_steps_and_progress():
    app = {"status": "in_progress"}
    assert current_step(app) == 1 and progress_percent(app) == 0
    app.update(resume_source="upload", resume_id="r1")
    assert current_step(app) == 2
    app["posting_id"] = "p1"
    assert current_step(app) == 3
    app["match_score"] = 70
    assert current_step(app) == 4 and progress_percent(app) == 60
    app["tailored_id"] = "t1"
    assert current_step(app) == 5 and progress_percent(app) == 80
    app["portal_opened_at"] = "2026-11-24T10:00:00+00:00"
    assert progress_percent(app) == 90


def test_new_resume_or_posting_resets_later_steps():
    app = {"resume_id": "r1", "resume_source": "upload", "posting_id": "p1", "match_score": 70,
           "tailored_id": "t1", "portal_opened_at": "x"}
    assert resets_for(app, {"resume_id": "r2", "resume_source": "upload"}) == {
        "match_score": None, "tailored_id": None, "portal_opened_at": None}
    assert resets_for(app, {"posting_id": "p2"})["tailored_id"] is None
    assert resets_for(app, {"tailored_id": "t2"}) == {"portal_opened_at": None}
    assert resets_for(app, {"match_score": 80}) == {}
    # a value sent in the same request is kept
    assert "match_score" not in resets_for(app, {"posting_id": "p2", "match_score": 50})


def test_popup_lists_follow_tracker_order_and_hide_used_uploads():
    jobs = [{"id": "j2", "resume_id": "t2", "title": "B"}, {"id": "j1", "resume_id": "t1", "title": "A"},
            {"id": "j0", "resume_id": None, "title": "by hand"}]
    tailored = {"t1": {"id": "t1", "resume_id": "r1", "score": 60}, "t2": {"id": "t2", "resume_id": "r1", "score": 80}}
    entries = submitted_resume_entries(jobs, tailored)
    assert [e["job_id"] for e in entries] == ["j2", "j1"] and entries[0]["score"] == 80
    resumes = [{"id": "r2", "text": "x"}, {"id": "r1"}, {"id": "r3", "source": "tailored"}]
    assert [r["id"] for r in recent_upload_entries(resumes, {"r1"})] == ["r2"]
    assert "text" not in recent_upload_entries(resumes, set())[0]


# ---- API flow ---------------------------------------------------------------
def test_application_full_flow_to_tracker():
    resume = _upload("my_resume.txt")
    posting = _posting()

    r = client.post("/api/applications", json={})
    assert r.status_code == 200, r.text
    app_id = r.json()["id"]
    assert r.json()["step"] == 1 and r.json()["step_label"] == "Choose a resume"
    assert any(a["id"] == app_id for a in client.get("/api/applications").json())

    r = client.patch(f"/api/applications/{app_id}", json={"resume_id": resume["id"], "resume_source": "upload"})
    assert r.json()["resume_name"] == "my_resume.txt" and r.json()["step"] == 2

    r = client.patch(f"/api/applications/{app_id}", json={"posting_id": posting["id"]})
    assert r.json()["company"] == "Maple Software" and r.json()["city"] == "Ottawa" and r.json()["step"] == 3

    m = client.post("/api/match", json={"resume_id": resume["id"], "posting_id": posting["id"]}).json()
    r = client.patch(f"/api/applications/{app_id}", json={"match_score": m["score"]})
    assert r.json()["step"] == 4

    t = client.post("/api/tailor", json={"resume_id": resume["id"], "posting_id": posting["id"]}).json()
    r = client.patch(f"/api/applications/{app_id}", json={"tailored_id": t["id"]})
    assert r.json()["step"] == 5 and r.json()["waiting_to_submit"] is False

    # continue where I left off
    detail = client.get(f"/api/applications/{app_id}").json()
    assert detail["resume"]["id"] == resume["id"] and "text" not in detail["resume"]
    assert detail["posting"]["id"] == posting["id"] and detail["tailored"]["text"]

    # submitting before "open portal" is allowed, but the normal path opens the portal first
    r = client.post(f"/api/applications/{app_id}/open-portal", json={})
    assert r.status_code == 200 and r.json()["application"]["waiting_to_submit"] is True
    assert r.json()["application"]["step_label"] == "Waiting to submit"
    # still in progress until marked submitted
    assert any(a["id"] == app_id for a in client.get("/api/applications").json())

    r = client.post(f"/api/applications/{app_id}/submit")
    assert r.status_code == 200, r.text
    job = r.json()["job"]
    assert job["status"] == "Applied" and job["resume_id"] == t["id"] and job["company"] == "Maple Software"
    assert all(a["id"] != app_id for a in client.get("/api/applications").json())
    assert client.post(f"/api/applications/{app_id}/submit").status_code == 409
    assert client.patch(f"/api/applications/{app_id}", json={"match_score": 10}).status_code == 409

    # the popup now offers this resume first (newest on top, like the tracker)
    options = client.get("/api/applications/resume-options").json()
    assert options["submitted"][0]["job_id"] == job["id"]
    assert options["submitted"][0]["tailored_id"] == t["id"]
    assert all(u["id"] != resume["id"] for u in options["uploads"])  # used in a submitted application

    # reuse it as the starting resume of a new application (only one copy is made)
    reused = client.post("/api/resumes/from-tailored", json={"tailored_id": t["id"]}).json()
    again = client.post("/api/resumes/from-tailored", json={"tailored_id": t["id"]}).json()
    assert reused["id"] == again["id"] and reused["source"] == "tailored"
    assert reused["name"] == f"{posting['title']} · Maple Software"
    r = client.post("/api/applications", json={"resume_id": reused["id"], "resume_source": "submitted"})
    assert r.status_code == 200 and r.json()["step"] == 2
    options = client.get("/api/applications/resume-options").json()
    assert all(u["id"] != reused["id"] for u in options["uploads"])  # tailored copies are not "uploads"
    client.delete(f"/api/applications/{r.json()['id']}")


def test_changing_the_resume_clears_the_later_steps():
    resume = _upload()
    other = _upload("other.txt")
    posting = _posting()
    t = client.post("/api/tailor", json={"resume_id": resume["id"], "posting_id": posting["id"]}).json()
    app = client.post("/api/applications", json={
        "resume_id": resume["id"], "resume_source": "upload", "posting_id": posting["id"], "match_score": 60,
    }).json()
    app = client.patch(f"/api/applications/{app['id']}", json={"tailored_id": t["id"]}).json()
    assert app["step"] == 5

    app = client.patch(f"/api/applications/{app['id']}", json={"resume_id": other["id"], "resume_source": "upload"}).json()
    assert app["tailored_id"] is None and app["match_score"] is None and app["step"] == 3
    assert app["posting_id"] == posting["id"]
    client.delete(f"/api/applications/{app['id']}")


def test_application_rules_are_checked():
    posting = _posting()
    other_posting = _posting()
    resume = _upload()
    app = client.post("/api/applications", json={"posting_id": posting["id"]}).json()
    assert app["step"] == 1 and app["title"] == posting["title"]  # posting first, resume later is fine

    assert client.patch(f"/api/applications/{app['id']}", json={"resume_source": "upload"}).status_code == 400
    assert client.patch(f"/api/applications/{app['id']}", json={"resume_id": "nope", "resume_source": "upload"}).status_code == 404
    assert client.patch(f"/api/applications/{app['id']}", json={"match_score": 101}).status_code == 422
    assert client.post(f"/api/applications/{app['id']}/submit").status_code == 400  # no tailored resume yet

    t_other = client.post("/api/tailor", json={"resume_id": resume["id"], "posting_id": other_posting["id"]}).json()
    r = client.patch(f"/api/applications/{app['id']}", json={"tailored_id": t_other["id"]})
    assert r.status_code == 400  # written for a different posting

    # a login without permission cannot be used to apply
    t = client.post("/api/tailor", json={"resume_id": resume["id"], "posting_id": posting["id"]}).json()
    client.patch(f"/api/applications/{app['id']}", json={"resume_id": resume["id"], "resume_source": "upload"})
    client.patch(f"/api/applications/{app['id']}", json={"match_score": 50, "tailored_id": t["id"]})
    cred = client.post("/api/credentials", json={
        "company": "Maple", "site_url": "https://maple.wd3.myworkday.com/", "username": "me@example.com",
        "password": "pw"}).json()
    assert client.post(f"/api/applications/{app['id']}/open-portal", json={"credential_id": cred["id"]}).status_code == 403

    assert client.delete(f"/api/applications/{app['id']}").status_code == 200
    assert client.get(f"/api/applications/{app['id']}").status_code == 404
    assert client.delete(f"/api/applications/{app['id']}").status_code == 404


def test_profile_resume_needs_a_saved_profile():
    client.put("/api/profile", json={"full_name": ""})
    app = client.post("/api/applications", json={}).json()
    assert client.patch(f"/api/applications/{app['id']}", json={"resume_source": "profile"}).status_code == 400
    assert client.get("/api/applications/resume-options").json()["profile"]["saved"] is False

    client.put("/api/profile", json={"full_name": "Sam Lee", "skills": ["Python"]})
    r = client.patch(f"/api/applications/{app['id']}", json={"resume_source": "profile"})
    assert r.status_code == 200 and r.json()["resume_name"] == "My profile" and r.json()["resume_id"] is None
    assert client.get("/api/applications/resume-options").json()["profile"]["saved"] is True
    client.delete(f"/api/applications/{app['id']}")
