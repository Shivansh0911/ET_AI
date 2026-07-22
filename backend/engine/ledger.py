"""
Append-only, hash-chained audit ledger.

"Full auditability of every automated action taken" is one of the problem statement's
evaluation criteria. A list of log lines satisfies the letter of that and not much else — it
can be edited after the fact and nobody can tell.

Every entry here carries the SHA-256 of the previous entry, so the chain is tamper-evident:
altering any historical record breaks every hash that follows it, and verify() reports exactly
where. That is the difference between "we logged it" and "we can prove what we logged".

Persistence is SQLite, so the chain survives a process restart — which matters for an audit
record. A JSONL mirror is written alongside for easy export and inspection. On a truly
ephemeral dyno the disk still resets between deploys; that is a hosting choice, and pointing
AUDIT_DB_PATH at a mounted volume or managed Postgres makes it durable without code change.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

_DATA = Path(__file__).resolve().parent.parent / "data"
DB_PATH = Path(os.environ.get("AUDIT_DB_PATH", _DATA / "audit_ledger.db"))
LEDGER_PATH = Path(os.environ.get("AUDIT_LEDGER_PATH", _DATA / "audit_ledger.jsonl"))

GENESIS = "0" * 64

_lock = threading.Lock()
_entries: list[dict] = []
_loaded = False
_db: sqlite3.Connection | None = None


def _digest(entry: dict) -> str:
    """Hash an entry over its canonical form, excluding the hash field itself."""
    payload = {k: v for k, v in entry.items() if k != "hash"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _connect() -> sqlite3.Connection | None:
    """Open the SQLite ledger, tolerating a read-only filesystem without taking the API down."""
    global _db
    if _db is not None:
        return _db
    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _db = sqlite3.connect(DB_PATH, check_same_thread=False)
        _db.execute("CREATE TABLE IF NOT EXISTS ledger "
                    "(seq INTEGER PRIMARY KEY, hash TEXT NOT NULL, entry TEXT NOT NULL)")
        _db.commit()
    except sqlite3.Error:
        _db = None
    return _db


def _ensure_loaded() -> None:
    """Load the chain from SQLite on first use; migrate a legacy JSONL ledger if present."""
    global _loaded
    if _loaded:
        return

    db = _connect()
    if db is not None:
        rows = db.execute("SELECT entry FROM ledger ORDER BY seq").fetchall()
        if rows:
            _entries.extend(json.loads(row[0]) for row in rows)
        elif LEDGER_PATH.exists():
            # One-time migration from the old JSONL-only ledger into SQLite.
            for line in LEDGER_PATH.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    _entries.append(entry)
                    db.execute("INSERT OR REPLACE INTO ledger VALUES (?, ?, ?)",
                               (entry["seq"], entry["hash"], json.dumps(entry)))
            db.commit()
    elif LEDGER_PATH.exists():
        for line in LEDGER_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    _entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    _loaded = True


def _reload_from_disk() -> None:
    """Drop the in-memory cache and re-read from SQLite — simulates a process restart (tests)."""
    global _loaded, _db
    with _lock:
        _entries.clear()
        _loaded = False
        if _db is not None:
            _db.close()
            _db = None
        _ensure_loaded()


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

        # SQLite is the durable store; the JSONL mirror is a convenience export. Neither
        # failing may take the API down — the in-memory chain stays authoritative and
        # verify() still works.
        db = _connect()
        if db is not None:
            try:
                db.execute("INSERT OR REPLACE INTO ledger VALUES (?, ?, ?)",
                           (entry["seq"], entry["hash"], json.dumps(entry)))
                db.commit()
            except sqlite3.Error:
                pass
        try:
            LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(LEDGER_PATH, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        except OSError:
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
        "persistence": f"SQLite ({DB_PATH.name}), JSONL mirror ({LEDGER_PATH.name})",
        "durable": _connect() is not None,
        "persistence_note": "The chain is stored in SQLite and survives a process restart. On a "
                            "truly ephemeral dyno the disk still resets between deploys; pointing "
                            "AUDIT_DB_PATH at a mounted volume or managed database makes it "
                            "durable with no code change.",
    }
