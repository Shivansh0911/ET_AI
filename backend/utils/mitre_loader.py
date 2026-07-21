"""
MITRE ATT&CK technique table.

Backed by data/mitre/techniques.json — 697 live techniques derived from the official
mitre-attack/attack-stix-data enterprise bundle by ml/trim_mitre.py. The previous version
pointed at a file that was never shipped, so it silently ran on 21 hardcoded techniques
while the deck advertised "MITRE ATT&CK (Open JSON)".
"""
from __future__ import annotations

import json
from pathlib import Path

TABLE = Path(__file__).resolve().parent.parent / "data" / "mitre" / "techniques.json"

TACTIC_ORDER = [
    "Reconnaissance", "Resource Development", "Initial Access", "Execution", "Persistence",
    "Privilege Escalation", "Defense Evasion", "Credential Access", "Discovery",
    "Lateral Movement", "Collection", "Command And Control", "Exfiltration", "Impact",
]

_table: dict | None = None


def _load() -> dict:
    global _table
    if _table is None:
        if not TABLE.exists():
            raise FileNotFoundError(
                f"{TABLE} missing — run: python ml/download_datasets.py --only mitre "
                "&& python ml/trim_mitre.py"
            )
        _table = json.loads(TABLE.read_text(encoding="utf-8"))
    return _table


def load_mitre_attack() -> dict[str, dict]:
    """Technique id -> {id, name, tactic, tactics, description, platforms}."""
    return _load()["techniques"]


def technique(technique_id: str) -> dict | None:
    return load_mitre_attack().get(technique_id)


def source_info() -> dict:
    table = _load()
    return {
        "source": table["source"],
        "technique_count": table["technique_count"],
        "provenance": "official MITRE ATT&CK STIX bundle, trimmed for size",
    }


def tactic_rank(tactic: str) -> int:
    return TACTIC_ORDER.index(tactic) if tactic in TACTIC_ORDER else len(TACTIC_ORDER)
