"""Request / response models for the Irish API (no imports from other app files)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

StatusLiteral = Literal["Applied", "Interview in progress", "Rejected", "Successful"]


# ---- Resumes / postings -----------------------------------------------
class ResumeText(BaseModel):
    name: str = Field("Pasted resume", max_length=200)
    text: str = Field(..., min_length=30, max_length=60_000)


class PostingLink(BaseModel):
    url: HttpUrl


class PostingText(BaseModel):
    text: str = Field(..., min_length=30, max_length=60_000)
    url: str | None = None


class MatchRequest(BaseModel):
    resume_id: str | None = Field(None, description="Leave empty to use the profile form")
    posting_id: str


class TailorRequest(MatchRequest):
    instructions: str = Field("", max_length=2000)
    provider: Literal["ollama", "groq", "gemini", "stub"] | None = None


class TailoredEdit(BaseModel):
    text: str = Field(..., min_length=10, max_length=60_000)


class SaveRequest(BaseModel):
    format: Literal["docx", "pdf", "txt"] = "pdf"
    file_name: str | None = Field(None, max_length=120)
    company: str | None = Field(None, max_length=120)


class ApplyRequest(BaseModel):
    tailored_id: str
    credential_id: str | None = None


# ---- Tracker --------------------------------------------------------------
class JobCreate(BaseModel):
    title: str = Field(..., max_length=200)
    company: str = Field(..., max_length=200)
    city: str | None = None
    province: str | None = None
    url: str | None = None
    status: StatusLiteral = "Applied"
    notes: str = ""
    resume_id: str | None = None


class JobUpdate(BaseModel):
    title: str | None = None
    company: str | None = None
    city: str | None = None
    province: str | None = None
    url: str | None = None
    status: StatusLiteral | None = None
    notes: str | None = None


class EmailIn(BaseModel):
    subject: str = Field(..., max_length=500)
    sender: str = Field(..., max_length=300)
    snippet: str = Field("", max_length=2000)
    received_at: str | None = None
    link: str | None = None


class SuccessAction(BaseModel):
    action: Literal["delete_history", "save_zip", "stop_tracker"]
    confirm: bool = False


class TrackerToggle(BaseModel):
    enabled: bool


class RelinkEmail(BaseModel):
    job_id: str


# ---- Credentials ---------------------------------------------------------
class CredentialCreate(BaseModel):
    company: str = Field(..., min_length=1, max_length=200)
    site_url: HttpUrl
    username: str = Field(..., min_length=1, max_length=300)
    password: str = Field(..., min_length=1, max_length=500)
    permission_to_apply: bool = False


class CredentialUpdate(BaseModel):
    company: str | None = None
    site_url: HttpUrl | None = None
    username: str | None = None
    password: str | None = None
    permission_to_apply: bool | None = None


# ---- Profile ------------------------------------------------------------
class Experience(BaseModel):
    title: str = ""
    company: str = ""
    location: str | None = None
    start: str = ""
    end: str | None = None
    bullets: list[str] = []


class Education(BaseModel):
    credential: str = ""
    institution: str = ""
    start: str = ""
    end: str | None = None


class Project(BaseModel):
    name: str = ""
    description: str = ""
    technologies: list[str] = []


class Profile(BaseModel):
    full_name: str = Field("", max_length=200)
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    province: str | None = None
    linkedin: str | None = None
    github: str | None = None
    summary: str = ""
    skills: list[str] = []
    experience: list[Experience] = []
    education: list[Education] = []
    projects: list[Project] = []
    certifications: list[str] = []
