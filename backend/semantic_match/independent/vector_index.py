"""
Where embeddings are kept and searched.

- PgVectorIndex: PostgreSQL + pgvector. Vectors live in a real `vector`
  column with an HNSW index, and the database finds the nearest ones.
- MemoryVectorIndex: any store (JSON file or PostgreSQL without pgvector).
  Vectors are saved as plain lists and compared in Python. Fine for one
  person's resumes and jobs.

Both have the same methods. `kind` is "resume" or "posting".
"""
from __future__ import annotations

from typing import Any, Iterable, Protocol

from backend.semantic_match.independent.embedder import Vector, cosine

EMBEDDINGS = "embeddings"  # collection used by MemoryVectorIndex


class VectorIndex(Protocol):
    backend_name: str

    def upsert(self, kind: str, ref_id: str, vector: Vector) -> None: ...
    def get(self, kind: str, ref_id: str) -> Vector | None: ...
    def delete(self, kind: str, ref_id: str) -> None: ...
    def known_ids(self, kind: str) -> set[str]: ...
    def search(self, kind: str, vector: Vector, limit: int = 5,
               exclude: Iterable[str] = ()) -> list[tuple[str, float]]: ...


class MemoryVectorIndex:
    backend_name = "in-app search"

    def __init__(self, store: Any, model: str) -> None:
        self.store = store
        self.model = model

    @staticmethod
    def _id(kind: str, ref_id: str) -> str:
        return f"{kind}:{ref_id}"

    def _rows(self, kind: str) -> list[dict]:
        return self.store.all(EMBEDDINGS, where=lambda r: r.get("kind") == kind and r.get("model") == self.model)

    def upsert(self, kind: str, ref_id: str, vector: Vector) -> None:
        row_id = self._id(kind, ref_id)
        row = {"kind": kind, "ref_id": ref_id, "model": self.model, "vector": list(vector)}
        if self.store.get(EMBEDDINGS, row_id):
            self.store.update(EMBEDDINGS, row_id, row)
        else:
            self.store.insert(EMBEDDINGS, {"id": row_id, **row})

    def get(self, kind: str, ref_id: str) -> Vector | None:
        row = self.store.get(EMBEDDINGS, self._id(kind, ref_id))
        return row["vector"] if row and row.get("model") == self.model else None

    def delete(self, kind: str, ref_id: str) -> None:
        self.store.delete(EMBEDDINGS, self._id(kind, ref_id))

    def known_ids(self, kind: str) -> set[str]:
        return {r["ref_id"] for r in self._rows(kind)}

    def search(self, kind, vector, limit=5, exclude=()):
        skip = set(exclude)
        scored = [(r["ref_id"], cosine(vector, r["vector"])) for r in self._rows(kind) if r["ref_id"] not in skip]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:limit]


def _vec_literal(v: Vector) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"


class PgVectorIndex:
    backend_name = "pgvector"

    def __init__(self, pool: Any, model: str, dims: int) -> None:
        from psycopg import sql

        self.pool = pool
        self.model = model
        self.dims = int(dims)
        self.table = sql.Identifier(f"semantic_embeddings_{self.dims}")
        self._sql = sql
        with self.pool.connection() as conn:
            conn.execute(sql.SQL(
                "CREATE TABLE IF NOT EXISTS {t} ("
                " kind TEXT NOT NULL, ref_id TEXT NOT NULL, model TEXT NOT NULL,"
                " embedding vector({d}) NOT NULL,"
                " updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
                " PRIMARY KEY (kind, ref_id))"
            ).format(t=self.table, d=sql.Literal(self.dims)))
            conn.execute(sql.SQL(
                "CREATE INDEX IF NOT EXISTS {i} ON {t} USING hnsw (embedding vector_cosine_ops)"
            ).format(i=sql.Identifier(f"semantic_embeddings_{self.dims}_hnsw"), t=self.table))

    @staticmethod
    def available(pool: Any) -> bool:
        """True if the pgvector extension is installed (enables it if needed)."""
        try:
            with pool.connection() as conn:
                conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            return True
        except Exception:  # noqa: BLE001 - extension files missing or no permission
            return False

    def upsert(self, kind, ref_id, vector):
        with self.pool.connection() as conn:
            conn.execute(self._sql.SQL(
                "INSERT INTO {t} (kind, ref_id, model, embedding) VALUES (%s, %s, %s, %s::vector)"
                " ON CONFLICT (kind, ref_id) DO UPDATE SET model = EXCLUDED.model,"
                " embedding = EXCLUDED.embedding, updated_at = now()"
            ).format(t=self.table), (kind, ref_id, self.model, _vec_literal(vector)))

    def get(self, kind, ref_id):
        with self.pool.connection() as conn:
            rec = conn.execute(self._sql.SQL(
                "SELECT embedding::text FROM {t} WHERE kind = %s AND ref_id = %s AND model = %s"
            ).format(t=self.table), (kind, ref_id, self.model)).fetchone()
        return [float(x) for x in rec[0].strip("[]").split(",")] if rec else None

    def delete(self, kind, ref_id):
        with self.pool.connection() as conn:
            conn.execute(self._sql.SQL("DELETE FROM {t} WHERE kind = %s AND ref_id = %s").format(t=self.table),
                         (kind, ref_id))

    def known_ids(self, kind):
        with self.pool.connection() as conn:
            recs = conn.execute(self._sql.SQL("SELECT ref_id FROM {t} WHERE kind = %s AND model = %s")
                                .format(t=self.table), (kind, self.model)).fetchall()
        return {r[0] for r in recs}

    def search(self, kind, vector, limit=5, exclude=()):
        lit = _vec_literal(vector)
        with self.pool.connection() as conn:
            recs = conn.execute(self._sql.SQL(
                "SELECT ref_id, 1 - (embedding <=> %s::vector) AS similarity FROM {t}"
                " WHERE kind = %s AND model = %s AND NOT (ref_id = ANY(%s))"
                " ORDER BY embedding <=> %s::vector LIMIT %s"
            ).format(t=self.table), (lit, kind, self.model, list(exclude), lit, limit)).fetchall()
        return [(r[0], float(r[1])) for r in recs]
