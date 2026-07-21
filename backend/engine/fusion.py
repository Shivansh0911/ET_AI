"""
Correlation engine — compound incidents from cross-plane weak signals.

The problem statement asks for correlation of "weak signals across heterogeneous IT and OT
environments". A single-sensor pipeline cannot do this by construction: it sees one plane and
applies one threshold, so anything below that threshold is discarded silently.

Two independent planes are fused here:

  network plane   CIC-IDS2017 flow features -> RandomForest probability
  host plane      OTRF Windows captures     -> ATT&CK technique attribution

A flow scoring below the 0.5 decision threshold raises no alert on its own. In the committed
sample, 102 flows sit in the 0.20-0.50 band and 99 of them are genuine attacks — real false
negatives, mostly Bot traffic, which is exactly where the detector's per-family recall is
weakest (66%). When one of those weak flows shares an asset and a time window with a host
capture attributed to an ATT&CK technique, the pair is promoted to a compound incident.

The value of that promotion is measurable rather than rhetorical: count the true attacks that
were sub-threshold on the network plane and only surfaced through fusion, and count the benign
flows wrongly promoted as the cost side of the same ledger. See ml/eval_fusion.py.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from . import attribution
from .assets import ASSET_NAMES, ASSETS

WEAK_FLOOR = 0.20        # below this a flow is noise, not a signal
BUCKET_MINUTES = 60
HOST_CONFIDENT = 0.60    # host attributions at or above this are strong on their own


def bucket_of(timestamp: str) -> str:
    """Coarsen a timestamp to the correlation window it belongs to."""
    try:
        moment = datetime.fromisoformat(timestamp)
    except (TypeError, ValueError):
        return "unknown"
    minute = (moment.minute // BUCKET_MINUTES) * BUCKET_MINUTES
    return moment.replace(minute=minute, second=0, microsecond=0).isoformat()


def window_label(slot: str) -> str:
    """'2026-07-21T14:00:00+00:00' -> '2107-1400', stable and readable in an incident id."""
    try:
        moment = datetime.fromisoformat(slot)
    except (TypeError, ValueError):
        return "unknown"
    return moment.strftime("%d%m-%H%M")


def host_signals() -> list[dict]:
    """Attribute each committed host capture and place it on an asset and time bucket.

    The asset/time placement is illustrative in exactly the way the network overlay is —
    what is real here is the capture, its telemetry, and the technique the model assigns.
    """
    datasets = attribution.corpus().get("datasets", [])
    signals = []

    for position, dataset in enumerate(datasets):
        result = attribution.attribute(dataset["tokens"])
        top = result.get("top")
        if not top:
            continue

        asset = ASSET_NAMES[position % len(ASSET_NAMES)]
        signals.append({
            "id": dataset["dataset_id"],
            "plane": "host",
            "asset": asset,
            "title": dataset["title"],
            "technique": top["id"],
            "technique_name": top["name"],
            "tactic": top["tactic"],
            "confidence": top["confidence"],
            "strong": top["confidence"] >= HOST_CONFIDENT,
            "ground_truth": dataset["techniques"],
            "event_count": dataset["event_count"],
            "sample_events": dataset["sample_events"][:3],
            "spread": position / max(len(datasets), 1),
        })
    return signals


def correlate(network_events: list[dict], hosts: list[dict], threshold: float = 0.5) -> dict:
    """Group both planes by asset and time bucket, then promote cross-plane coincidences."""
    buckets: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"network": [], "host": [], "weak_network": []})

    ordered_buckets: list[str] = []
    for event in network_events:
        score = event.get("anomaly_score", 0.0)
        if score < WEAK_FLOOR:
            continue
        slot = bucket_of(event["timestamp"])
        if slot not in ordered_buckets:
            ordered_buckets.append(slot)
        entry = buckets[(event["asset"], slot)]
        entry["network"].append(event)
        if score < threshold:
            entry["weak_network"].append(event)

    # Host captures carry their own lab timestamps, which are years apart from the replayed
    # flow window. Placing them on the replay's own buckets keeps the correlation honest
    # about what it is: a co-occurrence test, not a claim about absolute clock time.
    ordered_buckets.sort()
    for signal in hosts:
        if not ordered_buckets:
            break
        # Spread the captures evenly across the replayed window rather than piling them
        # onto its oldest slots, which is what indexing by a raw counter would do.
        index = min(int(signal["spread"] * len(ordered_buckets)), len(ordered_buckets) - 1)
        buckets[(signal["asset"], ordered_buckets[index])]["host"].append(signal)

    incidents = []
    for (asset, slot), entry in buckets.items():
        if not entry["host"] or not entry["network"]:
            continue

        strong_network = [e for e in entry["network"] if e.get("anomaly_score", 0) >= threshold]
        fusion_only = not strong_network

        recovered = [e for e in entry["weak_network"]
                     if e.get("ground_truth", {}).get("is_attack")] if fusion_only else []
        promoted_benign = [e for e in entry["weak_network"]
                           if not e.get("ground_truth", {}).get("is_attack")] if fusion_only else []

        incidents.append({
            "id": f"INC-{asset}-{window_label(slot)}",
            "asset": asset,
            "location": ASSETS[asset]["city"],
            "lat": ASSETS[asset]["lat"],
            "lng": ASSETS[asset]["lng"],
            "window": slot,
            "fusion_only": fusion_only,
            "severity": "high" if fusion_only else "critical",
            "network_signals": len(entry["network"]),
            "weak_network_signals": len(entry["weak_network"]),
            "strong_network_signals": len(strong_network),
            "host_signals": len(entry["host"]),
            "techniques": sorted({h["technique"] for h in entry["host"]}),
            "technique_names": sorted({h["technique_name"] for h in entry["host"] if h["technique_name"]}),
            "recovered_true_attacks": len(recovered),
            "promoted_benign_flows": len(promoted_benign),
            "evidence": {
                "network": [{"id": e["id"], "score": e["anomaly_score"],
                             "family": e.get("ground_truth", {}).get("family"),
                             "source_ip": e["source_ip"]}
                            for e in entry["network"][:5]],
                "host": [{"id": h["id"], "title": h["title"], "technique": h["technique"],
                          "confidence": h["confidence"]} for h in entry["host"][:3]],
            },
            "rationale": ("No flow in this window crossed the detection threshold; the incident "
                          "exists only because sub-threshold network activity coincided with an "
                          "attributed host technique on the same asset."
                          if fusion_only else
                          "A confirmed network detection coincides with attributed host activity "
                          "on the same asset."),
        })

    incidents.sort(key=lambda i: (not i["fusion_only"], i["window"]), reverse=True)

    fusion_only = [i for i in incidents if i["fusion_only"]]
    return {
        "incidents": incidents,
        "summary": {
            "incidents": len(incidents),
            "fusion_only_incidents": len(fusion_only),
            "true_attacks_recovered": sum(i["recovered_true_attacks"] for i in fusion_only),
            "benign_flows_promoted": sum(i["promoted_benign_flows"] for i in fusion_only),
            "weak_band": [WEAK_FLOOR, threshold],
            "bucket_minutes": BUCKET_MINUTES,
        },
        "method": "co-occurrence of network and host plane signals on one asset within a "
                  f"{BUCKET_MINUTES}-minute window; 'fusion_only' means no single signal in "
                  "the window would have alerted on its own",
    }
