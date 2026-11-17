"""
C2 - LLM providers. Free options first:

    ollama  - free, runs on the laptop, no key      (default)
    groq    - free tier, hosted, needs GROQ_API_KEY
    gemini  - free tier, hosted, needs GEMINI_API_KEY
    stub    - offline template writer, no AI (always works; used for tests)

Each provider has the same `generate(system, prompt) -> str` method, so the
model can be changed in configuration/settings.py (demo step 8).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import httpx


class LLMError(Exception):
    pass


class LLMProvider(ABC):
    name: str = "base"

    def __init__(self, model: str = "", temperature: float = 0.3, timeout: float = 120.0) -> None:
        self.model = model
        self.temperature = temperature
        self.timeout = timeout

    @abstractmethod
    def generate(self, system: str, prompt: str) -> str: ...

    def describe(self) -> dict:
        return {"provider": self.name, "model": self.model}


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, base_url: str, **kw) -> None:
        super().__init__(**kw)
        self.base_url = base_url.rstrip("/")

    def generate(self, system: str, prompt: str) -> str:
        try:
            r = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "options": {"temperature": self.temperature},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
            return r.json()["message"]["content"].strip()
        except httpx.ConnectError as exc:
            raise LLMError(
                f"Ollama is not running at {self.base_url}. Install it from https://ollama.com "
                f"and run: ollama pull {self.model}"
            ) from exc
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise LLMError(f"Ollama error: {exc}") from exc


class OpenAICompatibleProvider(LLMProvider):
    """Works with Groq (and any other OpenAI-compatible free endpoint)."""

    def __init__(self, name: str, base_url: str, api_key: str, **kw) -> None:
        super().__init__(**kw)
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def generate(self, system: str, prompt: str) -> str:
        if not self.api_key:
            raise LLMError(f"{self.name.upper()}_API_KEY is not set in .env")
        try:
            r = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "temperature": self.temperature,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise LLMError(f"{self.name} error: {exc}") from exc


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, base_url: str, api_key: str, **kw) -> None:
        super().__init__(**kw)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def generate(self, system: str, prompt: str) -> str:
        if not self.api_key:
            raise LLMError("GEMINI_API_KEY is not set in .env")
        try:
            r = httpx.post(
                f"{self.base_url}/models/{self.model}:generateContent",
                headers={"x-goog-api-key": self.api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": self.temperature},
                },
                timeout=self.timeout,
            )
            r.raise_for_status()
            parts = r.json()["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts).strip()
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise LLMError(f"Gemini error: {exc}") from exc


class StubProvider(LLMProvider):
    """
    Offline fallback. It does not call an AI model; the resume writer detects
    this provider and builds the tailored resume from a template instead.
    """

    name = "stub"

    def generate(self, system: str, prompt: str) -> str:
        raise LLMError("stub provider does not generate free text")
