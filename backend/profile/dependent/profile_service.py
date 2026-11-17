"""Profile form - one user, no login (first stage)."""
from __future__ import annotations

from backend.storage.dependent.store import get_store
from backend.text_generation.independent.prompts import profile_to_resume_text

PROFILE_KEY = "profile"


def get_profile() -> dict:
    return get_store().get_singleton(PROFILE_KEY) or {}


def save_profile(data: dict) -> dict:
    return get_store().set_singleton(PROFILE_KEY, data)


def profile_resume_text() -> str:
    profile = get_profile()
    if not profile.get("full_name"):
        raise ValueError("The profile is empty. Fill in the profile form or upload a resume.")
    return profile_to_resume_text(profile)
