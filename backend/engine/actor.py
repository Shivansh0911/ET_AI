"""
Named-actor attribution, next-move prediction and mitigation — over the ATT&CK knowledge graph.

The platform measures technique-level attribution elsewhere (engine/attribution.py, 54% top-1).
This is the layer above it: given the set of techniques observed in the current window, which
KNOWN APT groups use that same set, what techniques do those groups typically use NEXT, and what
mitigations address what we are seeing.

All of it is graph traversal over real MITRE data (data/mitre/attack_graph.json):

  observed techniques ──▶ groups that use them        (ranked by overlap → attribution)
  candidate groups    ──▶ their other techniques      (not yet seen → prediction)
  observed techniques ──▶ mitigations that address them (→ what to do now)

DISCIPLINE: attribution is probabilistic and says so. The score is Jaccard-style overlap between
what we have seen and each group's known TTPs, reported as a percentage with the shared
techniques listed. A group is a CANDIDATE, never a certainty — real attribution needs far more
than a handful of coincident techniques, and the UI and this module both say so.
"""
from __future__ import annotations

import json
import threading
from collections import Counter
from pathlib import Path

GRAPH_PATH = Path(__file__).resolve().parent.parent / "data" / "mitre" / "attack_graph.json"

_lock = threading.Lock()
_graph: dict | None = None


def _load() -> dict:
    global _graph
    if _graph is None:
        with _lock:
            if _graph is None:
                _graph = (json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
                          if GRAPH_PATH.exists() else {"groups": {}, "technique_to_groups": {},
                                                       "technique_to_mitigations": {}})
    return _graph


def available() -> bool:
    return bool(_load().get("groups"))


def _base_techniques(technique_id: str) -> str:
    """Collapse a sub-technique (T1059.001) to its parent (T1059) for matching robustness."""
    return technique_id.split(".")[0]


def attribute(observed: list[str], top_k: int = 5) -> dict:
    """Rank candidate APT groups by TTP overlap with the observed technique set."""
    graph = _load()
    groups = graph.get("groups", {})
    if not groups or not observed:
        return {"available": bool(groups), "observed": observed, "candidates": [],
                "predicted_next": [], "mitigations": []}

    observed_set = {_base_techniques(t) for t in observed if t}

    ranked = []
    for group in groups.values():
        group_techs = {_base_techniques(t) for t in group["techniques"]}
        shared = observed_set & group_techs
        if not shared:
            continue
        # Jaccard overlap between observed and the group's known TTPs.
        union = observed_set | group_techs
        overlap = len(shared) / len(union)
        # Also report coverage: what fraction of what WE saw this group is known to do.
        coverage = len(shared) / len(observed_set)
        ranked.append({
            "group": group["name"],
            "id": group.get("id"),
            "aliases": group.get("aliases", []),
            "overlap": round(overlap, 4),
            "coverage_of_observed": round(coverage, 4),
            "shared_techniques": sorted(shared),
            "group_technique_count": group.get("technique_count", len(group_techs)),
            "description": group.get("description", ""),
        })

    ranked.sort(key=lambda c: (c["coverage_of_observed"], c["overlap"]), reverse=True)
    candidates = ranked[:top_k]

    # Prediction: techniques the top candidates are known to use that we have NOT seen yet,
    # weighted by how many candidates share them.
    predicted: Counter = Counter()
    for candidate in candidates:
        group = next(g for g in groups.values() if g.get("id") == candidate["id"])
        for tech in {_base_techniques(t) for t in group["techniques"]}:
            if tech not in observed_set:
                predicted[tech] += 1
    predicted_next = [{"technique": t, "supporting_candidates": n}
                      for t, n in predicted.most_common(6)]

    # Mitigations for what we have actually seen.
    tech_to_mit = graph.get("technique_to_mitigations", {})
    mitigation_hits: dict[str, dict] = {}
    for tech in observed:
        for m in tech_to_mit.get(_base_techniques(tech), []):
            entry = mitigation_hits.setdefault(m["id"], {**m, "addresses": []})
            if tech not in entry["addresses"]:
                entry["addresses"].append(tech)
    mitigations = sorted(mitigation_hits.values(), key=lambda m: -len(m["addresses"]))

    return {
        "available": True,
        "observed": sorted(observed_set),
        "candidates": candidates,
        "predicted_next": predicted_next,
        "mitigations": mitigations[:8],
        "method": "candidate APT groups ranked by shared TTPs with the observed technique set "
                  "(coverage of what we saw, tie-broken by Jaccard overlap); next techniques are "
                  "what those groups also use but we have not seen; mitigations address the "
                  "observed techniques. All from the MITRE ATT&CK knowledge graph.",
        "caveat": "Attribution is probabilistic and shown as a CANDIDATE, never a certainty. A "
                  "handful of coincident techniques is not proof of an actor; real attribution "
                  "weighs infrastructure, malware and campaign timing this does not have.",
        "source": graph.get("source"),
        "group_count": graph.get("counts", {}).get("groups"),
    }
