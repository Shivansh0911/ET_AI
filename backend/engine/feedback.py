"""
Live analyst feedback loop — the runtime half of ml/eval_continual.py.

An analyst confirms or dismisses an alert; once enough verdicts accumulate the adaptive layer
refits and starts contributing to the served score. Every retrain is written to the audit
ledger with the model version, so any later decision can be traced to the weights that made it.

Two things are deliberately NOT claimed here:

  * The live loop cannot report its own accuracy. It has no held-out set — the analyst labels
    whatever they choose to look at. The measured before/after belongs to eval_continual.py,
    where the evaluation set was fixed in advance and never touched. This module reports how
    many labels it holds and what the model did, not how good it is.
  * Feedback from one campaign does not transfer to a different later one. Setting B measured
    exactly zero improvement. The UI says so where a user might otherwise assume it does.
"""
from __future__ import annotations

import json
import os
import threading
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import detector, ledger

STORE = Path(os.environ.get(
    "FEEDBACK_STORE",
    Path(__file__).resolve().parent.parent / "data" / "analyst_feedback.jsonl"))

MIN_LABELS_TO_FIT = 12          # below this a refit is noise
MIN_PER_CLASS = 4
REFIT_EVERY = 4                 # verdicts between retrains
VERDICTS = {"confirm": 1, "dismiss": 0}

_lock = threading.Lock()
_labels: list[dict] = []
_vectors: list[np.ndarray] = []
_model = None
_cutoff = 0.6
_version = 0
_loaded = False


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    if STORE.exists():
        for line in STORE.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    _labels.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    _loaded = True


def _refit() -> dict | None:
    """Retrain on every verdict held so far. Mirrors the offline configuration exactly."""
    global _model, _version

    truth = np.array([entry["label"] for entry in _labels], dtype=np.uint8)
    counts = Counter(truth.tolist())
    if len(_labels) < MIN_LABELS_TO_FIT or min(counts.get(0, 0), counts.get(1, 0)) < MIN_PER_CLASS:
        return None

    from sklearn.ensemble import RandomForestClassifier

    rows = np.vstack(_vectors)
    model = RandomForestClassifier(n_estimators=150, max_depth=14, min_samples_leaf=2,
                                   class_weight="balanced", random_state=11, n_jobs=-1)
    model.fit(rows, truth)
    _model = model
    _version += 1

    return {"labels": len(_labels), "confirmed": int(counts.get(1, 0)),
            "dismissed": int(counts.get(0, 0)), "version": f"live-v{_version}"}


def record(alert_id: str, verdict: str, vector: list[float], base_probability: float,
           analyst: str = "soc-analyst") -> dict:
    """Store one verdict, refit when due, and write both to the audit ledger."""
    if verdict not in VERDICTS:
        raise ValueError(f"verdict must be one of {sorted(VERDICTS)}")

    with _lock:
        _ensure_loaded()
        entry = {
            "alert_id": alert_id,
            "verdict": verdict,
            "label": VERDICTS[verdict],
            "base_probability": round(float(base_probability), 6),
            "analyst": analyst,
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        _labels.append(entry)
        # Stacked exactly as in training: features plus the base model's own score.
        _vectors.append(np.append(np.asarray(vector, dtype=np.float32),
                                  np.float32(base_probability)))

        try:
            STORE.parent.mkdir(parents=True, exist_ok=True)
            with open(STORE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        except OSError:
            pass   # in-memory store stays authoritative; ephemeral disks are a hosting choice

        retrained = _refit() if len(_labels) % REFIT_EVERY == 0 else None

    ledger.append(
        actor=analyst,
        action=f"analyst_{verdict}",
        target=alert_id,
        params={"base_probability": round(float(base_probability), 4)},
        result="recorded",
        blast_radius=0,
        evidence={"labels_held": len(_labels)},
    )

    if retrained:
        ledger.append(
            actor="learning-loop",
            action="model_retrained",
            target=retrained["version"],
            params={"labels": retrained["labels"], "confirmed": retrained["confirmed"],
                    "dismissed": retrained["dismissed"]},
            result="active",
            blast_radius=0,
            evidence={"trigger": f"every {REFIT_EVERY} verdicts"},
        )

    return {"recorded": entry, "retrained": retrained, "state": state()}


def adjust(vectors: np.ndarray, base_probabilities: np.ndarray) -> np.ndarray:
    """Apply the live adaptive layer to a batch of scores. No model yet -> unchanged."""
    with _lock:
        model, cutoff = _model, _cutoff
    if model is None:
        return base_probabilities

    stacked = np.column_stack([np.asarray(vectors, dtype=np.float32), base_probabilities])
    adaptive = model.predict_proba(stacked)[:, 1]
    return np.maximum(base_probabilities, (adaptive >= cutoff).astype(float))


def state() -> dict:
    with _lock:
        _ensure_loaded()
        counts = Counter(entry["label"] for entry in _labels)
        return {
            "labels_held": len(_labels),
            "confirmed": int(counts.get(1, 0)),
            "dismissed": int(counts.get(0, 0)),
            "adaptive_active": _model is not None,
            "model_version": f"live-v{_version}" if _model else None,
            "labels_until_active": max(0, MIN_LABELS_TO_FIT - len(_labels)) if _model is None else 0,
            "requirements": {"min_labels": MIN_LABELS_TO_FIT, "min_per_class": MIN_PER_CLASS,
                             "refit_every": REFIT_EVERY},
            "detector_threshold": detector.threshold(),
            "caveat": "This loop cannot report its own accuracy — the analyst chooses what to "
                      "label, so there is no held-out set. The measured before/after lives in "
                      "metrics/continual.json, where the evaluation set was fixed in advance.",
        }


def reset() -> dict:
    """Clear live feedback. Demo affordance — the audit ledger keeps the history regardless."""
    global _model, _version, _loaded
    with _lock:
        _labels.clear()
        _vectors.clear()
        _model = None
        _version = 0
        _loaded = True
        try:
            STORE.unlink(missing_ok=True)
        except OSError:
            pass
    ledger.append(actor="operator", action="feedback_reset", target="live-loop",
                  result="cleared", blast_radius=0)
    return state()
