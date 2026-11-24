"""
PostgreSQL document store (C5).

Drop-in replacement for JsonStore: same methods, same row shape
(dict rows with `id`, `created_at`, `updated_at`). Each collection is a
table with columns (id, created_at, updated_at, data JSONB) - see
database/postgres_schema.sql.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from psycopg import sql
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from backend.storage.independent.json_store import utc_now

SCHEMA_FILE = Path(__file__).resolve().parents[3] / "database" / "postgres_schema.sql"
_SAFE_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
_PROTECTED = ("id", "created_at")


def _table_name(collection: str) -> str:
    """Map a collection name to its table ("_singletons" -> "singletons")."""
    name = collection.lstrip("_") or collection
    if not _SAFE_NAME.match(name):
        raise ValueError(f"Invalid collection name: {collection!r}")
    return name


def _ts(value: Any) -> datetime | None:
    """ISO text -> datetime for the timestamp columns (None = use DB default)."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


class PostgresStore:
    def __init__(self, database_url: str, min_size: int = 1, max_size: int = 5) -> None:
        self.pool = ConnectionPool(
            database_url, min_size=min_size, max_size=max_size, open=True,
            kwargs={"autocommit": False},
        )
        self._known_tables: set[str] = set()
        self.apply_schema()

    # -- setup ------------------------------------------------------------
    def apply_schema(self) -> None:
        with self.pool.connection() as conn:
            conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))

    def _ensure_table(self, conn, table: str) -> None:
        """Create a table for a collection not in the schema file yet."""
        if table in self._known_tables:
            return
        conn.execute(
            sql.SQL(
                "CREATE TABLE IF NOT EXISTS {} ("
                " id TEXT PRIMARY KEY,"
                " created_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
                " updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
                " data JSONB NOT NULL)"
            ).format(sql.Identifier(table))
        )
        self._known_tables.add(table)

    def _write(self, conn, table: str, row: dict[str, Any]) -> None:
        conn.execute(
            sql.SQL(
                "INSERT INTO {} (id, created_at, updated_at, data)"
                " VALUES (%s, COALESCE(%s, now()), COALESCE(%s, now()), %s)"
                " ON CONFLICT (id) DO UPDATE SET"
                " updated_at = EXCLUDED.updated_at, data = EXCLUDED.data"
            ).format(sql.Identifier(table)),
            (row["id"], _ts(row.get("created_at")), _ts(row.get("updated_at")), Jsonb(row)),
        )

    # -- public API (same as JsonStore) -----------------------------------
    def insert(self, collection: str, row: dict[str, Any]) -> dict[str, Any]:
        table = _table_name(collection)
        row = dict(row)
        row.setdefault("id", uuid.uuid4().hex)
        row.setdefault("created_at", utc_now())
        row["updated_at"] = utc_now()
        with self.pool.connection() as conn:
            self._ensure_table(conn, table)
            self._write(conn, table, row)
        return dict(row)

    def get(self, collection: str, row_id: str) -> dict[str, Any] | None:
        table = _table_name(collection)
        with self.pool.connection() as conn:
            self._ensure_table(conn, table)
            rec = conn.execute(
                sql.SQL("SELECT data FROM {} WHERE id = %s").format(sql.Identifier(table)),
                (row_id,),
            ).fetchone()
        return dict(rec[0]) if rec else None

    def update(self, collection: str, row_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        table = _table_name(collection)
        with self.pool.connection() as conn:  # one transaction, row locked
            self._ensure_table(conn, table)
            rec = conn.execute(
                sql.SQL("SELECT data FROM {} WHERE id = %s FOR UPDATE").format(sql.Identifier(table)),
                (row_id,),
            ).fetchone()
            if rec is None:
                return None
            row = dict(rec[0])
            row.update({k: v for k, v in changes.items() if k not in _PROTECTED})
            row["updated_at"] = utc_now()
            self._write(conn, table, row)
        return dict(row)

    def delete(self, collection: str, row_id: str) -> bool:
        table = _table_name(collection)
        with self.pool.connection() as conn:
            self._ensure_table(conn, table)
            cur = conn.execute(
                sql.SQL("DELETE FROM {} WHERE id = %s").format(sql.Identifier(table)), (row_id,)
            )
            return cur.rowcount > 0

    def clear(self, collection: str) -> int:
        table = _table_name(collection)
        with self.pool.connection() as conn:
            self._ensure_table(conn, table)
            cur = conn.execute(sql.SQL("DELETE FROM {}").format(sql.Identifier(table)))
            return cur.rowcount

    def all(
        self,
        collection: str,
        where: Callable[[dict[str, Any]], bool] | None = None,
        newest_first: bool = True,
    ) -> list[dict[str, Any]]:
        table = _table_name(collection)
        order = sql.SQL("DESC" if newest_first else "ASC")
        with self.pool.connection() as conn:
            self._ensure_table(conn, table)
            recs = conn.execute(
                sql.SQL("SELECT data FROM {} ORDER BY created_at {}, id").format(
                    sql.Identifier(table), order
                )
            ).fetchall()
        rows = [dict(r[0]) for r in recs]
        return [r for r in rows if where(r)] if where else rows

    def restore(self, collection: str, row: dict[str, Any]) -> None:
        """Save a row exactly as given (keeps its id and timestamps) - for migration."""
        table = _table_name(collection)
        row = dict(row)
        row.setdefault("id", uuid.uuid4().hex)
        with self.pool.connection() as conn:
            self._ensure_table(conn, table)
            self._write(conn, table, row)

    # Single-document helpers (e.g. the one user profile, tracker state)
    def get_singleton(self, key: str) -> dict[str, Any] | None:
        return self.get("_singletons", key)

    def set_singleton(self, key: str, value: dict[str, Any]) -> dict[str, Any]:
        existing = self.get("_singletons", key)
        row = {**(existing or {}), **value, "id": key}
        if existing:
            return self.update("_singletons", key, row)  # type: ignore[return-value]
        return self.insert("_singletons", row)

    def close(self) -> None:
        self.pool.close()
