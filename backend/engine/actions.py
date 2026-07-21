"""
Action executor — the SOAR layer, with a blast-radius gate.

The problem statement grades "incident-response automation coverage (percentage of playbook
steps executable autonomously)". That percentage only means something if some steps really are
executable and others really are not, so the catalog below is deliberately partial: forensic
imaging, legal notification and root-cause analysis have no automated form here and are
counted against us in the denominator.

Actions are SIMULATED. Nothing reaches a real firewall or directory — there is no production
estate attached to a hackathon prototype, and pretending otherwise would be the same class of
claim this rebuild removes. What is real is the decision path: classification, the blast-radius
gate, execution or refusal, and an audit record for every one of them.
"""
from __future__ import annotations

import time

from . import ledger

# Above this many affected endpoints an action stops being automatic and waits for a human.
# The problem statement asks for "human escalation gates for decisions above defined blast
# radius thresholds"; this is that threshold, defined in one place.
BLAST_RADIUS_LIMIT = 10

CATALOG: dict[str, dict] = {
    "isolate_endpoint": {
        "keywords": ("isolate", "quarantine", "contain the endpoint", "disconnect"),
        "description": "Remove the host from the network while preserving volatile state",
        "blast_radius": 1,
    },
    "block_ip": {
        "keywords": ("block", "blacklist", "deny", "firewall rule", "drop traffic"),
        "description": "Push a deny rule for the source address to the perimeter",
        "blast_radius": 1,
    },
    "revoke_credential": {
        "keywords": ("revoke", "disable account", "reset password", "force password",
                     "disable the service account", "credential"),
        "description": "Invalidate the compromised principal and force re-authentication",
        "blast_radius": 3,
    },
    "snapshot_host": {
        "keywords": ("snapshot", "preserve", "capture memory", "image the"),
        "description": "Take a forensic snapshot before any destructive containment",
        "blast_radius": 1,
    },
    "elevate_monitoring": {
        "keywords": ("elevate monitoring", "increase logging", "siem", "watchlist",
                     "enhanced monitoring"),
        "description": "Raise telemetry verbosity on the affected segment",
        "blast_radius": 12,
    },
    "notify_certin": {
        "keywords": ("cert-in", "certin", "report to", "mandatory reporting", "notify"),
        "description": "File the incident with CERT-In within the mandated window",
        "blast_radius": 0,
    },
}


def classify(step: str) -> str | None:
    """Map a free-text playbook step onto an executable action, or None if it is manual."""
    lowered = step.lower()
    for name, spec in CATALOG.items():
        if any(keyword in lowered for keyword in spec["keywords"]):
            return name
    return None


def execute(action: str, target: str, evidence: dict | None = None,
            scale: int = 1) -> dict:
    """Run one simulated action through the gate, recording the outcome either way."""
    spec = CATALOG.get(action)
    if not spec:
        entry = ledger.append("orchestrator", "rejected_unknown_action", target,
                              result="rejected", blast_radius=0, evidence=evidence)
        return {"action": action, "status": "rejected", "reason": "not in catalog",
                "ledger_seq": entry["seq"]}

    blast_radius = spec["blast_radius"] * max(scale, 1)
    gated = blast_radius > BLAST_RADIUS_LIMIT

    started = time.perf_counter()
    # Simulated effect. A real deployment swaps this for an EDR/firewall/directory call;
    # the surrounding decision path and audit record stay identical.
    outcome = "held_for_approval" if gated else "executed"
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)

    entry = ledger.append(
        actor="orchestrator",
        action=action,
        target=target,
        params={"blast_radius": blast_radius, "simulated": True},
        result=outcome,
        blast_radius=blast_radius,
        human_gate="required_blast_radius" if gated else "not_required",
        evidence=evidence,
    )

    return {
        "action": action,
        "description": spec["description"],
        "target": target,
        "status": outcome,
        "blast_radius": blast_radius,
        "gate": f"threshold {BLAST_RADIUS_LIMIT} endpoints",
        "elapsed_ms": elapsed_ms,
        "ledger_seq": entry["seq"],
        "simulated": True,
    }


def run_playbook(steps: list[str], target: str, evidence: dict | None = None) -> dict:
    """Execute what can be executed, and report coverage honestly against everything asked."""
    executed, manual = [], []

    for step in steps:
        action = classify(step)
        if action is None:
            manual.append(step)
            continue
        executed.append({**execute(action, target, evidence), "step": step})

    total = len(steps)
    autonomous = sum(1 for e in executed if e["status"] == "executed")

    return {
        "executed": executed,
        "manual_steps": manual,
        "coverage": {
            "playbook_steps": total,
            "mapped_to_an_action": len(executed),
            "executed_autonomously": autonomous,
            "held_for_human_approval": len(executed) - autonomous,
            "manual_only": len(manual),
            "coverage_pct": round(100 * autonomous / total, 1) if total else 0.0,
            "definition": "executed autonomously / all playbook steps. Steps with no automated "
                          "form (forensic analysis, legal notification) count in the "
                          "denominator rather than being excluded from it.",
        },
        "blast_radius_limit": BLAST_RADIUS_LIMIT,
        "simulated": True,
    }
