"""
Automated Incident Response Playbook Generator.
Generates step-by-step response playbooks based on detected threats.
"""
import json
from typing import List
from utils.groq_client import query_llm

def generate_playbook(alert: dict, kill_chain: List[dict]) -> dict:
    """Generate an incident response playbook for a detected threat."""
    chain_summary = ", ".join([f"{c['tactic']}→{c['technique_name']}" for c in kill_chain[:5]])

    system_prompt = """You are an automated SOAR (Security Orchestration, Automation and Response) system for Indian government critical infrastructure.

Generate a structured incident response playbook. Return EXACTLY this JSON format (no markdown, no backticks):
{
    "playbook_name": "name of playbook",
    "steps": ["step 1", "step 2", "step 3", "step 4", "step 5"],
    "automated_actions": ["auto action 1", "auto action 2", "auto action 3"],
    "escalation_required": true or false,
    "estimated_containment_time": "X minutes/hours"
}

Base the playbook on CERT-In incident handling guidelines. Be specific to the asset type and attack pattern. Include both automated containment (isolate, block, snapshot) and manual investigation steps."""

    user_prompt = f"""Incident details:
- Asset: {alert.get('asset', 'Unknown')}
- Severity: {alert.get('severity', 'Unknown')}
- Event: {alert.get('description', 'Unknown')}
- MITRE Technique: {alert.get('mitre_id', 'Unknown')}
- Kill Chain Progression: {chain_summary or 'Single event'}
- Infrastructure Type: {alert.get('infra_type', 'Government')}

Generate the response playbook."""

    response = query_llm(system_prompt, user_prompt, temperature=0.2)

    try:
        playbook = json.loads(response)
    except json.JSONDecodeError:
        try:
            start = response.index("{")
            end = response.rindex("}") + 1
            playbook = json.loads(response[start:end])
        except (ValueError, json.JSONDecodeError):
            playbook = {
                "playbook_name": f"IR-{alert.get('severity', 'HIGH').upper()}-{alert.get('event_type', 'GENERIC')}",
                "steps": [
                    "1. Isolate affected endpoint from network immediately",
                    "2. Preserve forensic evidence — snapshot all affected systems",
                    "3. Revoke compromised credentials and force password reset",
                    "4. Scan all connected systems for indicators of compromise",
                    "5. Report to CERT-In within 6 hours as per mandatory reporting guidelines"
                ],
                "automated_actions": [
                    "Firewall rule: Block source IP at perimeter",
                    "SIEM: Elevate monitoring on affected subnet",
                    "AD: Disable compromised service accounts"
                ],
                "escalation_required": True,
                "estimated_containment_time": "45 minutes"
            }

    return {
        "alert_id": alert.get("id", "unknown"),
        "severity": alert.get("severity", "high"),
        **playbook
    }
