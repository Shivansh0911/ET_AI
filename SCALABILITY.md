# Scalability

An honest map of what scales today, what does not, and the concrete path to horizontal scale.
The point of this page is that the gap is a hosting/wiring choice, not a design dead-end.

## What is stateless today

| Component | State | Scales horizontally as-is? |
|---|---|---|
| Detector (both heads) | Immutable model artifacts loaded read-only | **Yes.** Any worker can score any flow. |
| Metrics endpoints | Read committed JSON artifacts | **Yes.** Pure reads. |
| ATT&CK table, CVE slice | Read-only bundled data | **Yes.** |
| Attribution, correlation, graph, remediation | Pure functions over the request's data | **Yes.** No shared mutable state. |
| Audit ledger | **SQLite on disk** (was in-memory + JSONL) | **Survives restart**; see below for multi-worker. |

## What is process-global today

Two things hold mutable state in the process, and both are demo conveniences rather than
architecture:

1. **The replay stream** (`_stream`, `_detections`, `_incidents`, `_graph` in `main.py`). This is
   a *demo fixture* — a fixed window of held-out flows re-scored on demand so the dashboard has
   something live to show. A production deployment does not replay a fixture; it consumes a real
   telemetry stream, which is externalised by definition.
2. **The live feedback model** (`engine/feedback.py`). Analyst verdicts accumulate in memory and
   the adaptive layer refits from them. Across multiple workers this must move to a shared store.

## The path to horizontal scale

```
                    ┌──────────────┐
   telemetry  ─────▶│  ingest /    │─────▶  message queue (Kafka / Redis Streams)
   (Zeek, NetFlow)  │  adapters    │              │
                    └──────────────┘              ▼
                                        ┌─────────────────────┐
                                        │  N stateless workers │  ← detector artifacts (read-only)
                                        │  score + correlate   │
                                        └─────────────────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                        ▼                       ▼
                  shared feedback store    audit ledger (Postgres)   metrics store
                  (Redis / Postgres)       hash chain preserved      (object storage)
```

Concretely, three changes take this from single-process to N workers, none of them a rewrite:

1. **Externalise the stream.** Replace the in-process replay fixture with a queue consumer. The
   scoring path is already a pure function of a feature vector, so workers need no shared state to
   score.
2. **Externalise the ledger.** The hash chain is storage-agnostic — it is SHA-256 over canonical
   JSON with each entry sealing its predecessor. Today it writes to SQLite (`AUDIT_DB_PATH`);
   pointing that at Postgres, with a single-writer or an advisory lock to serialise appends, keeps
   the chain intact across workers. Verification logic does not change.
3. **Externalise the feedback model.** Move accumulated verdicts to Redis/Postgres and have a
   single retrain worker publish new adaptive weights that scoring workers load — the same
   pattern as the base artifact, just refreshed periodically.

## What is deliberately not done

Auth is a single bearer token (`CYBERSENTINEL_TOKEN`) on the state-changing endpoints, not a full
identity system — enough to gate containment and feedback, honestly scoped for a prototype. Rate
limiting, per-tenant isolation, and RBAC are named here as the next steps rather than half-built.

## Measured footprint

253 MB RSS with both detector heads and the novelty transformer loaded, against Render's 512 MB
free tier — one worker fits comfortably, with headroom. The model artifacts total ~9 MB and load
lazily on first request.
