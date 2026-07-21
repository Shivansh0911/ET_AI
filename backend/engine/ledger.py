"""
Append-only, hash-chained audit ledger.

"Full auditability of every automated action taken" is one of the problem statement's
evaluation criteria. A list of log lines satisfies the letter of that and not much else — it
can be edited after the fact and nobody can tell.

Every entry here carries the SHA-256 of the previous entry, so the chain is tamper-evident:
altering any historical record breaks every hash that follows it, and verify() reports exactly
where. That is the difference between "we logged it" and "we can prove what we logged".

Persistence is a JSONL file. On an ephemeral free-tier dyno that file does not survive a
restart, which is a deployment limitation rather than a design one and is stated as such in
the API response.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

LEDGER_PATH = Path(os.environ.get(
    "AUDIT_LEDGER_PATH",
    Path(__file__).resolve().parent.parent / "data" / "audit_ledger.jsonl"))

GENESIS = "0" * 64

_lock = threading.Lock()
_entries: list[dict] = []
_loaded = False


def _digest(entry: dict) -> str:
    """Hash an entry over its canonical form, excluding the hash field itself."""
    payload = {k: v for k, v in entry.items() if k != "hash"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    if LEDGER_PATH.exists():
        for line in LEDGER_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    _entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    _loaded = True


def append(actor: str, action: str, target: str, params: dict | None = None,
           result: str = "ok", blast_radius: int = 1, human_gate: str = "not_required",
           evidence: dict | None = None) -> dict:
    """Record one action. Returns the sealed entry."""
    with _lock:
        _ensure_loaded()
        previous = _entries[-1]["hash"] if _entries else GENESIS
        entry = {
            "seq": len(_entries) + 1,
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "actor": actor,
            "action": action,
            "target": target,
            "params": params or {},
            "result": result,
            "blast_radius": blast_radius,
            "human_gate": human_gate,
            "evidence": evidence or {},
            "prev_hash": previous,
        }
        entry["hash"] = _digest(entry)
        _entries.append(entry)

        try:
            LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(LEDGER_PATH, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        except OSError:
            # A read-only or full filesystem must not take the API down; the in-memory
            # chain stays authoritative for this process and verify() still works.
            pass

        return entry


def entries(limit: int | None = None) -> list[dict]:
    with _lock:
        _ensure_loaded()
        return list(_entries[-limit:] if limit else _entries)


def verify(chain: list[dict] | None = None) -> dict:
    """Re-walk the chain and report the first break, if any."""
    with _lock:
        _ensure_loaded()
        records = chain if chain is not None else _entries

    previous = GENESIS
    for position, entry in enumerate(records):
        if entry.get("prev_hash") != previous:
            return {"intact": False, "entries": len(records), "broken_at": entry.get("seq", position + 1),
                    "reason": "prev_hash does not match the preceding entry"}
        if _digest(entry) != entry.get("hash"):
            return {"intact": False, "entries": len(records), "broken_at": entry.get("seq", position + 1),
                    "reason": "entry contents do not match their recorded hash"}
        previous = entry["hash"]

    return {
        "intact": True,
        "entries": len(records),
        "head": records[-1]["hash"] if records else GENESIS,
        "algorithm": "SHA-256 chain over canonical JSON, each entry sealing its predecessor",
    }


def simulate_tamper() -> dict:
    """Show what verification does to an altered record — on a copy, never the real chain."""
    with _lock:
        _ensure_loaded()
        if not _entries:
            return {"available": False, "reason": "ledger is empty — execute a playbook first"}
        copied = [dict(e) for e in _entries]

    index = len(copied) // 2
    original = copied[index]["target"]
    copied[index] = {**copied[index], "target": "attacker-controlled-host"}

    return {
        "available": True,
        "note": "Run against a copy of the ledger. The live chain is untouched.",
        "altered_entry": copied[index]["seq"],
        "field": "target",
        "from": original,
        "to": "attacker-controlled-host",
        "verification_before": verify(),
        "verification_after": verify(copied),
    }


def stats() -> dict:
    with _lock:
        _ensure_loaded()
        automated = sum(1 for e in _entries if e["human_gate"] == "not_required")
        gated = sum(1 for e in _entries if e["human_gate"] != "not_required")
    return {
        "total_actions": len(_entries),
        "executed_autonomously": automated,
        "held_for_human_approval": gated,
        "persistence": str(LEDGER_PATH),
        "persistence_caveat": "Free-tier dynos have ephemeral disks; the chain restarts with "
                              "the process. Durability is a hosting choice, not a design limit.",
    }
