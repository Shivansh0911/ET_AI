"""
Measure what cross-plane fusion actually buys.

The claim being tested: some genuine attacks score below the detector's threshold and are
therefore invisible to a single-sensor pipeline, but become visible when a sub-threshold flow
coincides with an attributed host technique on the same asset.

The counterfactual is explicit — with fusion off, only flows at or above the threshold alert.
Both sides of the ledger are reported: true attacks recovered, and benign flows wrongly
promoted.

Evaluation runs over many independent replay windows rather than the whole sample at once.
Compressing 5,520 flows into a single 24-hour timeline saturates every correlation window
with confident detections, which measures the compression, not the method. Each window here
has the same size and class balance the live API serves.

Output: metrics/fusion.json

Usage:  python ml/eval_fusion.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from engine import detector, fusion, replay  # noqa: E402

METRICS = BACKEND / "metrics"
WINDOWS = 25
WINDOW_EVENTS = 600


def main() -> int:
    if not detector.is_available():
        print("Detector artifact missing — run ml/train_detector.py")
        return 1

    threshold = detector.threshold()
    hosts = fusion.host_signals()

    totals = {"incidents": 0, "fusion_only": 0, "recovered": 0, "promoted_benign": 0,
              "weak_flows": 0, "weak_attacks": 0, "attacks": 0, "missed_by_detector": 0,
              "flows": 0}
    families: set[str] = set()

    for seed in range(WINDOWS):
        stream = replay.build_stream(WINDOW_EVENTS, seed=seed)
        events = stream["events"]
        result = fusion.correlate(events, hosts, threshold=threshold)
        summary = result["summary"]

        attacks = [e for e in events if e["ground_truth"]["is_attack"]]
        missed = [e for e in attacks if e["anomaly_score"] < threshold]
        weak = [e for e in events if fusion.WEAK_FLOOR <= e["anomaly_score"] < threshold]
        weak_attacks = [e for e in weak if e["ground_truth"]["is_attack"]]
        families.update(e["ground_truth"]["family"] for e in weak_attacks)

        totals["flows"] += len(events)
        totals["attacks"] += len(attacks)
        totals["missed_by_detector"] += len(missed)
        totals["weak_flows"] += len(weak)
        totals["weak_attacks"] += len(weak_attacks)
        totals["incidents"] += summary["incidents"]
        totals["fusion_only"] += summary["fusion_only_incidents"]
        totals["recovered"] += summary["true_attacks_recovered"]
        totals["promoted_benign"] += summary["benign_flows_promoted"]

    report = {
        "question": "How many genuine attacks does cross-plane fusion surface that the "
                    "network detector alone discards?",
        "method": f"{WINDOWS} independent replay windows of {WINDOW_EVENTS} flows each, at the "
                  "held-out split's real class balance; incidents are cross-plane "
                  f"co-occurrences within a {fusion.BUCKET_MINUTES}-minute window on one asset",
        "windows": WINDOWS,
        "flows_evaluated": totals["flows"],
        "attacks_in_sample": totals["attacks"],
        "detector_alone": {
            "threshold": threshold,
            "attacks_missed": totals["missed_by_detector"],
            "note": "Flows below the decision threshold raise no alert in a single-sensor "
                    "pipeline, whatever their true label.",
        },
        "weak_band": {
            "range": [fusion.WEAK_FLOOR, threshold],
            "flows": totals["weak_flows"],
            "genuine_attacks": totals["weak_attacks"],
            "families": sorted(families),
        },
        "with_fusion": {
            "incidents": totals["incidents"],
            "fusion_only_incidents": totals["fusion_only"],
            "true_attacks_recovered": totals["recovered"],
            "benign_flows_promoted": totals["promoted_benign"],
            "recovery_rate_of_weak_attacks":
                round(totals["recovered"] / max(totals["weak_attacks"], 1), 4),
            "recovery_rate_of_all_missed":
                round(totals["recovered"] / max(totals["missed_by_detector"], 1), 4),
            "incidents_per_window": round(totals["incidents"] / WINDOWS, 2),
        },
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "honesty": [
            "Recovery is bounded by co-occurrence: a weak flow is promoted only when a host "
            "capture lands on the same asset and window, so the rate reflects host-plane "
            "coverage as much as it reflects the method.",
            "Benign flows promoted are reported next to attacks recovered — fusion trades "
            "precision for recall and both sides belong in the number.",
            "Host captures are real OTRF telemetry with ground-truth technique labels; their "
            "placement onto assets and windows is illustrative, so this measures the "
            "mechanism rather than a field deployment.",
        ],
    }

    METRICS.mkdir(parents=True, exist_ok=True)
    (METRICS / "fusion.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"{WINDOWS} windows | {totals['flows']:,} flows | {totals['attacks']:,} attacks")
    print(f"detector alone missed {totals['missed_by_detector']} attacks; weak band holds "
          f"{totals['weak_attacks']} of them")
    print(f"fusion raised {totals['incidents']} incidents, {totals['fusion_only']} of which no "
          "single sensor would have raised")
    print(f"  recovered {totals['recovered']} true attacks "
          f"({report['with_fusion']['recovery_rate_of_weak_attacks']:.1%} of the weak band), "
          f"promoted {totals['promoted_benign']} benign flows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
