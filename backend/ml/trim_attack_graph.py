"""
Trim the MITRE ATT&CK STIX bundle into a small knowledge GRAPH — not a table.

The platform already ships a technique table (ml/trim_mitre.py). This adds the relationships
that make it a graph: which APT groups use which techniques, and which mitigations address
which techniques. Those edges are what let the attribution engine answer the questions PS#7
actually asks — "which known campaign is this?", "what will they do next?", "what stops it?" —
rather than just naming a technique.

Everything here is real MITRE data. Output is committed so the API needs no 53 MB bundle at
runtime.

Usage:  python ml/trim_attack_graph.py
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SOURCE = BACKEND / "data" / "raw" / "mitre" / "enterprise-attack.json"
DEST = BACKEND / "data" / "mitre" / "attack_graph.json"

# APT groups with the most techniques carry the most signal for overlap scoring; keeping all
# 189 is fine (the file stays small), but we record technique sets only for groups that map to
# at least this many techniques so a one-technique group cannot spuriously score 100% overlap.
MIN_GROUP_TECHNIQUES = 6


def attack_id(obj: dict) -> str | None:
    return next((ref.get("external_id") for ref in obj.get("external_references", [])
                 if ref.get("source_name") == "mitre-attack"), None)


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing {SOURCE}. Run: python ml/download_datasets.py --only mitre")
        return 1

    bundle = json.loads(SOURCE.read_text(encoding="utf-8"))
    objects = bundle["objects"]
    by_ref = {o["id"]: o for o in objects if "id" in o}

    groups = {}          # stix id -> {id, name, aliases, description}
    mitigations = {}     # stix id -> {id, name}
    technique_stix = {}  # stix id -> attack id (for attack-patterns)

    for obj in objects:
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue
        kind = obj.get("type")
        if kind == "intrusion-set":
            groups[obj["id"]] = {
                "id": attack_id(obj),
                "name": obj.get("name", ""),
                "aliases": obj.get("aliases", [])[:6],
                "description": " ".join(obj.get("description", "").split())[:220],
                "techniques": [],
            }
        elif kind == "course-of-action":
            mitigations[obj["id"]] = {"id": attack_id(obj), "name": obj.get("name", "")}
        elif kind == "attack-pattern":
            tid = attack_id(obj)
            if tid:
                technique_stix[obj["id"]] = tid

    technique_groups: dict[str, list[str]] = defaultdict(list)   # attack technique -> group names
    technique_mitigations: dict[str, list[dict]] = defaultdict(list)

    for obj in objects:
        if obj.get("type") != "relationship":
            continue
        rel = obj.get("relationship_type")
        src, tgt = obj.get("source_ref"), obj.get("target_ref")

        if rel == "uses" and src in groups and tgt in technique_stix:
            tid = technique_stix[tgt]
            groups[src]["techniques"].append(tid)
            technique_groups[tid].append(groups[src]["name"])
        elif rel == "mitigates" and src in mitigations and tgt in technique_stix:
            tid = technique_stix[tgt]
            m = mitigations[src]
            if m["id"] and all(x["id"] != m["id"] for x in technique_mitigations[tid]):
                technique_mitigations[tid].append(m)

    # Keep only groups with enough techniques to score meaningfully; dedupe technique lists.
    kept_groups = {}
    for g in groups.values():
        techniques = sorted(set(g["techniques"]))
        if len(techniques) >= MIN_GROUP_TECHNIQUES and g["id"]:
            kept_groups[g["id"]] = {**g, "techniques": techniques,
                                    "technique_count": len(techniques)}

    graph = {
        "source": "mitre-attack/attack-stix-data enterprise-attack.json",
        "attack_spec_version": next((o.get("x_mitre_attack_spec_version") for o in objects
                                     if o.get("type") == "x-mitre-collection"), None),
        "counts": {
            "groups": len(kept_groups),
            "techniques_with_a_group": len(technique_groups),
            "techniques_with_a_mitigation": len(technique_mitigations),
        },
        "groups": kept_groups,
        "technique_to_groups": {k: sorted(set(v)) for k, v in technique_groups.items()},
        "technique_to_mitigations": technique_mitigations,
    }

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(graph, separators=(",", ":")), encoding="utf-8")
    print(f"{len(kept_groups)} groups, "
          f"{len(technique_groups)} techniques mapped to a group, "
          f"{len(technique_mitigations)} to a mitigation "
          f"-> {DEST.relative_to(BACKEND)} ({DEST.stat().st_size / 1e6:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
