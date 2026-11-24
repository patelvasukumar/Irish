"""
Set up the PostgreSQL database (C5) and copy the old JSON data into it.

    python -m scripts.setup_postgres              # create database + tables
    python -m scripts.setup_postgres --migrate    # ...and copy data/irish_store.json

Reads DATABASE_URL from .env, e.g.
    DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/irish
The database ("irish" above) is created if it does not exist yet.
Running it again is safe: existing rows with the same id are overwritten
by the JSON copy, nothing else is touched.
"""
from __future__ import annotations

import argparse
import json
import sys

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from configuration.settings import settings


def create_database_if_missing(database_url: str) -> None:
    params = conninfo_to_dict(database_url)
    dbname = params.get("dbname") or "irish"
    admin_url = make_conninfo(database_url, dbname="postgres")
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)).fetchone()
        if exists:
            print(f"Database '{dbname}' already exists.")
        else:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
            print(f"Created database '{dbname}'.")


def migrate_json(store) -> None:
    path = settings.local_store_file
    if not path.exists():
        print(f"No JSON data at {path} - nothing to copy.")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    total = 0
    for collection, rows in data.items():
        for row in rows.values():
            store.restore(collection, row)  # keeps id, created_at, updated_at
            total += 1
        print(f"  {collection}: {len(rows)} rows")
    print(f"Copied {total} rows from {path.name}. The JSON file was left unchanged.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--migrate", action="store_true", help="copy data/irish_store.json into PostgreSQL")
    args = parser.parse_args()

    if not settings.database_url:
        print("DATABASE_URL is empty in .env - set it first, e.g.\n"
              "  DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/irish")
        return 1

    try:
        create_database_if_missing(settings.database_url)
        from backend.storage.independent.postgres_store import PostgresStore

        store = PostgresStore(settings.database_url)
        print("Tables are ready (database/postgres_schema.sql).")
        if args.migrate:
            migrate_json(store)
        store.close()
    except psycopg.OperationalError as exc:
        print(f"Could not connect to PostgreSQL: {exc}".strip())
        print("Check that PostgreSQL is running and the password in DATABASE_URL is right.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
