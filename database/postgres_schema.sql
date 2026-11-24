-- Irish - PostgreSQL schema (C5 Data store)
--
-- One table per collection the backend uses. Each row keeps its full record
-- in `data` (JSONB) so the API stays exactly the same as the old JSON store,
-- while id / created_at / updated_at are real columns for sorting and lookups.
--
-- Applied automatically by the backend on startup and by
--   python -m scripts.setup_postgres
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS resumes (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS job_postings (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS tailored_resumes (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_jobs (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS job_emails (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

-- Passwords inside `data` are already Fernet-encrypted by C8.
CREATE TABLE IF NOT EXISTS credentials (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

-- Single records such as the user profile and tracker state.
CREATE TABLE IF NOT EXISTS singletons (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB NOT NULL
);

-- Newest-first listing is the most common query.
CREATE INDEX IF NOT EXISTS resumes_created_idx          ON resumes (created_at DESC);
CREATE INDEX IF NOT EXISTS job_postings_created_idx     ON job_postings (created_at DESC);
CREATE INDEX IF NOT EXISTS tailored_resumes_created_idx ON tailored_resumes (created_at DESC);
CREATE INDEX IF NOT EXISTS tracked_jobs_created_idx     ON tracked_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS job_emails_created_idx       ON job_emails (created_at DESC);
