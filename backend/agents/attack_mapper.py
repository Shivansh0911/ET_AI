"""
MITRE ATT&CK Mapping Agent.
Maps detected events to ATT&CK techniques and visualizes the kill chain.
"""
from typing import List, Optional
from utils.mitre_loader import load_mitre_attack
from utils.groq_client import query_llm

def map_event_to_attack(event: dict) -> Optional[dict]:
    """Map a security event to its MITRE ATT&CK technique."""
    mitre_id = event.get("mitre_id")
    if not mitre_id:
        return None
    techniques = load_mitre_attack()
    return techniques.get(mitre_id)

def build_kill_chain(anomalies: List[dict]) -> List[dict]:
    """Build a kill chain progression from detected anomalies."""
    techniques = load_mitre_attack()
    tactic_order = [
        "Reconnaissance", "Initial Access", "Execution", "Persistence",
        "Privilege Escalation", "Defense Evasion", "Credential Access",
        "Discovery", "Lateral Movement", "Collection",
        "Command And Control", "Exfiltration", "Impact"
    ]

    chain = []
    seen_tactics = set()

    for anomaly in anomalies:
        mitre_id = anomaly.get("mitre_id")
        if mitre_id and mitre_id in techniques:
            tech = techniques[mitre_id]
            tactic = tech["tactic"]
            if tactic not in seen_tactics:
                seen_tactics.add(tactic)
                chain.append({
                    "tactic": tactic,
                    "technique_id": mitre_id,
                    "technique_name": tech["name"],
                    "event": anomaly["description"],
                    "asset": anomaly["asset"],
                    "severity": anomaly["severity"],
                    "timestamp": anomaly["timestamp"]
                })

    chain.sort(key=lambda x: tactic_order.index(x["tactic"]) if x["tactic"] in tactic_order else 99)
    return chain

def predict_next_move(chain: List[dict]) -> str:
    """Use LLM to predict the attacker's likely next move based on observed kill chain."""
    if not chain:
        return "Insufficient data to predict next move."

    chain_text = "\n".join([
        f"Stage {i+1}: [{c['tactic']}] {c['technique_name']} ({c['technique_id']}) on {c['asset']}"
        for i, c in enumerate(chain)
    ])

    system_prompt = """You are a threat intelligence analyst. Based on the observed MITRE ATT&CK kill chain progression, predict:
1. The most likely NEXT technique the attacker will use (with MITRE ID)
2. Which asset is most at risk next
3. The attacker's probable end objective
4. Confidence level (high/medium/low) with reasoning
Keep it under 150 words. Be specific."""

    return query_llm(system_prompt, f"Observed kill chain:\n{chain_text}")
