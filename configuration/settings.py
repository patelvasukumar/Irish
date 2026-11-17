"""
Irish - central settings.

This is the ONLY place to change API links, AI model names and paths.
Values are read from environment variables / the git-ignored `.env` file
in the project root, with safe defaults so the app runs out of the box.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # optional: load .env if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class Settings:
    # ---- App -------------------------------------------------------------
    app_name: str = "Irish"
    api_prefix: str = "/api"
    cors_origins: list[str] = field(
        default_factory=lambda: _env("CORS_ORIGINS", "*").split(",")
    )

    # ---- C2 Text generation (free LLMs first) ----------------------------
    # One of: ollama | groq | gemini | stub
    llm_provider: str = _env("LLM_PROVIDER", "ollama").lower()
    llm_temperature: float = float(_env("LLM_TEMPERATURE", "0.3"))
    llm_timeout_seconds: float = float(_env("LLM_TIMEOUT_SECONDS", "120"))
    # Fall back to the offline stub writer if the chosen LLM is unreachable.
    llm_fallback_to_stub: bool = _env("LLM_FALLBACK_TO_STUB", "true").lower() == "true"

    # Ollama - free, runs locally (https://ollama.com). `ollama pull llama3.2`
    ollama_url: str = _env("OLLAMA_URL", "http://127.0.0.1:11434")
    ollama_model: str = _env("OLLAMA_MODEL", "llama3.2")

    # Groq - free tier, hosted (https://console.groq.com)
    groq_url: str = _env("GROQ_URL", "https://api.groq.com/openai/v1")
    groq_api_key: str = _env("GROQ_API_KEY")
    groq_model: str = _env("GROQ_MODEL", "llama-3.1-8b-instant")

    # Google Gemini - free tier, hosted (https://aistudio.google.com)
    gemini_url: str = _env("GEMINI_URL", "https://generativelanguage.googleapis.com/v1beta")
    gemini_api_key: str = _env("GEMINI_API_KEY")
    gemini_model: str = _env("GEMINI_MODEL", "gemini-2.0-flash")

    # ---- C3 Image recognition --------------------------------------------
    # Full path to tesseract.exe on Windows if it is not on PATH.
    tesseract_cmd: str = _env("TESSERACT_CMD")

    # ---- C4 Graph RAG (Neo4j) - set up later -------------------------------
    neo4j_uri: str = _env("NEO4J_URI")
    neo4j_user: str = _env("NEO4J_USER", "neo4j")
    neo4j_password: str = _env("NEO4J_PASSWORD")

    # ---- C5 Data store (PostgreSQL + pgvector) - set up later --------------
    database_url: str = _env("DATABASE_URL")
    # Until the database is ready, data is kept in a local JSON file.
    local_store_file: Path = Path(
        _env("LOCAL_STORE_FILE", str(ROOT_DIR / "data" / "irish_store.json"))
    )

    # ---- Files -------------------------------------------------------------
    history_dir: Path = Path(_env("HISTORY_DIR", str(ROOT_DIR / "history")))
    upload_max_mb: int = int(_env("UPLOAD_MAX_MB", "10"))

    # ---- C8 Credential manager --------------------------------------------
    # Encryption key file - stays on the laptop, never committed.
    credential_key_file: Path = Path(
        _env("CREDENTIAL_KEY_FILE", str(ROOT_DIR / "configuration" / ".credential.key"))
    )

    # ---- C7 Job tracker mailbox (read-only IMAP) ---------------------------
    imap_host: str = _env("IMAP_HOST", "imap.gmail.com")
    imap_user: str = _env("IMAP_USER")
    imap_password: str = _env("IMAP_PASSWORD")  # use an app password
    imap_folder: str = _env("IMAP_FOLDER", "INBOX")

    # ---- Google Cloud storage (optional) -----------------------------------
    gcs_bucket: str = _env("GCS_BUCKET")


settings = Settings()
