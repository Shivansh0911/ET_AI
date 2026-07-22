"""
Replay engine: streams unseen CIC-IDS2017 captures through the real detector.

Flows come from data/samples/cicids_sample.csv, drawn from Thursday and Friday — capture
days the base detector was never trained on, since it saw Monday through Wednesday only.
That is deliberate: the demo should show the model meeting traffic it does not know, which
is where the analyst feedback loop earns its place. Scoring latency is measured with a real
timer, so the dashboard's latency figure is observed rather than asserted.

The served score is the frozen model's probability unless analysts have labelled enough
alerts for the adaptive layer to fit, at which point engine.feedback can raise it.

The dataset's own label is carried on each event as `ground_truth`, used only to display
whether a given detection was correct. It is never an input to detection; the detector
sees numeric features and nothing else.
"""
from __future__ import annotations

import csv
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

import numpy as np

from . import detector, feedback
from .assets import PROVENANCE, asset_for

SAMPLE = Path(__file__).resolve().parent.parent / "data" / "samples" / "cicids_sample.csv"
LABEL_COLUMN = "Label"
BENIGN = "BENIGN"
WINDOW_HOURS = 24

# Curated CIC-IDS2017 attack-family -> ATT&CK technique mapping. This is a hand-authored
# lookup, NOT a learned attribution, and is labelled as such wherever it surfaces. The
# measured attribution accuracy claim comes from the OTRF corpus instead (ml/eval_attribution.py).
FAMILY_TECHNIQUE = {
    "Bot": "T1071",
    "DDoS": "T1498",
    "DoS GoldenEye": "T1499",
    "DoS Hulk": "T1499",
    "DoS Slowhttptest": "T1499",
    "DoS slowloris": "T1499",
    "FTP-Patator": "T1110",
    "SSH-Patator": "T1110",
    "Heartbleed": "T1203",
    "Infiltration": "T1204",
    "PortScan": "T1046",
    "Web Attack - Brute Force": "T1110",
    "Web Attack - Sql Injection": "T1190",
    "Web Attack - XSS": "T1189",
}

_cache: dict | None = None


def _load_sample() -> dict:
    """Read the committed sample once and mask it down to the model's feature set."""
    global _cache
    if _cache is not None:
        return _cache

    with open(SAMPLE, newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))

    header, body = rows[0], rows[1:]
    label_index = header.index(LABEL_COLUMN)
    columns = [c for i, c in enumerate(header) if i != label_index]

    values = np.array([[r[i] for i in range(len(r)) if i != label_index] for r in body],
                      dtype=np.float32)
    labels = [r[label_index] for r in body]

    wanted = detector.feature_names()
    if wanted:
        index = {name: i for i, name in enumerate(columns)}
        missing = [n for n in wanted if n not in index]
        if missing:
            raise RuntimeError(f"sample is missing model features: {missing[:3]}")
        values = values[:, [index[n] for n in wanted]]

    _cache = {"X": values, "labels": labels, "columns": columns}
    return _cache


def describe(family: str, probability: float) -> str:
    if family == BENIGN:
        return "Flow within learned benign behaviour profile"
    return f"Flow scored {probability:.2f} against the benign baseline (dataset family: {family})"


def _compose(labels: list[str], limit: int, attack_ratio: float, rng) -> np.ndarray:
    """Pick row indices whose class balance mirrors the real held-out split.

    The committed sample is stratified per attack family so that rare classes survive,
    which leaves it ~91% attack — replaying it as-is would paint a dashboard where almost
    everything is malicious. Re-weighting here reproduces the test split's actual 17%
    attack share, so the detection counts on screen are representative.
    """
    attack_pool = np.array([i for i, label in enumerate(labels) if label != BENIGN])
    benign_pool = np.array([i for i, label in enumerate(labels) if label == BENIGN])

    want_attack = min(int(round(limit * attack_ratio)), len(attack_pool))
    want_benign = min(limit - want_attack, len(benign_pool))

    chosen = np.concatenate([
        rng.choice(attack_pool, want_attack, replace=False),
        rng.choice(benign_pool, want_benign, replace=False),
    ])
    rng.shuffle(chosen)
    return chosen


