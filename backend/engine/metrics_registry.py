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
    """Headline detection metrics — the cross-capture split, not the flattering one.

    metrics/detection.json (random per-family split, 99.8% recall) is still read, but only as
    a labelled comparison. Near-duplicate flows from one attack burst landed on both sides of
    that split, so quoting it as the headline would overstate what the model can do on traffic
    it has not seen.
    """
    report = _read("baseline.json")
    if not report:
        return {"available": False,
                "reason": "metrics/baseline.json missing — run ml/train_base.py"}

    cross = report["cross_day"]
    superseded = _read("detection.json") or {}
    return {
        "available": True,
        "provenance": "measured",
        "dataset": report["dataset"],
        "split": report["headline_split"],
        "why_this_split": report["why"],
        "model_version": report.get("model_version"),
        "precision": cross["precision"],
        "recall": cross["recall"],
        "f1": cross["f1"],
        "false_positive_rate": cross["false_positive_rate"],
        "false_negative_rate": cross["false_negative_rate"],
        "roc_auc": cross.get("roc_auc") or cross.get("roc_auc_supervised"),
        "test_rows": cross["rows"],
        "test_attack_rows": cross["tp"] + cross["fn"],
        "test_benign_rows": cross["tn"] + cross["fp"],
        "confusion": {k: cross[k] for k in ("tp", "fp", "tn", "fn")},
        "alerts_per_1000_flows": cross.get("alerts_per_1000_flows"),
        "architecture": report.get("architecture"),
        "false_positive_budget": report.get("fpr_budget"),
        # Campaign-level detection is a DIFFERENT denominator from per-flow recall and is
        # labelled as such everywhere it is displayed.
        "campaign_level": report.get("campaign_level", {}),
        "supervised_only": report.get("supervised_only", {}),
        "novelty_head": report.get("novelty_head_chosen"),
        "novelty_selection": report.get("novelty_selection", {}),
        "all_variants": report.get("all_variants", {}),
        "per_family_detection_rate": {
            name: {"n": stat["n"], "detected": round(stat["n"] * stat["recall"]),
                   "rate": stat["recall"]}
            for name, stat in report["per_family_recall"].items()},
        "trivial_baselines": {
            name: {"f1": stat["f1"], "recall": stat["recall"], "precision": stat["precision"]}
            for name, stat in report["trivial_baselines_same_split"].items()},
        "superseded_random_split": {
            "recall": superseded.get("recall"),
            "precision": superseded.get("precision"),
            "note": "Random per-family split. Retained for comparison only: near-duplicate "
                    "flows from one attack burst fall on both sides of it.",
        },
        "evaluated_at": report["evaluated_at"],
        "caveats": report.get("honesty", []),
    }


def _legacy_detection() -> dict:
    report = _read("detection.json")
    if not report:
        return {"available": False}
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


def continual() -> dict:
    report = _read("continual.json")
    if not report:
        return {"available": False,
                "reason": "metrics/continual.json missing — run ml/eval_continual.py"}
    return {"available": True, "provenance": "measured", **report}


def attribution() -> dict:
    report = _read("attribution.json")
    if not report:
        return {"available": False,
                "reason": "metrics/attribution.json missing — run ml/eval_attribution.py"}
    return {"available": True, "provenance": "measured", **report}


def fusion() -> dict:
    report = _read("fusion.json")
    if not report:
        return {"available": False,
                "reason": "metrics/fusion.json missing — run ml/eval_fusion.py"}
    return {"available": True, "provenance": "measured", **report}


def dataset_report() -> dict:
    return _read("dataset_report.json") or {"available": False}


def snapshot(latency: dict | None = None, automation: dict | None = None) -> dict:
    """Assemble the payload the dashboard reads. Every block carries its provenance."""
    return {
        "detection": detection(),
        "continual_learning": continual(),
        "attribution": attribution(),
        "fusion": fusion(),
        "latency": {"provenance": "measured", **latency} if latency else
                   {"available": False, "reason": "no events processed yet"},
        "automation": {"provenance": "measured", **automation} if automation else
                      {"available": False, "reason": "no playbook executed yet"},
        "baseline": BASELINE_DWELL,
        "note": "Values marked 'measured' were produced by this repository's evaluation "
                "scripts or timed at request time. Values marked 'cited' come from "
                "published research and are not our own measurements.",
    }
