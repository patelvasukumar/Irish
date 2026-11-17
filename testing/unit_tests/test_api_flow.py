"""End-to-end API flow (demo script steps 2, 4, 5, 6, 7) with the offline stub LLM."""
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
RESUME = (ROOT / "data" / "resumes" / "sample_resume.txt").read_text(encoding="utf-8")
POSTING = (ROOT / "data" / "postings" / "sample_posting.txt").read_text(encoding="utf-8")


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["llm"]["provider"] == "stub"


def test_full_flow():
    # upload resume (file) + posting (text)
    r = client.post("/api/resumes/upload", files={"file": ("resume.txt", RESUME.encode(), "text/plain")})
    assert r.status_code == 200, r.text
    resume_id = r.json()["id"]
    assert "Python" in r.json()["analysis"]["skills"]

    r = client.post("/api/postings/text", json={"text": POSTING})
    assert r.status_code == 200
    posting = r.json()
    assert posting["company"] == "Maple Software" and posting["city"] == "Ottawa"

    # match (C1 + C4)
    r = client.post("/api/match", json={"resume_id": resume_id, "posting_id": posting["id"]})
    m = r.json()
    assert "React" in m["matched"] and "TypeScript" in m["missing"]
    assert any(x["missing"] == "TypeScript" for x in m["related"])

    # tailor (C2) + save in history
    r = client.post("/api/tailor", json={"resume_id": resume_id, "posting_id": posting["id"]})
    assert r.status_code == 200, r.text
    tailored_id = r.json()["id"]
    text = r.json()["tailored_resume"]
    assert text.startswith("# Alex Martin\nalex.martin@example.com")
    assert text.count("## Skills") == 1 and text.count("## Summary") == 1
    assert "Maple Software" in text and "## Experience" in text
    for fmt in ("txt", "docx", "pdf"):
        r = client.post(f"/api/tailored/{tailored_id}/save", json={"format": fmt})
        assert r.status_code == 200, r.text
        assert client.get(r.json()["download_url"]).status_code == 200
    assert len(client.get("/api/history").json()) == 3

    # apply -> tracker (C7)
    r = client.post("/api/apply", json={"tailored_id": tailored_id})
    job = r.json()["job"]
    assert job["status"] == "Applied"

    r = client.post("/api/tracker/emails", json={
        "subject": "Interview invitation", "sender": "Maple Software Careers <jobs@maplesoftware.ca>"})
    assert r.json()["status_changed"] is True
    detail = client.get(f"/api/tracker/jobs/{job['id']}").json()
    assert detail["status"] == "Interview in progress" and len(detail["emails"]) == 1

    listing = client.get("/api/tracker/jobs", params={"city": "Ottawa"}).json()
    assert listing["filters"]["cities"] == ["Ottawa"]

    r = client.patch(f"/api/tracker/jobs/{job['id']}", json={"status": "Successful", "notes": "Start in May"})
    assert r.json()["prompt_success_options"] == ["delete_history", "save_zip", "stop_tracker"]
    assert client.get("/api/tracker/export").headers["content-type"] == "application/zip"
    assert client.post("/api/tracker/success-action", json={"action": "delete_history"}).status_code == 409

    # history delete
    assert client.delete("/api/history", params={"target": "all"}).status_code == 200
    assert client.get("/api/history").json() == []


def test_credentials_never_return_password():
    r = client.post("/api/credentials", json={
        "company": "Test Co", "site_url": "https://test.wd3.myworkday.com/", "username": "me@example.com",
        "password": "s3cret!"})
    body = r.json()
    assert r.status_code == 200 and "s3cret" not in str(body)
    assert body["permission_to_apply"] is False
    r = client.patch(f"/api/credentials/{body['id']}", json={"permission_to_apply": True})
    assert r.json()["permission_to_apply"] is True
    assert "s3cret" not in client.get("/api/credentials").text


def test_profile_used_when_no_resume():
    client.put("/api/profile", json={"full_name": "Sam Lee", "skills": ["Python", "SQL"], "city": "Ottawa"})
    posting = client.post("/api/postings/text", json={"text": POSTING}).json()
    r = client.post("/api/tailor", json={"posting_id": posting["id"]})
    assert r.status_code == 200 and "Sam Lee" in r.json()["tailored_resume"]


def test_posting_link_blocks_local_addresses():
    r = client.post("/api/postings/link", json={"url": "http://127.0.0.1:8000/docs"})
    assert r.status_code == 422
