"""
Trim the 53 MB MITRE ATT&CK enterprise STIX bundle into a technique table small enough to
commit and load at request time.

This closes the gap where utils/mitre_loader.py silently fell back to 21 hardcoded techniques
while the deck claimed "MITRE ATT&CK (Open JSON)". Output carries the bundle's own version and
release date so the table's provenance travels with it.

Usage:  python ml/trim_mitre.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SOURCE = BACKEND / "data" / "raw" / "mitre" / "enterprise-attack.json"
DEST = BACKEND / "data" / "mitre" / "techniques.json"

TACTIC_ORDER = [
    "Reconnaissance", "Resource Development", "Initial Access", "Execution", "Persistence",
    "Privilege Escalation", "Defense Evasion", "Credential Access", "Discovery",
    "Lateral Movement", "Collection", "Command And Control", "Exfiltration", "Impact",
]
DESCRIPTION_CHARS = 240


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing {SOURCE}. Run: python ml/download_datasets.py --only mitre")
        return 1

    bundle = json.loads(SOURCE.read_text(encoding="utf-8"))
    techniques: dict[str, dict] = {}
    revoked = deprecated = 0

    for obj in bundle.get("objects", []):
        if obj.get("type") != "attack-pattern":
            continue
        if obj.get("revoked"):
            revoked += 1
            continue
        if obj.get("x_mitre_deprecated"):
            deprecated += 1
            continue

        attack_id = next((ref.get("external_id") for ref in obj.get("external_references", [])
                          if ref.get("source_name") == "mitre-attack"), None)
        if not attack_id:
            continue

        phases = [p["phase_name"].replace("-", " ").title()
                  for p in obj.get("kill_chain_phases", [])
                  if p.get("kill_chain_name") == "mitre-attack"]
        # A technique can sit in several tactics; keep them all, but surface the earliest in
        # kill-chain order as the primary so chain reconstruction has a deterministic anchor.
        phases.sort(key=lambda t: TACTIC_ORDER.index(t) if t in TACTIC_ORDER else 99)

        techniques[attack_id] = {
            "id": attack_id,
            "name": obj.get("name", ""),
            "tactic": phases[0] if phases else "Unknown",
            "tactics": phases,
            "is_subtechnique": bool(obj.get("x_mitre_is_subtechnique")),
            "platforms": obj.get("x_mitre_platforms", []),
            "description": " ".join(obj.get("description", "").split())[:DESCRIPTION_CHARS],
        }

    table = {
        "source": "mitre-attack/attack-stix-data enterprise-attack.json",
        "attack_spec_version": bundle.get("objects", [{}])[0].get("x_mitre_attack_spec_version"),
        "version": next((o.get("x_mitre_version") for o in bundle.get("objects", [])
                         if o.get("type") == "x-mitre-collection"), None),
        "technique_count": len(techniques),
        "tactic_order": TACTIC_ORDER,
        "techniques": techniques,
    }

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(table, separators=(",", ":")), encoding="utf-8")

    parents = sum(1 for t in techniques.values() if not t["is_subtechnique"])
    print(f"{len(techniques):,} techniques ({parents:,} parent, {len(techniques) - parents:,} sub) "
          f"-> {DEST.relative_to(BACKEND)} ({DEST.stat().st_size / 1e6:.2f} MB)")
    print(f"skipped {revoked} revoked, {deprecated} deprecated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
