"""
MITRE ATT&CK Mapping agent.

Maps detections onto ATT&CK techniques and reconstructs the observed kill chain. Two bugs
from the previous version are fixed here:

  * it deduplicated by tactic keeping whichever anomaly appeared first in a newest-first
    list, then re-sorted by canonical tactic order, so the rendered "progression" could run
    backwards in time. The chain is now anchored on the EARLIEST detection per tactic and
    reports both the canonical stage order and real first/last timestamps.
  * the 21-technique fallback table mislabelled T1078 as Persistence, which made
    Privilege Escalation unreachable in any chain. The table is now the real ATT&CK data.
"""
from typing import List, Optional

from utils.groq_client import query_llm
from utils.mitre_loader import load_mitre_attack, tactic_rank


def map_event_to_attack(event: dict) -> Optional[dict]:
    technique_id = event.get("mitre_id")
    return load_mitre_attack().get(technique_id) if technique_id else None


def build_kill_chain(anomalies: List[dict]) -> List[dict]:
    """Collapse detections into one entry per tactic, anchored on the earliest sighting."""
    techniques = load_mitre_attack()
    stages: dict[str, dict] = {}

    for anomaly in anomalies:
        technique_id = anomaly.get("mitre_id")
        technique = techniques.get(technique_id) if technique_id else None
        if not technique:
            continue

        tactic = technique["tactic"]
        timestamp = anomaly.get("timestamp", "")
        stage = stages.get(tactic)

        if stage is None:
            stages[tactic] = {
                "tactic": tactic,
                "technique_id": technique_id,
                "technique_name": technique["name"],
                "event": anomaly.get("description", ""),
                "asset": anomaly.get("asset", "unknown"),
                "severity": anomaly.get("severity", "info"),
                "first_seen": timestamp,
                "last_seen": timestamp,
                "detections": 1,
                "max_score": anomaly.get("anomaly_score", 0.0),
            }
            continue

        stage["detections"] += 1
        stage["max_score"] = max(stage["max_score"], anomaly.get("anomaly_score", 0.0))
        if timestamp and timestamp < stage["first_seen"]:
            # Earlier sighting wins: the chain should show where the tactic STARTED.
            stage.update(first_seen=timestamp, technique_id=technique_id,
                         technique_name=technique["name"], event=anomaly.get("description", ""),
                         asset=anomaly.get("asset", "unknown"))
        if timestamp > stage["last_seen"]:
            stage["last_seen"] = timestamp

    return sorted(stages.values(), key=lambda s: tactic_rank(s["tactic"]))


def predict_next_move(chain: List[dict]) -> str:
    if not chain:
        return "No techniques observed in the current window — nothing to project from."

    chain_text = "\n".join(
        f"Stage {i + 1}: [{c['tactic']}] {c['technique_name']} ({c['technique_id']}) "
        f"on {c['asset']} — {c['detections']} detection(s), first seen {c['first_seen']}"
        for i, c in enumerate(chain)
    )

    system_prompt = """You are a threat intelligence analyst. Based on the observed MITRE ATT&CK kill chain progression, predict:
1. The most likely NEXT technique the attacker will use (with MITRE ID)
2. Which asset is most at risk next
3. The attacker's probable end objective
4. Confidence level (high/medium/low) with reasoning

Only reason from the stages listed. Keep it under 150 words. Be specific."""

    return query_llm(system_prompt, f"Observed kill chain:\n{chain_text}")
