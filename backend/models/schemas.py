from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .enums import Severity, AttackPhase

class SecurityEvent(BaseModel):
    id: str
    timestamp: datetime
    source_ip: str
    dest_ip: str
    event_type: str
    description: str
    severity: Severity
    asset: str
    location: str
    raw_log: str

class AnomalyAlert(BaseModel):
    id: str
    timestamp: datetime
    event: SecurityEvent
    anomaly_score: float
    baseline_deviation: str
    severity: Severity
    mitre_technique_id: Optional[str] = None
    mitre_technique_name: Optional[str] = None
    mitre_tactic: Optional[str] = None
    recommended_action: str

class ThreatIntelResult(BaseModel):
    query: str
    findings: List[str]
    risk_assessment: str
    sources: List[str]

class IncidentResponse(BaseModel):
    alert_id: str
    severity: Severity
    playbook_name: str
    steps: List[str]
    automated_actions: List[str]
    escalation_required: bool
    estimated_containment_time: str

class CopilotMessage(BaseModel):
    role: str
    content: str

class CopilotRequest(BaseModel):
    message: str
    context: Optional[List[CopilotMessage]] = []
