"""
Automated Incident Response orchestrator.

The LLM drafts the playbook; the action executor decides what of it can actually be carried
out, runs those steps through a blast-radius gate, and writes every decision to the
hash-chained audit ledger. Previously "automated_actions" was a list of strings that nothing
executed and nothing recorded, which left the problem statement's automation-coverage and
auditability criteria with no evidence behind them.
"""
import json
from typing import List

from engine import actions
from utils.groq_client import query_llm

FALLBACK_PLAYBOOK = {
    "playbook_name": "IR-GENERIC-CONTAINMENT",
    "steps": [
        "Isolate the affected endpoint from the network immediately",
        "Snapshot the affected systems to preserve forensic evidence",
        "Revoke the compromised credentials and force re-authentication",
        "Block the source IP at the perimeter firewall",
        "Elevate monitoring on the affected subnet",
        "Scan connected systems for indicators of compromise",
        "Report to CERT-In within the mandated 6-hour window",
    ],
    "escalation_required": True,
    "estimated_containment_time": "45 minutes",
}


def _parse(response: str) -> dict:
    """LLM output is not trusted to be JSON; fall back rather than surface a parse error."""
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        try:
            return json.loads(response[response.index("{"):response.rindex("}") + 1])
        except (ValueError, json.JSONDecodeError):
            return dict(FALLBACK_PLAYBOOK)


def generate_playbook(alert: dict, kill_chain: List[dict]) -> dict:
    """Draft a playbook, execute what is executable, and record all of it."""
    chain_summary = ", ".join(f"{c['tactic']}→{c['technique_name']}" for c in kill_chain[:5])

    system_prompt = """You are an automated SOAR system for critical infrastructure.

Generate a structured incident response playbook. Return EXACTLY this JSON (no markdown, no backticks):
{
    "playbook_name": "name of playbook",
    "steps": ["step 1", "step 2", "step 3", "step 4", "step 5", "step 6"],
    "escalation_required": true or false,
    "estimated_containment_time": "X minutes/hours"
}

Base it on CERT-In incident handling guidance. Write each step as a single concrete action.
Mix automatable containment (isolate, block, revoke, snapshot, elevate monitoring, notify
CERT-In) with genuinely manual investigation steps — do not pretend everything can be
automated."""

    user_prompt = f"""Incident details:
- Asset: {alert.get('asset', 'Unknown')}
- Severity: {alert.get('severity', 'Unknown')}
- Detection: {alert.get('description', 'Unknown')}
- Model score: {alert.get('anomaly_score', 'n/a')}
- MITRE technique: {alert.get('mitre_id', 'Unknown')}
- Kill chain: {chain_summary or 'Single detection'}
- Infrastructure type: {alert.get('infra_type', 'Government')}

Generate the response playbook."""

    playbook = _parse(query_llm(system_prompt, user_prompt, temperature=0.2))
    steps = playbook.get("steps") or FALLBACK_PLAYBOOK["steps"]

    execution = actions.run_playbook(
        steps,
        target=alert.get("asset", "unknown-asset"),
        evidence={"alert_id": alert.get("id"), "score": alert.get("anomaly_score"),
                  "technique": alert.get("mitre_id")},
    )

    return {
        "alert_id": alert.get("id", "unknown"),
        "severity": alert.get("severity", "high"),
        "playbook_name": playbook.get("playbook_name", FALLBACK_PLAYBOOK["playbook_name"]),
        "steps": steps,
        "escalation_required": playbook.get("escalation_required", True),
        "estimated_containment_time": playbook.get("estimated_containment_time", "unknown"),
        "execution": execution,
        "note": "Containment actions are simulated — no production estate is attached. The "
                "classification, blast-radius gate and audit record are real.",
    }
