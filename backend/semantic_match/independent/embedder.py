"""
Text -> embedding (a list of numbers that captures meaning) and the maths
used to compare them.

Uses fastembed (free, runs offline on the laptop, ONNX - no GPU needed).
The model is downloaded once on first use and cached.
"""
from __future__ import annotations

import math
import threading
from pathlib import Path
from typing import Sequence

Vector = list[float]

# Calibrated on the sample resume vs. postings with BAAI/bge-small-en-v1.5:
# a matching junior-dev posting scores ~0.76, a nurse or truck driver ~0.55.
FIT_LOW = 0.55   # at or below -> 0 % fit
FIT_HIGH = 0.80  # at or above -> 100 % fit
DUPLICATE_SIMILARITY = 0.97  # same posting, even if reworded or from another site

CHUNK_CHARS = 1500  # long texts are split, embedded, then averaged


class EmbeddingUnavailable(RuntimeError):
    """fastembed is not installed or the model could not be loaded."""


def chunks(text: str, size: int = CHUNK_CHARS) -> list[str]:
    text = " ".join((text or "").split())
    return [text[i:i + size] for i in range(0, len(text), size)] or [""]


def normalize(v: Sequence[float]) -> Vector:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [float(x) / n for x in v]


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Similarity of two vectors, -1..1 (1 = same meaning)."""
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return sum(x * y for x, y in zip(a, b)) / (na * nb)


def fit_score(similarity: float) -> int:
    """Map raw similarity to a 0-100 'overall fit' a person can read."""
    pct = (similarity - FIT_LOW) / (FIT_HIGH - FIT_LOW) * 100
    return int(round(max(0.0, min(100.0, pct))))


class Embedder:
    """Lazy wrapper around a fastembed model (loaded on first call)."""

    def __init__(self, model_name: str, cache_dir: Path | None = None) -> None:
        self.model_name = model_name
        self.cache_dir = cache_dir
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        with self._lock:
            if self._model is None:
                try:
                    from fastembed import TextEmbedding
                except ImportError as exc:
                    raise EmbeddingUnavailable("fastembed is not installed (pip install fastembed)") from exc
                try:
                    self._model = TextEmbedding(
                        self.model_name, cache_dir=str(self.cache_dir) if self.cache_dir else None
                    )
                except Exception as exc:  # noqa: BLE001 - download / ONNX errors
                    raise EmbeddingUnavailable(f"Could not load embedding model {self.model_name}: {exc}") from exc
            return self._model

    def embed(self, text: str) -> Vector:
        """One normalized vector for a whole document (chunks averaged)."""
        model = self._load()
        vectors = [list(v) for v in model.embed(chunks(text))]
        mean = [sum(col) / len(vectors) for col in zip(*vectors)]
        return normalize(mean)
