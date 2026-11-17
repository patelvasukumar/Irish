"""
C2 - Resume writer. Combines C1 (skills), C4 (graph context) and the LLM
to write the tailored resume (flow step 6).
"""
from __future__ import annotations

import re

from backend.graph_rag.dependent.graph_service import get_graph
from backend.text_generation.dependent.llm_factory import get_llm
from backend.text_generation.independent.llm_providers import LLMError, StubProvider
from backend.text_generation.independent.prompts import (
    RESUME_SYSTEM,
    build_resume_prompt,
    template_tailor,
)
from backend.text_recognition.independent.skill_extractor import (
    analyse_document,
    compare_skills,
    normalize_text,
    split_sections,
)
from configuration.settings import settings


def _clean_markdown(text: str) -> str:
    """Strip code fences / chatter some models add around the resume."""
    text = re.sub(r"^```(?:markdown|md)?\s*|\s*```$", "", text.strip())
    first_heading = text.find("# ")
    if 0 < first_heading < 300:
        text = text[first_heading:]
    return text.strip()


def analyse_match(resume_text: str, posting_text: str) -> dict:
    """C1 + C4: skills in both documents, match and related graph skills."""
    resume = analyse_document(resume_text, "resume")
    posting = analyse_document(posting_text, "posting")
    comparison = compare_skills(resume["skills"], posting["skills"])
    graph = get_graph()
    related = graph.related_skills_for_gap(
        candidate_skills=resume["skills"], missing_skills=comparison["missing"]
    )
    return {
        "resume": resume,
        "posting": posting,
        **comparison,
        "related": related,  # [{missing, related_skill_you_have, relation}]
        "role_skills": graph.skills_for_title(posting.get("title") or ""),
        "graph_backend": graph.backend_name,
    }


def tailor_resume(
    resume_text: str,
    posting_text: str,
    extra_instructions: str = "",
    provider: str | None = None,
) -> dict:
    analysis = analyse_match(resume_text, posting_text)
    related_have = sorted({r["related_skill_you_have"] for r in analysis["related"]})
    llm = get_llm(provider)
    used = llm.describe()
    warning = None

    if isinstance(llm, StubProvider):
        text = None
    else:
        try:
            raw = llm.generate(
                RESUME_SYSTEM,
                build_resume_prompt(
                    resume_text, posting_text, analysis["matched"], analysis["missing"],
                    related_have, extra_instructions,
                ),
            )
            text = _clean_markdown(raw)
        except LLMError as exc:
            if not settings.llm_fallback_to_stub:
                raise
            warning = f"{exc} - used the offline template instead."
            text = None

    if text is None:
        text = template_tailor(
            split_sections(normalize_text(resume_text)),
            analysis["posting"].get("title"),
            analysis["posting"].get("company"),
            analysis["matched"],
            related_have,
            analysis["resume"]["skills"],
        )
        used = {"provider": "stub", "model": "template"}

    return {"tailored_resume": text, "analysis": analysis, "llm": used, "warning": warning}
