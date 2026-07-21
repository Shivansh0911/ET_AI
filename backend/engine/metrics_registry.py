"""
Single source of truth for every number the dashboard displays.

Each entry declares its own provenance: `measured` values were produced by a script in
ml/ or timed at runtime; `cited` values come from published research and are attributed.
Nothing in this module is a constant typed in to look good — the previous build's
mttd_minutes=4.2 / mttr_minutes=12.8 are gone, and this registry exists so they cannot
quietly come back.
"""
from __future__ import annotations

import json
from pathlib import Path

METRICS = Path(__file__).resolve().parent.parent / "metrics"

# Published dwell-time reference, used ONLY as a labelled comparison baseline. We did not
# measure this and the UI must never present it as our result.
BASELINE_DWELL = {
    "label": "Global median attacker dwell time before detection",
    "value_days": 10,
    "source": "Mandiant M-Trends 2024 (global median dwell time, 10 days)",
    "provenance": "cited",
}


def _read(name: str) -> dict | None:
    path = METRICS / name
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def detection() -> dict:
    report = _read("detection.json")
    if not report:
        return {"available": False,
                "reason": "metrics/detection.json missing — run ml/train_detector.py"}
    return {
        "available": True,
        "provenance": "measured",
        "dataset": report["dataset"],
        "source": report["source"],
        "model": report["model"],
        "precision": report["precision"],
        "recall": report["recall"],
        "f1": report["f1"],
        "false_positive_rate": report["false_positive_rate"],
        "false_negative_rate": report["false_negative_rate"],
        "roc_auc": report["roc_auc"],
        "test_rows": report["test_rows"],
        "test_attack_rows": report["test_attack_rows"],
        "test_benign_rows": report["test_benign_rows"],
        "confusion": report["confusion"],
        "per_family_detection_rate": report["per_family_detection_rate"],
        "evaluated_at": report["evaluated_at"],
        "caveats": report.get("honesty", []),
    }


def attribution() -> dict:
    report = _read("attribution.json")
    if not report:
        return {"available": False,
                "reason": "metrics/attribution.json missing — run ml/eval_attribution.py"}
    return {"available": True, "provenance": "measured", **report}


def dataset_report() -> dict:
    return _read("dataset_report.json") or {"available": False}


def snapshot(latency: dict | None = None, automation: dict | None = None) -> dict:
    """Assemble the payload the dashboard reads. Every block carries its provenance."""
    return {
        "detection": detection(),
        "attribution": attribution(),
        "latency": {"provenance": "measured", **latency} if latency else
                   {"available": False, "reason": "no events processed yet"},
        "automation": {"provenance": "measured", **automation} if automation else
                      {"available": False, "reason": "no playbook executed yet"},
        "baseline": BASELINE_DWELL,
        "note": "Values marked 'measured' were produced by this repository's evaluation "
                "scripts or timed at request time. Values marked 'cited' come from "
                "published research and are not our own measurements.",
    }
