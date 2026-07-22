"""
Runtime inference for the two-headed detector trained by ml/train_hybrid.py.

Two models score every flow. The supervised head recognises attack families it was trained
on; the novelty head, fitted on benign traffic alone, scores how far a flow sits from normal
and therefore needs no knowledge of the attack at all. A flow alerts if either head fires.

Both heads have their own calibrated threshold, chosen on a validation split carved from the
training days. To keep one number on screen and one decision boundary everywhere downstream,
each head's raw score is mapped onto [0, 1] such that ITS OWN threshold lands exactly at 0.5,
and the served score is the higher of the two. So `score() >= 0.5` means "something fired",
whichever head it was, and `explain()` says which.

Never reads a label: the only inputs are numeric features. If the artifact is missing the API
degrades to an explicit "detector unavailable" state rather than silently pretending to
detect, which is the failure mode this rebuild exists to remove.
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
        "heads": {
            "supervised": type(bundle["model"]).__name__,
            "novelty": bundle.get("novelty_name", "none"),
        },
        "false_positive_budget": bundle.get("fpr_budget"),
    }


def feature_names() -> list[str]:
    bundle = _load()
    return list(bundle["features"]) if bundle else []


def _as_matrix(vectors, bundle) -> np.ndarray:
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    expected = len(bundle["features"])
    if matrix.shape[1] != expected:
        raise ValueError(f"expected {expected} features, got {matrix.shape[1]}")
    return matrix


def _rescale(raw: np.ndarray, threshold: float, ceiling: float) -> np.ndarray:
    """Map a head's raw score onto [0, 1] with its own threshold pinned at 0.5."""
    span_low = max(threshold, 1e-9)
    span_high = max(ceiling - threshold, 1e-9)
    below = 0.5 * np.clip(raw / span_low, 0, 1)
    above = 0.5 + 0.5 * np.clip((raw - threshold) / span_high, 0, 1)
    return np.where(raw < threshold, below, above)


def heads(vectors) -> dict:
    """Both heads' contributions, on the same 0-1 scale. Used by score() and explain()."""
    bundle = _load()
    if bundle is None:
        raise RuntimeError(f"detector artifact unavailable: {_load_error}")
    matrix = _as_matrix(vectors, bundle)

    supervised_raw = bundle["model"].predict_proba(bundle["scaler"].transform(matrix))[:, 1]
    supervised = _rescale(supervised_raw, bundle["supervised_threshold"], 1.0)

    novelty_model = bundle.get("novelty")
    if novelty_model is None:
        return {"supervised": supervised, "novelty": np.zeros_like(supervised),
                "novelty_raw": np.zeros_like(supervised), "supervised_raw": supervised_raw}

    novelty_raw = novelty_model.score(matrix)
    novelty = _rescale(novelty_raw, bundle["novelty_threshold"], bundle["novelty_ceiling"])
    return {"supervised": supervised, "novelty": novelty,
            "supervised_raw": supervised_raw, "novelty_raw": novelty_raw}


def score(vectors: Sequence[Sequence[float]] | np.ndarray) -> np.ndarray:
    """Served score in [0, 1]. 0.5 is the decision boundary for whichever head fired."""
    both = heads(vectors)
    return np.maximum(both["supervised"], both["novelty"])


def explain(vector) -> dict:
    """Which head is responsible for a given flow's score."""
    both = heads([vector] if np.asarray(vector).ndim == 1 else vector)
    supervised = float(both["supervised"][0])
    novelty = float(both["novelty"][0])
    return {
        "supervised": round(supervised, 4),
        "novelty": round(novelty, 4),
        "fired": ("both" if supervised >= 0.5 and novelty >= 0.5
                  else "supervised" if supervised >= 0.5
                  else "novelty" if novelty >= 0.5 else "neither"),
        "explanation": ("recognised as a known attack pattern" if supervised >= novelty
                        else "unlike the learned profile of normal traffic"),
    }


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
