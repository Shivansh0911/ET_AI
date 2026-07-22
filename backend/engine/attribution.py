"""
Host-plane ATT&CK technique attribution.

Serves the classifier fitted by ml/eval_attribution.py. Its accuracy is not asserted here:
the artifact carries the leave-one-dataset-out top-1 figure that was measured on captures
the model had never seen, and every prediction returned by this module is stamped with it so
a consumer can weigh the answer.

Consumers get a ranked list, not a single verdict. At 54% top-1 and 80% top-3, presenting one
technique as certain would misrepresent what the model actually knows.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

from utils.mitre_loader import technique as lookup_technique

ARTIFACT = Path(__file__).resolve().parent.parent / "ml" / "artifacts" / "attributor.joblib"
SAMPLE = Path(__file__).resolve().parent.parent / "data" / "samples" / "attack_events_sample.json"

TOP_K = 3

_lock = threading.Lock()
_bundle: dict | None = None
_error: str | None = None
_corpus: dict | None = None


def _load() -> dict | None:
    global _bundle, _error
    if _bundle is not None or _error is not None:
        return _bundle
    with _lock:
        if _bundle is None and _error is None:
            try:
                import joblib

                _bundle = joblib.load(ARTIFACT)
            except Exception as exc:
                _error = f"{type(exc).__name__}: {exc}"
    return _bundle


def is_available() -> bool:
    return _load() is not None


def status() -> dict:
    bundle = _load()
    if bundle is None:
        return {"available": False, "error": _error}
    return {
        "available": True,
        "measured_top1_accuracy": bundle["top1_accuracy"],
        "techniques_known": len(bundle["technique_names"]),
        "method": "TF-IDF over host-event behaviour tokens -> logistic regression",
    }


def describe(technique_id: str) -> dict:
    """Name a technique, following ATT&CK revocations where the corpus label is stale."""
    details = lookup_technique(technique_id) or {}
    return {
        "id": technique_id,
        "name": details.get("name", ""),
        "tactic": details.get("tactic", "Unknown"),
        "resolved_to": details.get("id") if details.get("resolved_from") else None,
    }


def attribute(tokens: list[str]) -> dict:
    """Rank ATT&CK techniques for one capture's behaviour tokens."""
    bundle = _load()
    if bundle is None:
        return {"available": False, "error": _error, "ranked": []}

    pipeline = bundle["pipeline"]
    probabilities = pipeline.predict_proba([tokens])[0]
    order = sorted(range(len(probabilities)), key=lambda i: probabilities[i], reverse=True)

    ranked = [{**describe(pipeline.classes_[i]), "confidence": round(float(probabilities[i]), 4)}
              for i in order[:TOP_K]]
    return {
        "available": True,
        "ranked": ranked,
        "top": ranked[0] if ranked else None,
        "measured_top1_accuracy": bundle["top1_accuracy"],
        "caveat": "Ranked, not certain — measured leave-one-dataset-out top-1 accuracy is "
                  f"{bundle['top1_accuracy']:.0%}.",
    }


def corpus() -> dict:
    """The committed slice of real ATT&CK-labelled host captures."""
    global _corpus
    if _corpus is None:
        _corpus = json.loads(SAMPLE.read_text(encoding="utf-8")) if SAMPLE.exists() else \
            {"datasets": [], "source": "unavailable"}
    return _corpus
