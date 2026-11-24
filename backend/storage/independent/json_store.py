"""
Tiny thread-safe JSON document store.

TEMPORARY: used until the PostgreSQL + pgvector database (C5) is set up.
It keeps the same shape as the future tables (collections of dict rows with
an `id`), so swapping it for a real repository later only touches
backend/storage/dependent/store.py.
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JsonStore:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._data: dict[str, dict[str, dict[str, Any]]] = self._load()

    # -- internal ---------------------------------------------------------
    def _load(self) -> dict:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                backup = self.path.with_suffix(".corrupt.json")
                self.path.replace(backup)
        return {}

    def _flush(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), encoding="utf-8")
        # On Windows, antivirus or the search indexer can hold the file for a
        # moment right after a write, making the rename fail with "Access is
        # denied". Retry briefly before giving up.
        for attempt in range(10):
            try:
                tmp.replace(self.path)
                return
            except PermissionError:
                if attempt == 9:
                    raise
                time.sleep(0.05 * (attempt + 1))

    def _col(self, collection: str) -> dict[str, dict[str, Any]]:
        return self._data.setdefault(collection, {})

    # -- public API -------------------------------------------------------
    def insert(self, collection: str, row: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            row = dict(row)
            row.setdefault("id", uuid.uuid4().hex)
            row.setdefault("created_at", utc_now())
            row["updated_at"] = utc_now()
            self._col(collection)[row["id"]] = row
            self._flush()
            return dict(row)

    def get(self, collection: str, row_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._col(collection).get(row_id)
            return dict(row) if row else None

    def update(self, collection: str, row_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            row = self._col(collection).get(row_id)
            if row is None:
                return None
            row.update({k: v for k, v in changes.items() if k not in ("id", "created_at")})
            row["updated_at"] = utc_now()
            self._flush()
            return dict(row)

    def delete(self, collection: str, row_id: str) -> bool:
        with self._lock:
            removed = self._col(collection).pop(row_id, None) is not None
            if removed:
                self._flush()
            return removed

    def clear(self, collection: str) -> int:
        with self._lock:
            count = len(self._col(collection))
            self._data[collection] = {}
            self._flush()
            return count

    def all(
        self,
        collection: str,
        where: Callable[[dict[str, Any]], bool] | None = None,
        newest_first: bool = True,
    ) -> list[dict[str, Any]]:
        with self._lock:
            rows = [dict(r) for r in self._col(collection).values()]
        if where:
            rows = [r for r in rows if where(r)]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=newest_first)
        return rows

    # Single-document helpers (e.g. the one user profile, tracker state)
    def get_singleton(self, key: str) -> dict[str, Any] | None:
        return self.get("_singletons", key)

    def set_singleton(self, key: str, value: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            existing = self.get("_singletons", key)
            row = {**(existing or {}), **value, "id": key}
            if existing:
                return self.update("_singletons", key, row)  # type: ignore[return-value]
            return self.insert("_singletons", row)
