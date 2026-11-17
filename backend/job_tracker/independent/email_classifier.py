"""
C7 - Decide if an email is about a job application and which status it means.

Rule-based first version (fast, private, no data leaves the laptop). It only
needs the subject, sender and a short snippet (risk R9).
"""
from __future__ import annotations

import re
from enum import Enum


class JobStatus(str, Enum):
    APPLIED = "Applied"
    INTERVIEW = "Interview in progress"
    REJECTED = "Rejected"
    SUCCESSFUL = "Successful"


_RULES: list[tuple[JobStatus, list[str]]] = [
    (JobStatus.SUCCESSFUL, [
        r"\boffer letter\b", r"\bpleased to offer\b", r"\bjob offer\b", r"\boffer of employment\b",
        r"\bwelcome (to|aboard)\b", r"\bcongratulations\b.*\b(offer|position|role)\b",
    ]),
    (JobStatus.REJECTED, [
        r"\bunfortunately\b", r"\bnot (be )?mov(e|ing) forward\b", r"\bother candidates\b",
        r"\bnot been selected\b", r"\bnot selected\b", r"\bregret to inform\b",
        r"\bposition has been filled\b", r"\bdecided to pursue\b", r"\bwill not be proceeding\b",
    ]),
    (JobStatus.INTERVIEW, [
        r"\binterview\b", r"\bschedule (a )?(call|time|meeting)\b", r"\bphone screen\b",
        r"\bnext steps?\b", r"\bassessment\b", r"\bcoding challenge\b", r"\bavailability\b",
    ]),
    (JobStatus.APPLIED, [
        r"\bthank you for (applying|your application|your interest)\b", r"\bapplication (has been )?received\b",
        r"\bwe (have )?received your application\b", r"\bapplication submitted\b",
        r"\bsuccessfully applied\b", r"\bapplication confirmation\b",
    ]),
]

_JOB_HINTS = re.compile(
    r"(?i)\b(application|applied|applying|candidate|position|role|recruit|recruiter|hiring|"
    r"interview|offer|talent acquisition|career|job)\b"
)
_ATS_SENDERS = re.compile(
    r"(?i)(workday|myworkday|greenhouse|lever\.co|smartrecruiters|icims|taleo|successfactors|"
    r"jobvite|ashbyhq|bamboohr|indeed|linkedin|workable|recruit|talent|careers?|hr@|jobs@)"
)

# Order matters: a status can only move "forward" automatically.
STATUS_RANK = {JobStatus.APPLIED: 0, JobStatus.INTERVIEW: 1, JobStatus.REJECTED: 2, JobStatus.SUCCESSFUL: 2}


def classify_email(subject: str, sender: str, snippet: str = "") -> dict:
    """Return {'is_job': bool, 'status': JobStatus|None, 'confidence': 0..1, 'reason': str}."""
    text = f"{subject}\n{snippet}"
    sender_hit = bool(_ATS_SENDERS.search(sender or ""))
    hint_hits = len(_JOB_HINTS.findall(text))
    for status, patterns in _RULES:
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                # "Unfortunately" alone in a non-job email is not a rejection.
                if not (sender_hit or hint_hits):
                    continue
                confidence = min(1.0, 0.55 + 0.2 * sender_hit + 0.05 * hint_hits)
                return {"is_job": True, "status": status, "confidence": round(confidence, 2),
                        "reason": f"matched '{pattern}'"}
    if sender_hit and hint_hits:
        return {"is_job": True, "status": None, "confidence": 0.5, "reason": "job sender, no clear status"}
    return {"is_job": False, "status": None, "confidence": 0.0, "reason": "no job signals"}


def guess_company_from_sender(sender: str) -> str | None:
    """'Shopify Careers <no-reply@shopify.com>' -> 'Shopify'."""
    name = re.match(r"\s*\"?([^\"<]+?)\"?\s*<", sender or "")
    if name:
        cleaned = re.sub(r"(?i)\b(careers?|recruiting|talent( acquisition)?|hr|jobs|team|no-?reply)\b", "", name.group(1))
        cleaned = cleaned.strip(" -|,")
        if cleaned:
            return cleaned
    domain = re.search(r"@([\w-]+)\.", sender or "")
    if domain and domain.group(1).lower() not in {"gmail", "outlook", "hotmail", "yahoo", "myworkday", "greenhouse", "lever", "icims"}:
        return domain.group(1).capitalize()
    return None


def should_auto_update(current: str | None, new: JobStatus) -> bool:
    """The agent only moves a status forward; the user can always change it by hand."""
    if current is None:
        return True
    try:
        return STATUS_RANK[new] > STATUS_RANK[JobStatus(current)]
    except ValueError:
        return True
