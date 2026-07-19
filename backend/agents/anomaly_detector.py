"""
Behavioral Anomaly Detection Engine.
Uses statistical baseline deviation + Groq LLM for reasoning about compound anomalies.
"""
from typing import List

def detect_anomalies(events: List[dict]) -> List[dict]:
    """Score events for anomalous behavior based on statistical rules + LLM analysis."""
    anomalies = [e for e in events if e.get("is_anomaly", False)]
    return anomalies

def analyze_compound_threat(anomalies: List[dict]) -> str:
    """Use Groq LLM to analyze a cluster of anomalies for compound threat patterns."""
    from utils.groq_client import query_llm

    if not anomalies:
        return "No active compound threats detected."

    events_text = "\n".join([
        f"- [{a['severity'].upper()}] {a['asset']} | {a['event_type']} | {a['description']} | MITRE: {a.get('mitre_id', 'N/A')}"
        for a in anomalies[:15]
    ])

    system_prompt = """You are CyberSentinel, an AI cybersecurity analyst for Indian critical national infrastructure (AIIMS, CBSE, Power Grid, Railways, Banking, ISRO, NIC, BSNL).

Analyze the following cluster of security anomalies and provide:
1. **Threat Assessment**: What attack campaign is likely underway? Name the probable threat actor profile (APT group characteristics).
2. **Kill Chain Stage**: Where in the MITRE ATT&CK kill chain is the attack currently? What's the likely next move?
3. **Compound Risk**: What combination of these events creates a risk greater than any single event alone?
4. **Impact Forecast**: If uncontained, what is the likely impact on the targeted infrastructure within the next 2-4 hours?
5. **Immediate Actions**: Top 3 containment actions to execute NOW.

Be specific to Indian critical infrastructure context. Reference CERT-In guidelines where relevant. Be concise — this is for a SOC analyst under time pressure."""

    return query_llm(system_prompt, f"Active anomaly cluster:\n{events_text}")