def build_stream(limit: int = 600, seed: int = 7, attack_ratio: float = 0.17) -> dict:
    """Score `limit` held-out flows and return events plus measured latency."""
    sample = _load_sample()
    rng = np.random.default_rng(seed)
    order = _compose(sample["labels"], limit, attack_ratio, rng)

    X = sample["X"][order]
    labels = [sample["labels"][i] for i in order]

    started = time.perf_counter()
    base_probabilities = detector.score(X)
    elapsed_ms = (time.perf_counter() - started) * 1000

    # The live adaptive layer, if analysts have labelled enough alerts to fit one. Before that
    # it is a no-op and the served score is the frozen model's, unchanged.
    probabilities = feedback.adjust(X, base_probabilities)
    adapted = int((probabilities != base_probabilities).sum())

    # Per-event latency is measured again individually so the reported p50/p95 reflect
    # single-event processing rather than the amortised cost of one big batch.
    per_event: list[float] = []
    for row in X[: min(120, len(X))]:
        tick = time.perf_counter()
        detector.score(row.reshape(1, -1))
        per_event.append((time.perf_counter() - tick) * 1000)

    cutoff = detector.threshold()
    now = datetime.now(timezone.utc)
    step = timedelta(hours=WINDOW_HOURS) / max(len(order), 1)

    events = []
    for position, (probability, base_probability, family) in enumerate(
            zip(probabilities, base_probabilities, labels)):
        asset_name, asset = asset_for(position)
        is_attack_truth = family != BENIGN
        flagged = bool(probability >= cutoff)
        octet = 1 + (position * 7) % 253

        events.append({
            "id": f"flow-{int(order[position]):05d}",
            "timestamp": (now - step * position).isoformat(timespec="seconds"),
            "source_ip": (f"{45 + position % 180}.{position % 254}.{(position * 3) % 254}.{octet}"
                          if is_attack_truth else f"{asset['subnet']}.{octet}"),
            "dest_ip": f"{asset['subnet']}.{1 + (position * 11) % 253}",
            "event_type": "network_flow",
            "description": describe(family, float(probability)),
            "anomaly_score": round(float(probability), 4),
            "base_score": round(float(base_probability), 4),
            "surfaced_by_feedback": bool(probability != base_probability),
            "detected": flagged,
            "severity": detector.severity_for(float(probability)),
            "asset": asset_name,
            "location": asset["city"],
            "lat": asset["lat"],
            "lng": asset["lng"],
            "infra_type": asset["type"],
            "mitre_id": FAMILY_TECHNIQUE.get(family) if flagged and is_attack_truth else None,
            "ground_truth": {"family": family, "is_attack": is_attack_truth,
                             "correct": flagged == is_attack_truth},
        })

    per_event.sort()
    return {
        "events": events,
        "vectors": X,
        "provenance": PROVENANCE,
        "model": {"version": detector.version(),
                  "adapted_scores": adapted,
                  "feedback": feedback.state()},
        "latency": {
            "label": "pipeline detection latency, measured (feature vector -> scored detection)",
            "p50_ms": round(per_event[len(per_event) // 2], 3) if per_event else None,
            "p95_ms": round(per_event[int(len(per_event) * 0.95) - 1], 3) if per_event else None,
            "batch_ms_per_event": round(elapsed_ms / max(len(order), 1), 4),
            "sampled_events": len(per_event),
        },
        "source": "CIC-IDS2017 Thursday/Friday captures — days the base model was never "
                  "trained on (it saw Monday, Tuesday and Wednesday only)",
        "composition": {
            "events": len(order),
            "ground_truth_attack_share": round(
                sum(1 for label in labels if label != BENIGN) / max(len(labels), 1), 4),
            "note": "Stream is re-weighted to a realistic 17% attack share; the committed "
                    "sample is family-stratified so rare classes survive.",
        },
    }


def anomalies_from(events: list[dict]) -> Iterator[dict]:
    """Detections, newest first — what the model flagged, not what the label says."""
    return (e for e in events if e["detected"])
