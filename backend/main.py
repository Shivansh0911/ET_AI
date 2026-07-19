"""
CyberSentinel — FastAPI Backend
AI-Powered Cyber Resilience Platform for Critical National Infrastructure
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from data.synthetic_logs import generate_logs, ASSETS
from agents.anomaly_detector import detect_anomalies, analyze_compound_threat
from agents.attack_mapper import build_kill_chain, predict_next_move
from agents.threat_intel import search_threat_intel
from agents.response_orchestrator import generate_playbook
from agents.copilot import chat_with_copilot

app = FastAPI(title="CyberSentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CURRENT_LOGS = generate_logs(200)
CURRENT_ANOMALIES = detect_anomalies(CURRENT_LOGS)

class CopilotRequest(BaseModel):
    message: str
    context: Optional[List[dict]] = []

class ThreatIntelRequest(BaseModel):
    query: str

class RespondRequest(BaseModel):
    alert_id: Optional[str] = "latest"

# ─── ENDPOINTS ───

@app.get("/")
def root():
    return {"status": "CyberSentinel API active", "version": "1.0.0"}

@app.get("/api/dashboard")
def get_dashboard():
    """Main dashboard data — all KPIs, events, and anomalies."""
    anomalies = CURRENT_ANOMALIES
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for e in CURRENT_LOGS:
        sev = e.get("severity", "info")
        if sev in severity_counts:
            severity_counts[sev] += 1

    location_threats = {}
    for a in anomalies:
        loc = a.get("location", "Unknown")
        if loc not in location_threats:
            location_threats[loc] = {"city": loc, "count": 0, "lat": a.get("lat", 0), "lng": a.get("lng", 0), "critical": 0}
        location_threats[loc]["count"] += 1
        if a.get("severity") == "critical":
            location_threats[loc]["critical"] += 1

    infra_breakdown = {}
    for a in anomalies:
        infra = a.get("infra_type", "Other")
        infra_breakdown[infra] = infra_breakdown.get(infra, 0) + 1

    return {
        "total_events": len(CURRENT_LOGS),
        "total_anomalies": len(anomalies),
        "severity_counts": severity_counts,
        "location_threats": list(location_threats.values()),
        "infra_breakdown": infra_breakdown,
        "recent_anomalies": anomalies[:20],
        "assets_monitored": len(ASSETS),
        "mttd_minutes": 4.2,
        "mttr_minutes": 12.8,
    }

@app.get("/api/events")
def get_events(limit: int = 50):
    """Get recent security events."""
    return {"events": CURRENT_LOGS[:limit], "total": len(CURRENT_LOGS)}

@app.get("/api/anomalies")
def get_anomalies():
    """Get detected anomalies."""
    return {"anomalies": CURRENT_ANOMALIES, "total": len(CURRENT_ANOMALIES)}

@app.get("/api/kill-chain")
def get_kill_chain():
    """Get MITRE ATT&CK kill chain mapping."""
    chain = build_kill_chain(CURRENT_ANOMALIES)
    prediction = predict_next_move(chain)
    return {"kill_chain": chain, "next_move_prediction": prediction}

@app.get("/api/compound-analysis")
def get_compound_analysis():
    """Get AI compound threat analysis."""
    analysis = analyze_compound_threat(CURRENT_ANOMALIES)
    return {"analysis": analysis, "anomaly_count": len(CURRENT_ANOMALIES)}

@app.post("/api/threat-intel")
def get_threat_intel(req: ThreatIntelRequest):
    """Search threat intelligence."""
    return search_threat_intel(req.query)

@app.post("/api/respond")
def generate_response(req: RespondRequest):
    """Generate incident response playbook."""
    alert = CURRENT_ANOMALIES[0] if CURRENT_ANOMALIES else {"id": "none", "severity": "info", "description": "No active alerts"}
    if req.alert_id and req.alert_id != "latest":
        for a in CURRENT_ANOMALIES:
            if a.get("id") == req.alert_id:
                alert = a
                break
    chain = build_kill_chain(CURRENT_ANOMALIES)
    return generate_playbook(alert, chain)

@app.post("/api/copilot")
def copilot_chat(req: CopilotRequest):
    """Chat with the security copilot."""
    response = chat_with_copilot(req.message, req.context, CURRENT_ANOMALIES)
    return {"response": response}

@app.post("/api/refresh")
def refresh_logs():
    """Generate fresh synthetic logs (simulate new event stream)."""
    global CURRENT_LOGS, CURRENT_ANOMALIES
    CURRENT_LOGS = generate_logs(200)
    CURRENT_ANOMALIES = detect_anomalies(CURRENT_LOGS)
    return {"status": "refreshed", "total_events": len(CURRENT_LOGS), "anomalies": len(CURRENT_ANOMALIES)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
