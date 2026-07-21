"""
Runtime inference for the intrusion detector trained by ml/train_detector.py.

This module is the replacement for the old passthrough. It never reads a label: the only
inputs are the flow's numeric features, and the only output is the model's probability. If
the artifact is missing the API degrades to an explicit "detector unavailable" state rather
than silently pretending to detect, which is the failure mode this rebuild exists to remove.
"""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Sequence

import numpy as np

# The cross-capture model (trained Mon/Tue/Wed only). The earlier random-split artifact
# scored 99.8% recall by having near-duplicate flows on both sides of its split; serving it
# would mean the demo stream contained traffic the model had already trained on.
ARTIFACT = Path(__file__).resolve().parent.parent / "ml" / "artifacts" / "base_detector.joblib"

_lock = threading.Lock()
_bundle: dict | None = None
_load_error: str | None = None


def _load() -> dict | None:
    """Load the persisted model once, tolerating absence without raising."""
    global _bundle, _load_error
    if _bundle is not None or _load_error is not None:
        return _bundle
    with _lock:
        if _bundle is None and _load_error is None:
            try:
                import joblib

                _bundle = joblib.load(ARTIFACT)
            except Exception as exc:  # missing artifact, version skew, corrupt file
                _load_error = f"{type(exc).__name__}: {exc}"
    return _bundle


def is_available() -> bool:
    return _load() is not None


def status() -> dict:
    bundle = _load()
    if bundle is None:
        return {"available": False, "error": _load_error, "artifact": str(ARTIFACT)}
    return {
        "available": True,
        "model": type(bundle["model"]).__name__,
        "features": len(bundle["features"]),
        "threshold": bundle["threshold"],
        "version": bundle.get("version", "unversioned"),
        "trained_on": bundle.get("trained_on", []),
    }


def feature_names() -> list[str]:
    bundle = _load()
    return list(bundle["features"]) if bundle else []


def score(vectors: Sequence[Sequence[float]] | np.ndarray) -> np.ndarray:
    """Return P(attack) for each already-masked feature vector."""
    bundle = _load()
    if bundle is None:
        raise RuntimeError(f"detector artifact unavailable: {_load_error}")

    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    expected = len(bundle["features"])
    if matrix.shape[1] != expected:
        raise ValueError(f"expected {expected} features, got {matrix.shape[1]}")

    return bundle["model"].predict_proba(bundle["scaler"].transform(matrix))[:, 1]


def version() -> str:
    bundle = _load()
    return bundle.get("version", "unversioned") if bundle else "unavailable"


def threshold() -> float:
    bundle = _load()
    return float(bundle["threshold"]) if bundle else 0.5


def severity_for(probability: float) -> str:
    """Map a model probability onto the severity vocabulary the UI already speaks."""
    if probability >= 0.95:
        return "critical"
    if probability >= 0.80:
        return "high"
    if probability >= 0.50:
        return "medium"
    if probability >= 0.25:
        return "low"
    return "info"
