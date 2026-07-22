"""
Cyber Resilience Digital Twin — scoped attack-path simulation.

PS#7's last build area: "AI-generated simulation of the organisation's security architecture
that enables attack path modelling ... and impact assessment of proposed security investments —
all without touching live production systems."

This is a scoped, honest version. It answers three questions a defender actually asks:

  1. If an attacker lands on asset X, how far can they spread?          (blast radius)
  2. Which single asset, if hardened, shrinks that spread the most?     (chokepoint)
  3. What does patching or segmenting an asset actually buy?            (what-if delta)

WHAT IS REAL vs SIMULATED — stated plainly, because a twin is inherently a model:
  real        per-asset internet exposure and the open-CVE pressure (engine/vuln, NVD data).
  simulated   the inter-asset network topology. Real CNI segmentation is not public, so the
              adjacency below is a plausible government-backbone layout, labelled simulated.
              The propagation model (reachability weighted by exposure and CVE load) is a
              model, not a measurement.

Nothing here touches a live system — which is the entire point of a twin.
"""
from __future__ import annotations

from collections import deque

from .assets import ASSETS
from .vuln import EXPOSURE, remediation_queue

# Simulated CNI/government interconnect. NIC (National Informatics Centre) is the government
# backbone hub; BSNL is the telecom carrier; power and rail are OT peers; health and education
# share a government segment. Plausible, and labelled simulated wherever it surfaces.
TOPOLOGY: dict[str, list[str]] = {
    "NIC-GOV": ["AIIMS-Delhi", "CBSE-Digital", "ISRO-NRSC", "SBI-Core", "PowerGrid-NR", "RailNet-CR"],
    "BSNL-NOC": ["PowerGrid-NR", "RailNet-CR", "NIC-GOV"],
    "CBSE-Digital": ["AIIMS-Delhi", "NIC-GOV"],
    "AIIMS-Delhi": ["NIC-GOV", "CBSE-Digital"],
    "PowerGrid-NR": ["RailNet-CR", "NIC-GOV", "BSNL-NOC"],
    "RailNet-CR": ["PowerGrid-NR", "NIC-GOV", "BSNL-NOC"],
    "SBI-Core": ["NIC-GOV"],
    "ISRO-NRSC": ["NIC-GOV"],
}

REACH_THRESHOLD = 0.12       # a path this improbable is treated as not reachable


def _cve_pressure(detections: list[dict]) -> dict[str, float]:
    """Per-asset open-CVE pressure in [0,1], from the real remediation queue."""
    queue = remediation_queue(detections or [])
    if not queue.get("available"):
        return {}
    peak = max((item["priority"] for item in queue["queue"]), default=1) or 1
    pressure: dict[str, float] = {}
    for item in queue["queue"]:
        pressure[item["asset"]] = max(pressure.get(item["asset"], 0.0),
                                      item["priority"] / peak)
    return pressure


def _edge_weight(target: str, pressure: dict[str, float]) -> float:
    """How attackable `target` is: its exposure lifted by its open-CVE pressure."""
    exposure = EXPOSURE.get(target, 0.5)
    return min(exposure * (1 + 0.6 * pressure.get(target, 0.0)), 1.0)


def _reachable(entry: str, hardened: set[str], pressure: dict[str, float]) -> dict[str, dict]:
    """Best-path reachability from `entry`, hardened assets removed from the graph."""
    if entry in hardened:
        return {}
    best: dict[str, dict] = {entry: {"reach": 1.0, "path": [entry], "hops": 0}}
    queue = deque([entry])
    while queue:
        node = queue.popleft()
        current = best[node]
        for nxt in TOPOLOGY.get(node, []):
            if nxt in hardened:
                continue
            reach = current["reach"] * _edge_weight(nxt, pressure)
            if reach < REACH_THRESHOLD:
                continue
            if nxt not in best or reach > best[nxt]["reach"]:
                best[nxt] = {"reach": reach, "path": current["path"] + [nxt],
                             "hops": current["hops"] + 1}
                queue.append(nxt)
    return best


def _blast(entry: str, hardened: set[str], pressure: dict[str, float]) -> int:
    """Assets reachable besides the entry point."""
    return max(len(_reachable(entry, hardened, pressure)) - 1, 0)


def simulate(entry: str, harden: list[str] | None = None,
             detections: list[dict] | None = None) -> dict:
    """Blast radius from an entry point, the top chokepoint, and a what-if delta."""
    if entry not in TOPOLOGY:
        entry = next(iter(TOPOLOGY))
    harden_set = {a for a in (harden or []) if a != entry}
    pressure = _cve_pressure(detections or [])

    reachable = _reachable(entry, harden_set, pressure)
    baseline_blast = _blast(entry, set(), pressure)
    current_blast = _blast(entry, harden_set, pressure)

    # Chokepoint: the asset (not the entry, not already hardened) whose removal most reduces
    # what the entry can reach.
    candidates = []
    for node in TOPOLOGY:
        if node == entry or node in harden_set:
            continue
        reduced = _blast(entry, harden_set | {node}, pressure)
        candidates.append({"asset": node, "blast_after": reduced,
                           "reduction": current_blast - reduced})
    candidates.sort(key=lambda c: -c["reduction"])
    chokepoint = candidates[0] if candidates else None

    return {
        "entry": entry,
        "hardened": sorted(harden_set),
        "blast_radius": current_blast,
        "baseline_blast_radius": baseline_blast,
        "reduction_from_hardening": baseline_blast - current_blast,
        "reachable": [
            {"asset": a, "type": ASSETS.get(a, {}).get("type"),
             "reach_probability": round(info["reach"], 4), "hops": info["hops"],
             "path": info["path"]}
            for a, info in sorted(reachable.items(), key=lambda kv: -kv[1]["reach"])
            if a != entry
        ],
        "chokepoint": chokepoint,
        "all_chokepoints": candidates,
        "entry_points": list(TOPOLOGY),
        "method": "breadth-first reachability from the entry asset; an edge is traversable when "
                  "the path's cumulative probability (product of each target's exposure lifted "
                  f"by its open-CVE pressure) stays above {REACH_THRESHOLD}. The chokepoint is "
                  "the asset whose hardening most reduces reachable assets.",
        "provenance": {
            "real": "per-asset internet exposure and open-CVE pressure (NVD data via the "
                    "remediation queue).",
            "simulated": "the inter-asset network topology and the propagation model are "
                         "SIMULATED. Real CNI segmentation is not public; this is a plausible "
                         "government-backbone layout. No live system is touched — that is the "
                         "point of a twin.",
        },
    }
