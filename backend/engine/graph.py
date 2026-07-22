"""
Attack graph — topology inferred from the endpoints of flagged flows and attributed host
activity, so lateral movement and convergence points can be seen rather than read out of a list.

Honesty first: this is inferred topology, NOT confirmed lateral movement. The synthetic replay
stream does not contain genuine host-to-host pivoting between assets, and inventing edges to fake
it would be exactly the kind of thing this project removes. What the graph shows instead is real:

  external threat source  ──(malicious network flows)──▶  targeted asset
  targeted asset          ──(attributed technique)──────▶  ATT&CK technique / tactic

Assembling those two real planes into one graph gives a genuine multi-hop attack path
(source → asset → technique) and a defensible notion of a pivot: an asset where several distinct
threat sources converge AND host-level technique activity is present. That convergence is the
signal a SOC actually hunts for, and it is computed here with a hand-rolled adjacency structure —
no heavy graph library, so nothing new to install or ship.
"""
from __future__ import annotations

from collections import defaultdict

from .assets import ASSETS

MAX_SOURCES = 7          # keep the panel readable; the rest fold into one "other sources" node
SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


def _worse(a: str, b: str) -> str:
    return a if SEVERITY_RANK.get(a, 0) >= SEVERITY_RANK.get(b, 0) else b


def build(detections: list[dict], incidents: dict | None = None) -> dict:
    """Assemble the attack graph from network detections and host-plane attribution."""
    nodes: dict[str, dict] = {}
    edges: dict[tuple[str, str], dict] = {}

    def node(node_id: str, kind: str, **extra) -> dict:
        existing = nodes.get(node_id)
        if existing is None:
            existing = {"id": node_id, "kind": kind, "severity": "info", "weight": 0, **extra}
            nodes[node_id] = existing
        return existing

    def edge(src: str, dst: str, severity: str, kind: str) -> None:
        key = (src, dst)
        e = edges.get(key)
        if e is None:
            edges[key] = {"source": src, "target": dst, "kind": kind, "count": 1,
                          "severity": severity}
        else:
            e["count"] += 1
            e["severity"] = _worse(e["severity"], severity)

    # ── network plane: external source → asset ──
    source_hits: dict[str, int] = defaultdict(int)
    for d in detections:
        source_hits[d["source_ip"]] += 1
    top_sources = {ip for ip, _ in sorted(source_hits.items(), key=lambda kv: -kv[1])[:MAX_SOURCES]}

    for d in detections:
        asset_id = f"asset:{d['asset']}"
        asset = node(asset_id, "asset", label=d["asset"], location=d.get("location"))
        asset["severity"] = _worse(asset["severity"], d["severity"])
        asset["weight"] += 1

        src_ip = d["source_ip"]
        src_id = f"src:{src_ip}" if src_ip in top_sources else "src:other"
        src = node(src_id, "source",
                   label=src_ip if src_ip in top_sources else "other sources")
        src["severity"] = _worse(src["severity"], d["severity"])
        src["weight"] += 1
        edge(src_id, asset_id, d["severity"], "network")

        technique = d.get("mitre_id")
        if technique:
            tech_id = f"tech:{technique}"
            t = node(tech_id, "technique", label=technique)
            t["severity"] = _worse(t["severity"], d["severity"])
            t["weight"] += 1
            edge(asset_id, tech_id, d["severity"], "technique")

    # ── host plane: attributed techniques on an asset (from the correlation engine) ──
    for incident in (incidents or {}).get("incidents", []):
        asset_id = f"asset:{incident['asset']}"
        if asset_id not in nodes:
            continue
        for technique in incident.get("techniques", []):
            tech_id = f"tech:{technique}"
            node(tech_id, "technique", label=technique)
            edge(asset_id, tech_id, incident.get("severity", "high"), "host")

    return _analyse(nodes, edges)


def _analyse(nodes: dict, edges: dict) -> dict:
    adjacency: dict[str, list[str]] = defaultdict(list)
    reverse: dict[str, list[str]] = defaultdict(list)
    undirected: dict[str, set[str]] = defaultdict(set)
    for (src, dst) in edges:
        adjacency[src].append(dst)
        reverse[dst].append(src)
        undirected[src].add(dst)
        undirected[dst].add(src)

    for node_id, n in nodes.items():
        n["out_degree"] = len(adjacency.get(node_id, []))
        n["in_degree"] = len(reverse.get(node_id, []))

    # Connected components over the undirected projection.
    seen: set[str] = set()
    components = []
    for start in nodes:
        if start in seen:
            continue
        stack, group = [start], []
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            group.append(current)
            stack.extend(undirected[current] - seen)
        components.append(sorted(group))

    # Longest simple path. The graph is source → asset → technique, so it is shallow and the
    # exhaustive DFS below stays cheap; a depth guard keeps it safe if the shape ever changes.
    longest: list[str] = []

    def dfs(node_id: str, path: list[str], visited: set[str]) -> None:
        nonlocal longest
        if len(path) > len(longest):
            longest = list(path)
        if len(path) >= 6:
            return
        for nxt in adjacency.get(node_id, []):
            if nxt not in visited:
                visited.add(nxt)
                dfs(nxt, path + [nxt], visited)
                visited.discard(nxt)

    for start in nodes:
        if nodes[start]["in_degree"] == 0:      # attack paths begin at a source
            dfs(start, [start], {start})

    # Pivots: assets where multiple distinct sources converge and technique activity is present.
    pivots = []
    for node_id, n in nodes.items():
        if n["kind"] != "asset":
            continue
        incoming_sources = sum(1 for s in reverse.get(node_id, []) if nodes[s]["kind"] == "source")
        outgoing_techniques = sum(1 for t in adjacency.get(node_id, []) if nodes[t]["kind"] == "technique")
        if incoming_sources >= 2 and outgoing_techniques >= 1:
            pivots.append({"id": node_id, "label": n["label"], "severity": n["severity"],
                           "converging_sources": incoming_sources,
                           "techniques": outgoing_techniques,
                           "score": incoming_sources + outgoing_techniques})
    pivots.sort(key=lambda p: -p["score"])

    return {
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "components": len(components),
        "largest_component": max((len(c) for c in components), default=0),
        "longest_path": [{"id": nid, "label": nodes[nid]["label"], "kind": nodes[nid]["kind"]}
                         for nid in longest],
        "pivots": pivots,
        "method": "Nodes are external threat sources, targeted assets and ATT&CK techniques. "
                  "Edges are malicious flows (source→asset) and attributed activity "
                  "(asset→technique). A pivot is an asset where multiple sources converge and "
                  "host-level technique activity is present.",
        "caveat": "Topology inferred from the endpoints of flagged flows and attributed host "
                  "activity — not confirmed host-to-host lateral movement. The replay stream "
                  "contains no genuine inter-asset pivoting, and none is fabricated here.",
        "counts": {"sources": sum(1 for n in nodes.values() if n["kind"] == "source"),
                   "assets": sum(1 for n in nodes.values() if n["kind"] == "asset"),
                   "techniques": sum(1 for n in nodes.values() if n["kind"] == "technique")},
    }
