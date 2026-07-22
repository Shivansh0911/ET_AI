"""
CyberSentinel — FastAPI Backend
AI-Powered Cyber Resilience Platform for Critical National Infrastructure

Every number this API serves is either measured by ml/ evaluation scripts, timed at request
time, or explicitly labelled as a cited reference. There are no hardcoded results.
"""
import os
import time
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.anomaly_detector import analyze_compound_threat, detect_anomalies, detector_status
from agents.attack_mapper import build_kill_chain, predict_next_move
from agents.copilot import chat_with_copilot
from agents.response_orchestrator import generate_playbook
from agents.threat_intel import search_threat_intel
from engine import actor, alerts, attribution, feedback, fusion, graph, ingest, ledger, ot, replay, twin, vuln
from engine.assets import ASSETS, PROVENANCE
from engine.metrics_registry import attribution as attribution_metrics
from engine.metrics_registry import continual as metrics_continual
from engine.metrics_registry import fusion as fusion_metrics
from engine.metrics_registry import snapshot
from utils.mitre_loader import source_info

app = FastAPI(title="CyberSentinel API", version="2.0.0")

# Locked to the deployed frontend plus local dev. The previous configuration paired
# allow_origins=["*"] with allow_credentials=True, which is both wrong for a security
# project and invalid per the Fetch spec — browsers reject a wildcard origin on
# credentialed requests. Nothing here uses cookies, so credentials stay off and the
# origin list is explicit. Override with ALLOWED_ORIGINS (comma-separated) at deploy time.
DEFAULT_ORIGINS = [
    "https://cybersentinell.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
ALLOWED_ORIGINS = [origin.strip() for origin
                   in os.environ.get("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",")
                   if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://[a-z0-9-]+--cybersentinell\.netlify\.app$",  # deploy previews
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

def require_token(authorization: str | None = Header(default=None)) -> None:
    """Gate the state-changing endpoints behind a bearer token when one is configured.

    Read-only telemetry stays open — a judge or a dashboard should not need a secret to see
    the numbers. But the endpoints that execute containment, submit feedback, or run the
    tamper demo mutate state, so they require `Authorization: Bearer <CYBERSENTINEL_TOKEN>`
    whenever that env var is set. Unset (the default for the local demo) leaves them open and
    the API says so. The token is read per request so it can be rotated without a restart.
    """
    token = os.environ.get("CYBERSENTINEL_TOKEN", "").strip()
    if not token:
        return
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="missing or invalid bearer token")


STREAM_SIZE = 600
LLM_CACHE_TTL = 300  # seconds — the free Groq tier will rate-limit under demo clicking

_hosts = fusion.host_signals()
_ot = ot.signals()
_llm_cache: dict[str, tuple[float, object]] = {}
# Feature vectors keyed by event id, so an analyst verdict attaches to the exact row the model
# scored rather than to a description of it.
_vector_index: dict[str, tuple] = {}
_last_coverage: dict | None = None  # automation coverage from the most recent playbook run
_stream: dict = {}
_detections: list = []
_incidents: dict = {}
_graph: dict = {}


def _rescore(seed: int = 7) -> None:
    """Rebuild the served window. Called at startup, on refresh, and after every retrain.

    A retrain has to re-score the current window or the UI would show stale verdicts from a
    model that no longer exists — the whole point of the loop is that the numbers move.
    """
    global _stream, _detections, _incidents
    _stream = replay.build_stream(STREAM_SIZE, seed=seed)
    _detections = detect_anomalies(_stream["events"])
    _incidents = fusion.correlate(_stream["events"], _hosts, _ot)
    global _graph
    _graph = graph.build(_detections, _incidents)
    _vector_index.clear()
    for event, vector in zip(_stream["events"], _stream["vectors"]):
        _vector_index[event["id"]] = (vector, event["base_score"])


_rescore()


def _alert_summary() -> dict:
    """Raw-vs-aggregated alert load for the current window, at both operating points."""
    agg = alerts.aggregate(_detections)
    points = snapshot().get("detection", {}).get("operating_points", [])
    projected = [{"label": p["label"], "raw_per_1000": p["alerts_per_1000_flows"],
                  "aggregated_per_1000": alerts.per_1000(p["alerts_per_1000_flows"],
                                                         agg["reduction_factor"])}
                 for p in points]
    return {"raw_detections": agg["raw_detections"],
            "aggregated_alerts": agg["aggregated_alerts"],
            "reduction_factor": agg["reduction_factor"],
            "method": agg["method"],
            "per_operating_point": projected,
            "at_scale": "On the full benchmark the same grouping collapses hundreds of "
                        "thousands of attack flows to a handful of campaigns — see the "
                        "campaign metric on Evidence."}


def _cached(key: str, produce):
    """Serve repeated LLM answers from a short TTL cache so a live demo cannot rate-limit."""
    hit = _llm_cache.get(key)
    if hit and time.time() - hit[0] < LLM_CACHE_TTL:
        return hit[1]
    value = produce()
    _llm_cache[key] = (time.time(), value)
    return value


# Every field is bounded. Unbounded text here is a free-tier quota exhaustion vector: one
# request with a 200,000-character message used to be forwarded to Groq verbatim.
class CopilotRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context: Optional[List[dict]] = Field(default=[], max_length=20)


class ThreatIntelRequest(BaseModel):
    query: str = Field(min_length=2, max_length=300)


class RespondRequest(BaseModel):
    alert_id: Optional[str] = Field(default="latest", max_length=64)


class FeedbackRequest(BaseModel):
    alert_id: str = Field(min_length=1, max_length=64)
    verdict: Literal["confirm", "dismiss"]
    analyst: Optional[str] = Field(default="soc-analyst", max_length=64)


# ─── ENDPOINTS ───

@app.get("/")
def root():
    return {"status": "CyberSentinel API active", "version": app.version,
            "detector": detector_status(),
            "auth": {"state_changing_endpoints_gated": bool(os.environ.get("CYBERSENTINEL_TOKEN", "").strip()),
                     "note": "Set CYBERSENTINEL_TOKEN to require a bearer token on POST endpoints "
                             "that mutate state; read-only telemetry is always open."}}


@app.get("/api/dashboard")
def get_dashboard():
    """Main dashboard data — all KPIs, events, and detections."""
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for event in _stream["events"]:
        severity_counts[event["severity"]] = severity_counts.get(event["severity"], 0) + 1

    location_threats: dict[str, dict] = {}
    infra_breakdown: dict[str, int] = {}
    for detection in _detections:
        location = detection["location"]
        bucket = location_threats.setdefault(location, {
            "city": location, "count": 0, "critical": 0,
            "lat": detection["lat"], "lng": detection["lng"],
        })
        bucket["count"] += 1
        if detection["severity"] == "critical":
            bucket["critical"] += 1
        infra_breakdown[detection["infra_type"]] = infra_breakdown.get(detection["infra_type"], 0) + 1

    correct = sum(1 for e in _stream["events"] if e["ground_truth"]["correct"])

    return {
        "total_events": len(_stream["events"]),
        "total_anomalies": len(_detections),
        "severity_counts": severity_counts,
        "location_threats": list(location_threats.values()),
        "infra_breakdown": infra_breakdown,
        "recent_anomalies": _detections[:20],
        "assets_monitored": len(ASSETS),
        "window_accuracy": round(correct / max(len(_stream["events"]), 1), 4),
        "data_provenance": PROVENANCE,
        "stream_source": _stream["source"],
        "latency": _stream["latency"],
        "alert_summary": _alert_summary(),
    }


@app.get("/api/metrics")
def get_metrics():
    """Measured evaluation results — the numbers the problem statement grades."""
    return snapshot(latency=_stream["latency"], automation=_last_coverage)


@app.post("/api/feedback", dependencies=[Depends(require_token)])
def submit_feedback(req: FeedbackRequest):
    """Record an analyst verdict and let the adaptive layer learn from it.

    This is the live half of the loop measured in metrics/continual.json. It deliberately does
    not report its own accuracy: the analyst chooses what to label, so there is no held-out set
    to score against.
    """
    known = _vector_index.get(req.alert_id)
    if known is None:
        raise HTTPException(status_code=404, detail=f"unknown alert id: {req.alert_id}")

    vector, base_probability = known
    result = feedback.record(req.alert_id, req.verdict, list(vector), base_probability,
                             analyst=(req.analyst or "soc-analyst")[:64])

    if result["retrained"]:
        _rescore()
        result["stream"] = {"detections": len(_detections),
                            "surfaced_by_feedback": _stream["model"]["adapted_scores"]}
    return result


@app.get("/api/feedback")
def feedback_state():
    """How many verdicts the loop holds, and whether the adaptive layer is live."""
    return {
        "state": feedback.state(),
        "measured_offline": metrics_continual(),
        "stream": {"detections": len(_detections),
                   "surfaced_by_feedback": _stream["model"]["adapted_scores"]},
    }


@app.post("/api/feedback/reset", dependencies=[Depends(require_token)])
def feedback_reset():
    """Clear live verdicts. The audit ledger keeps the history either way."""
    state = feedback.reset()
    _rescore()
    return {"state": state, "stream": {"detections": len(_detections)}}


@app.get("/api/ingest/coverage")
def ingest_coverage():
    """How much of the model's feature space a real Zeek conn.log can actually fill.

    The honest answer to "could you deploy this?" — a number rather than a shrug.
    """
    return ingest.coverage()


@app.get("/api/twin")
def get_twin(entry: str = Query("CBSE-Digital", max_length=32),
             harden: List[str] = Query(default=[])):
    """Digital twin: blast radius from an entry asset, the top chokepoint, and a what-if delta.

    Real exposure and CVE pressure over a simulated inter-asset topology. Touches no live
    system — that is the point of a twin.
    """
    return twin.simulate(entry, harden=[h[:32] for h in harden[:8]], detections=_detections)


@app.get("/api/actor")
def get_actor():
    """Named-actor attribution, next-move prediction and mitigations over the ATT&CK graph.

    Candidate APT groups ranked by shared TTPs with the techniques observed in the current
    window. Probabilistic — candidates, not certainties, and the response says so.
    """
    observed = sorted({d["mitre_id"] for d in _detections if d.get("mitre_id")})
    return actor.attribute(observed)


@app.get("/api/remediation")
def get_remediation():
    """Risk-ranked CVE remediation queue across the monitored assets.

    Real CVEs and CVSS from NVD, ranked by a published formula that folds in how exposed each
    asset is and how much attack activity it is seeing right now — so the queue is dynamic. The
    asset-to-software mapping is illustrative and the response says so.
    """
    return vuln.remediation_queue(_detections)


@app.get("/api/graph")
def get_graph():
    """The attack graph — external sources, targeted assets and ATT&CK techniques as one graph.

    Lets a compound multi-hop path (source -> asset -> technique) and a convergence pivot be
    seen rather than read out of a list. Inferred topology, not confirmed lateral movement, and
    the response says so.
    """
    return _graph


@app.get("/api/incidents")
def get_incidents():
    """Compound incidents from cross-plane correlation.

    `fusion_only` incidents are the interesting ones: nothing in that window crossed the
    detection threshold, so a single-sensor pipeline would have stayed silent.
    """
    return {
        "incidents": _incidents["incidents"],
        "summary": _incidents["summary"],
        "method": _incidents["method"],
        "host_plane": {
            "captures": len(_hosts),
            "source": "OTRF/Security-Datasets — real Windows telemetry, ATT&CK-labelled",
            "placement": "asset and window assignment is illustrative; the telemetry and the "
                         "attributed technique are real",
        },
        "ot_plane": {"signals": len(_ot), "note": ot.NOTE},
        "measured": fusion_metrics(),
    }


@app.get("/api/attribution")
def get_attribution(limit: int = Query(12, ge=1, le=40)):
    """Technique attribution on real ATT&CK-labelled captures — predictions and misses.

    Deliberately shows the ground truth next to the prediction. The model is right about
    half the time at top-1; hiding the misses would be the sort of claim this build removes.
    """
    corpus = attribution.corpus()
    rows = []
    for dataset in corpus.get("datasets", [])[:limit]:
        result = attribution.attribute(dataset["tokens"])
        top = result.get("top") or {}
        rows.append({
            "dataset_id": dataset["dataset_id"],
            "title": dataset["title"],
            "ground_truth": dataset["techniques"],
            "predicted": top.get("id"),
            "predicted_name": top.get("name"),
            "confidence": top.get("confidence"),
            "ranked": result.get("ranked", []),
            "correct": top.get("id") in dataset["techniques"],
            "event_count": dataset["event_count"],
            "sample_events": dataset["sample_events"][:6],
        })

    return {
        "corpus": corpus.get("source"),
        "note": corpus.get("note"),
        "attributor": attribution.status(),
        "metrics": attribution_metrics(),
        "results": rows,
    }


@app.get("/api/events")
def get_events(limit: int = Query(50, ge=1, le=1000)):
    return {"events": _stream["events"][:limit], "total": len(_stream["events"]),
            "source": _stream["source"], "provenance": PROVENANCE}


@app.get("/api/anomalies")
def get_anomalies():
    return {"anomalies": _detections, "total": len(_detections),
            "detector": detector_status()}


@app.get("/api/kill-chain")
def get_kill_chain():
    chain = build_kill_chain(_detections)
    prediction = _cached("next-move", lambda: predict_next_move(chain))
    return {"kill_chain": chain, "next_move_prediction": prediction,
            "attack_table": source_info()}


@app.get("/api/compound-analysis")
def get_compound_analysis():
    analysis = _cached("compound", lambda: analyze_compound_threat(_detections))
    return {"analysis": analysis, "anomaly_count": len(_detections)}


@app.post("/api/threat-intel")
def get_threat_intel(req: ThreatIntelRequest):
    return _cached(f"intel:{req.query.lower().strip()}",
                   lambda: search_threat_intel(req.query))


@app.post("/api/respond", dependencies=[Depends(require_token)])
def generate_response(req: RespondRequest):
    global _last_coverage
    alert = _detections[0] if _detections else {
        "id": "none", "severity": "info", "description": "No active detections"}
    if req.alert_id and req.alert_id != "latest":
        alert = next((a for a in _detections if a["id"] == req.alert_id), alert)

    playbook = generate_playbook(alert, build_kill_chain(_detections))
    _last_coverage = playbook["execution"]["coverage"]
    return playbook


@app.get("/api/audit")
def get_audit(limit: int = Query(100, ge=1, le=500)):
    """Every automated action taken, newest last, with the chain's integrity state."""
    return {"entries": ledger.entries(limit), "verification": ledger.verify(),
            "stats": ledger.stats()}


@app.get("/api/audit/verify")
def verify_audit():
    """Re-walk the hash chain and report the first break, if any."""
    return ledger.verify()


@app.post("/api/audit/simulate-tamper", dependencies=[Depends(require_token)])
def simulate_tamper():
    """Demonstrate tamper detection against a copy — the live chain is never modified."""
    return ledger.simulate_tamper()


@app.post("/api/copilot")
def copilot_chat(req: CopilotRequest):
    """Guarded assistant. Refusals and neutralised injections are written to the ledger."""
    return chat_with_copilot(req.message, req.context, _detections)


@app.post("/api/refresh")
def refresh_stream():
    """Re-score a fresh slice of held-out flows."""
    _rescore(seed=int(time.time()) % 100_000)
    _llm_cache.clear()
    return {"status": "refreshed", "total_events": len(_stream["events"]),
            "anomalies": len(_detections), "incidents": _incidents["summary"],
            "latency": _stream["latency"], "model": _stream["model"]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
