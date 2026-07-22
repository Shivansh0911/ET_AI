"""
Zeek conn.log -> model feature vector.

The largest gap between this prototype and a deployment is that the detector eats
CICFlowMeter features — `Bwd Packet Length Std`, `Flow IAT Mean`, `Active Std` — and no
production network emits those. Real infrastructure runs Zeek, NetFlow/IPFIX, or vendor EDR.
Without an adapter the model cannot score a single real packet, and that is invisible from
the demo.

This closes part of it honestly rather than pretending. Of the 69 features the model uses,
Zeek's conn.log supports a minority directly, a few by approximation, and the rest not at all
because conn.log aggregates a connection instead of describing every packet in it. Those are
zero-filled and COUNTED, so a caller knows how much of the vector is real.

The point is not that this is production-ready. The point is that the path is measurable:
`coverage()` returns exactly what fraction of the feature space survives the translation, so
the deployment conversation starts from a number instead of a shrug.

Sensor requirements to close the rest are stated in MAPPING notes: packet-level timing and
size distributions need either Zeek's packet-level analyzers, an IPFIX exporter configured
for per-packet metrics, or CICFlowMeter itself on a span port.
"""
from __future__ import annotations

import json
from typing import Iterable

import numpy as np

from . import detector

# Zeek conn.log fields: ts, uid, id.orig_h, id.orig_p, id.resp_h, id.resp_p, proto, service,
# duration, orig_bytes, resp_bytes, conn_state, orig_pkts, orig_ip_bytes, resp_pkts,
# resp_ip_bytes.  "orig" is forward, "resp" is backward.

DIRECT = {
    "Destination Port": lambda c: c["id.resp_p"],
    "Flow Duration": lambda c: c["duration"] * 1_000_000,          # Zeek seconds -> CIC microseconds
    "Total Fwd Packets": lambda c: c["orig_pkts"],
    "Total Backward Packets": lambda c: c["resp_pkts"],
    "Total Length of Fwd Packets": lambda c: c["orig_bytes"],
    "Total Length of Bwd Packets": lambda c: c["resp_bytes"],
    "Subflow Fwd Bytes": lambda c: c["orig_bytes"],
    "Subflow Bwd Bytes": lambda c: c["resp_bytes"],
    "Subflow Fwd Packets": lambda c: c["orig_pkts"],
    "Subflow Bwd Packets": lambda c: c["resp_pkts"],
}

# Derivable from the aggregate, but only as a mean — conn.log has no per-packet detail, so
# the distribution shape (std, variance, min, max) genuinely is not recoverable.
APPROXIMATE = {
    "Fwd Packet Length Mean": lambda c: c["orig_bytes"] / max(c["orig_pkts"], 1),
    "Bwd Packet Length Mean": lambda c: c["resp_bytes"] / max(c["resp_pkts"], 1),
    "Avg Fwd Segment Size": lambda c: c["orig_bytes"] / max(c["orig_pkts"], 1),
    "Avg Bwd Segment Size": lambda c: c["resp_bytes"] / max(c["resp_pkts"], 1),
    "Packet Length Mean": lambda c: ((c["orig_bytes"] + c["resp_bytes"])
                                     / max(c["orig_pkts"] + c["resp_pkts"], 1)),
    "Average Packet Size": lambda c: ((c["orig_bytes"] + c["resp_bytes"])
                                      / max(c["orig_pkts"] + c["resp_pkts"], 1)),
    "Flow Bytes/s": lambda c: (c["orig_bytes"] + c["resp_bytes"]) / max(c["duration"], 1e-6),
    "Flow Packets/s": lambda c: (c["orig_pkts"] + c["resp_pkts"]) / max(c["duration"], 1e-6),
    "Fwd Packets/s": lambda c: c["orig_pkts"] / max(c["duration"], 1e-6),
    "Bwd Packets/s": lambda c: c["resp_pkts"] / max(c["duration"], 1e-6),
    "Down/Up Ratio": lambda c: c["resp_bytes"] / max(c["orig_bytes"], 1),
    "Flow IAT Mean": lambda c: (c["duration"] * 1_000_000
                                / max(c["orig_pkts"] + c["resp_pkts"] - 1, 1)),
}

REQUIRED = ("duration", "orig_bytes", "resp_bytes", "orig_pkts", "resp_pkts", "id.resp_p")

UNAVAILABLE_NOTE = (
    "conn.log summarises a connection, so per-packet dispersion (std, variance, min, max), "
    "inter-arrival distributions, TCP flag counts and active/idle timings are absent. Closing "
    "those needs packet-level telemetry: Zeek's packet analyzers, an IPFIX exporter configured "
    "for per-packet metrics, or CICFlowMeter on a span port."
)


def _defaults(record: dict) -> dict:
    clean = dict(record)
    for field in REQUIRED:
        value = clean.get(field)
        # Zeek writes "-" for unset numeric fields.
        clean[field] = 0.0 if value in (None, "-", "") else float(value)
    return clean


def coverage() -> dict:
    """How much of the feature space this adapter actually fills."""
    features = detector.feature_names()
    if not features:
        return {"available": False, "reason": "detector artifact not loaded"}

    direct = [f for f in features if f in DIRECT]
    approximate = [f for f in features if f in APPROXIMATE]
    missing = [f for f in features if f not in DIRECT and f not in APPROXIMATE]

    return {
        "available": True,
        "source": "Zeek conn.log",
        "model_features": len(features),
        "direct": len(direct),
        "approximated": len(approximate),
        "unavailable": len(missing),
        "coverage_pct": round(100 * (len(direct) + len(approximate)) / len(features), 1),
        "direct_fields": direct,
        "approximated_fields": approximate,
        "unavailable_fields": missing,
        "note": UNAVAILABLE_NOTE,
        "honesty": "Unavailable features are zero-filled. A vector that is mostly zeros is not "
                   "the vector the model was trained on, so scores from this adapter are "
                   "indicative only until packet-level telemetry is added.",
    }


def to_vector(record: dict) -> np.ndarray:
    """Translate one Zeek conn.log record into the model's feature order."""
    features = detector.feature_names()
    clean = _defaults(record)
    vector = np.zeros(len(features), dtype=np.float32)

    for index, name in enumerate(features):
        source = DIRECT.get(name) or APPROXIMATE.get(name)
        if source is None:
            continue
        try:
            vector[index] = float(source(clean))
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            vector[index] = 0.0
    return vector


def score_conn_log(lines: Iterable[str]) -> dict:
    """Score Zeek JSON conn.log lines. Returns scores plus the coverage caveat."""
    records = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    if not records:
        return {"scored": 0, "results": [], "coverage": coverage()}

    vectors = np.vstack([to_vector(r) for r in records])
    probabilities = detector.score(vectors)
    cutoff = detector.threshold()

    return {
        "scored": len(records),
        "results": [
            {
                "uid": record.get("uid"),
                "source_ip": record.get("id.orig_h"),
                "dest_ip": record.get("id.resp_h"),
                "dest_port": record.get("id.resp_p"),
                "service": record.get("service"),
                "score": round(float(probability), 4),
                "flagged": bool(probability >= cutoff),
            }
            for record, probability in zip(records, probabilities)
        ],
        "coverage": coverage(),
    }
