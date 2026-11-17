"""C2 - prompt templates for the resume writer (pure functions)."""
from __future__ import annotations

RESUME_SYSTEM = (
    "You are an expert Canadian resume writer helping students and new graduates. "
    "Rewrite the candidate's resume so it targets the given job posting. Rules:\n"
    "1. NEVER invent jobs, employers, degrees, dates, certifications or skills the candidate does not have.\n"
    "2. Reorder and reword existing content so the most relevant experience and skills come first.\n"
    "3. Use the job posting's wording for skills the candidate really has.\n"
    "4. Use strong action verbs and quantify results only when numbers exist in the source.\n"
    "5. Keep it to one or two pages, Canadian format (no photo, age or marital status).\n"
    "6. Output Markdown only: '# Name' on the first line, contact line, then '## ' section headings "
    "(Summary, Skills, Experience, Projects, Education, Certifications as available) and '- ' bullets.\n"
    "7. Do not add any commentary before or after the resume."
)


def build_resume_prompt(
    resume_text: str,
    posting_text: str,
    matched: list[str],
    missing: list[str],
    related: list[str],
    extra_instructions: str = "",
) -> str:
    return f"""JOB POSTING:
\"\"\"
{posting_text[:6000]}
\"\"\"

CANDIDATE RESUME:
\"\"\"
{resume_text[:8000]}
\"\"\"

SKILL ANALYSIS:
- Skills the candidate has that the job wants (put these first): {', '.join(matched) or 'none'}
- Skills the job wants that the candidate does NOT list (do not claim them; you may mention
  related experience honestly): {', '.join(missing) or 'none'}
- Related skills from the skill graph that the candidate has and are worth highlighting: {', '.join(related) or 'none'}

{('EXTRA INSTRUCTIONS FROM THE USER: ' + extra_instructions) if extra_instructions else ''}

Write the tailored resume now."""


def profile_to_resume_text(profile: dict) -> str:
    """Turn the profile form into plain resume text (used when there is no resume)."""
    lines: list[str] = [f"# {profile.get('full_name') or 'Your Name'}"]
    contact = " | ".join(
        x for x in [profile.get("email"), profile.get("phone"), profile.get("city"),
                    profile.get("province"), profile.get("linkedin"), profile.get("github")] if x
    )
    if contact:
        lines.append(contact)
    if profile.get("summary"):
        lines += ["", "## Summary", profile["summary"]]
    if profile.get("skills"):
        lines += ["", "## Skills", ", ".join(profile["skills"])]
    if profile.get("experience"):
        lines += ["", "## Experience"]
        for job in profile["experience"]:
            lines.append(
                f"{job.get('title', '')} - {job.get('company', '')} "
                f"({job.get('start', '')} - {job.get('end') or 'Present'}) {job.get('location') or ''}".strip()
            )
            for b in job.get("bullets", []):
                lines.append(f"- {b}")
    if profile.get("projects"):
        lines += ["", "## Projects"]
        for p in profile["projects"]:
            lines.append(f"{p.get('name', '')}: {p.get('description', '')}")
            if p.get("technologies"):
                lines.append(f"- Technologies: {', '.join(p['technologies'])}")
    if profile.get("education"):
        lines += ["", "## Education"]
        for e in profile["education"]:
            lines.append(
                f"{e.get('credential', '')} - {e.get('institution', '')} "
                f"({e.get('start', '')} - {e.get('end') or 'Present'})".strip()
            )
    if profile.get("certifications"):
        lines += ["", "## Certifications"] + [f"- {c}" for c in profile["certifications"]]
    return "\n".join(lines)


_SECTION_ORDER = [
    ("experience", "Experience"),
    ("projects", "Projects"),
    ("education", "Education"),
    ("certifications", "Certifications"),
]


def _bulletize(block: str) -> str:
    """Keep the user's lines; make loose lines read cleanly in Markdown."""
    out = []
    for line in block.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith(("- ", "* ", "• ")):
            out.append("- " + s[2:].strip())
        else:
            out.append(f"**{s}**" if not s.startswith("**") else s)
    return "\n".join(out)


def template_tailor(
    sections: dict[str, str],
    posting_title: str | None,
    company: str | None,
    matched: list[str],
    related: list[str],
    all_resume_skills: list[str],
) -> str:
    """
    Offline (stub) tailoring - no AI. Used when no free LLM is reachable so the
    demo never breaks. `sections` comes from C1 split_sections(). It:
      * keeps the name and contact line at the top,
      * replaces the summary with one aimed at this job,
      * reorders skills so the ones the job wants come first,
      * keeps experience / projects / education exactly as written (no invention).
    """
    header_lines = [l.strip() for l in sections.get("header", "").splitlines() if l.strip()]
    name = (header_lines[0] if header_lines else "Your Name").lstrip("# ").strip()
    contact = " | ".join(header_lines[1:3])

    ordered = list(dict.fromkeys(matched + related + all_resume_skills))
    target = " ".join(
        x for x in [posting_title and f"the {posting_title} role", company and f"at {company}"] if x
    )
    focus = matched[:5] or all_resume_skills[:5]
    summary = (
        f"Candidate for {target or 'this role'} with hands-on experience in "
        f"{', '.join(focus) or 'relevant technologies'}."
    )
    if sections.get("summary"):
        summary += " " + " ".join(sections["summary"].split())

    parts = [f"# {name}"]
    if contact:
        parts.append(contact)
    parts += ["", "## Summary", summary, "", "## Skills", ", ".join(ordered[:18])]
    for key, title in _SECTION_ORDER:
        if sections.get(key):
            parts += ["", f"## {title}", _bulletize(sections[key])]
    return "\n".join(parts)
