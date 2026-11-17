"""Builds the LLM provider chosen in configuration/settings.py."""
from __future__ import annotations

from backend.text_generation.independent.llm_providers import (
    GeminiProvider,
    LLMProvider,
    OllamaProvider,
    OpenAICompatibleProvider,
    StubProvider,
)
from configuration.settings import settings


def get_llm(provider: str | None = None) -> LLMProvider:
    name = (provider or settings.llm_provider).lower()
    common = {"temperature": settings.llm_temperature, "timeout": settings.llm_timeout_seconds}
    if name == "ollama":
        return OllamaProvider(settings.ollama_url, model=settings.ollama_model, **common)
    if name == "groq":
        return OpenAICompatibleProvider(
            "groq", settings.groq_url, settings.groq_api_key, model=settings.groq_model, **common
        )
    if name == "gemini":
        return GeminiProvider(
            settings.gemini_url, settings.gemini_api_key, model=settings.gemini_model, **common
        )
    if name == "stub":
        return StubProvider(model="template")
    raise ValueError(f"Unknown LLM_PROVIDER '{name}'. Use ollama, groq, gemini or stub.")
