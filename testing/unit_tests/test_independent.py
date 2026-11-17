"""Unit tests for the independent (pure) modules."""
from backend.graph_rag.independent.skill_graph import SkillGraph, to_cypher
from backend.job_tracker.independent.email_classifier import (
    JobStatus,
    classify_email,
    guess_company_from_sender,
    should_auto_update,
)
from backend.job_tracker.independent.filters import filter_jobs, filter_options
from backend.text_recognition.independent.skill_extractor import (
    analyse_document,
    compare_skills,
    extract_location,
    extract_skills,
)


def test_extract_skills_basic():
    skills = extract_skills("Built REST APIs in Python and React.js with PostgreSQL and Docker.")
    for s in ["Python", "React", "PostgreSQL", "Docker", "REST API"]:
        assert s in skills


def test_no_false_positive_common_words():
    skills = extract_skills("I will go to the store and rest. Please express your interest.")
    assert "Go" not in skills and "REST API" not in skills and "Express" not in skills


def test_compare_skills_score():
    result = compare_skills(["Python", "SQL"], ["Python", "SQL", "Docker", "AWS"])
    assert result["matched"] == ["Python", "SQL"]
    assert result["missing"] == ["Docker", "AWS"]
    assert result["score"] == 50


def test_location_and_title():
    posting = analyse_document("Job Title: Data Analyst\nCompany: Acme\nLocation: Ottawa, ON\nSQL Excel", "posting")
    assert posting["title"] == "Data Analyst"
    assert posting["company"] == "Acme"
    assert posting["location"] == {"city": "Ottawa", "province": "Ontario"}
    assert extract_location("Remote - Vancouver, BC")["province"] == "British Columbia"


def test_graph_related_for_gap():
    g = SkillGraph()
    related = g.related_skills_for_gap(["JavaScript"], ["TypeScript"])
    assert related and related[0]["related_skill_you_have"] == "JavaScript"
    assert g.skills_for_title("Junior Data Analyst")["title"] == "Data Analyst"
    assert "MERGE" in to_cypher()


def test_email_classifier():
    assert classify_email("Interview invitation - Developer", "Shopify Careers <jobs@shopify.com>")["status"] == JobStatus.INTERVIEW
    assert classify_email("Your application", "talent@acme.com", "Unfortunately we will not be moving forward")["status"] == JobStatus.REJECTED
    assert classify_email("Thank you for applying!", "no-reply@myworkday.com")["status"] == JobStatus.APPLIED
    assert classify_email("Pizza deal", "promo@pizza.com", "Unfortunately the deal ended")["is_job"] is False
    assert guess_company_from_sender("Shopify Careers <no-reply@shopify.com>") == "Shopify"
    assert should_auto_update("Applied", JobStatus.INTERVIEW)
    assert not should_auto_update("Interview in progress", JobStatus.APPLIED)


def test_filters_only_show_existing_values():
    jobs = [
        {"company": "A", "city": "Ottawa", "province": "Ontario", "status": "Applied", "created_at": "2026-01-02T00:00:00+00:00"},
        {"company": "B", "city": "Toronto", "province": "Ontario", "status": "Rejected", "created_at": "2026-01-03T00:00:00+00:00"},
    ]
    assert filter_options(jobs)["cities"] == ["Ottawa", "Toronto"]
    assert [j["company"] for j in filter_jobs(jobs)] == ["B", "A"]  # newest first
    assert len(filter_jobs(jobs, city="ottawa")) == 1
