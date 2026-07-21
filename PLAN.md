# CyberSentinel — Rebuild Plan (PS#7)

Status: **awaiting approval**. No code changes made yet beyond this file.
Branch: `feature` (remote `Shivansh0911/ET_AI`). No history rewrites, no force-pushes.

---

## 1. The problem statement, and exactly what the judges grade

**PS#7 — AI-Driven Cyber Resilience for Critical National Infrastructure.**
Theme: Cybersecurity / Industrial Intelligence / National Security.

The stated core problem is **detection speed**, not detection existence. APTs run low-and-slow
specifically to evade signature matching; by the time a signature exists the attack already
succeeded somewhere. So the platform must detect from *behaviour*, correlate *weak signals*
across heterogeneous IT/OT, map progression onto a known framework, and orchestrate containment
— compressing compromise→response from weeks to hours.

### The graded metrics (verbatim from "Evaluation Focus")

| # | Criterion | What we must be able to show |
|---|---|---|
| E1 | Anomaly detection rate **and false positive rate** on **benchmark datasets** | A real model, a named public dataset, a held-out split, and printed precision / recall / F1 / FPR / FNR |
| E2 | APT attribution accuracy **at MITRE ATT&CK technique level** | A number: top-1 technique accuracy against ground-truth-labelled events |
| E3 | Incident-response automation coverage (**% of playbook steps executable autonomously**) | A denominator and a numerator, per playbook |
| E4 | MTTD / MTTR improvement **versus a baseline SOC** | An honestly-defined, *measured* latency, with the baseline cited to a source — not invented |
| E5 | **Full auditability of every automated action** | An append-only, tamper-evident record, queryable and visible in the UI |

Judging weights: Innovation 25 · Business Impact 25 · Technical Excellence 20 · Scalability 15 · UX 15.

**Design rule for this rebuild:** every headline claim must reduce to *"we measured X on dataset Y,
here is the script that produces it."* A modest measured number beats an impressive unbacked one.

---

## 2. Novel angles (beyond a stock IDS demo, still buildable)

### N1 — Cross-signal fusion: incidents that no single sensor can raise
This is the literal wording of the challenge ("correlate weak signals across heterogeneous IT and
OT environments") and nothing in the current build does it.

Two **independent** telemetry planes are fused per entity over a time window:
- **Network plane** — CIC-IDS2017 flow features → ML anomaly probability.
- **Host plane** — OTRF/Security-Datasets Windows event logs → ATT&CK technique detections.

A **Correlation Engine** builds an entity–time graph (host ↔ IP ↔ technique ↔ time bucket) and
promotes a *compound incident* when two or more sub-threshold signals from **different planes**
converge on the same entity. Each compound incident carries the evidence that produced it.

**The measurable claim:** *"N of M incidents were sub-threshold on every individual sensor and
only surfaced through fusion"* — computed by re-running detection with fusion disabled. That is a
defensible innovation number, not an adjective.

### N2 — Technique-level attribution with a real accuracy figure
OTRF `Security-Datasets` ships 104 atomic datasets, each with an `attack_mappings:` block giving
the ground-truth technique + sub-technique + tactic (verified: MIT licence, ungated, small files).
That is a labelled event→technique corpus, which is exactly what E2 requires and what almost no
hackathon team will bring.

We map observed host events → technique via feature rules (process/command-line/event-ID
signatures) plus an LLM adjudicator for ambiguous cases, then score top-1 accuracy against the
ground truth across the datasets we ingest. **Reported as `attribution_top1_accuracy` over N
datasets / M distinct techniques** — with the misses shown, not hidden.

### N3 — Tamper-evident audit ledger (hash-chained)
E5 says "full auditability." Everyone will log to a list. We make it **verifiable**: every
automated action is appended as `{seq, ts, actor, action, target, params, result, blast_radius,
human_gate, prev_hash, hash}` where `hash = SHA256(prev_hash || canonical_json(entry))`.
A `GET /api/audit/verify` endpoint re-walks the chain and returns `{"intact": true, "entries": n}`;
the UI shows a live integrity badge. Tamper with one row and the badge goes red on stage — that is
a 10-second demo moment that maps 1:1 onto a graded criterion.

### N4 (supporting, not headline) — Honest latency
`MTTD` is redefined and **relabelled in the UI** as **pipeline detection latency**: wall-clock from
event ingest to scored detection, measured with real timers, reported p50/p95. The "weeks" baseline
is presented as an *industry dwell-time reference with a citation*, visually separated from our
measured number. We never again print a number we did not measure.

---

## 3. Dataset decision (researched and verified today)

| Source | Verified status | Role |
|---|---|---|
| **CIC-IDS2017** — official UNB `.zip` mirrors | ❌ `cicresearch.ca` and `205.174.165.80` both **301/302 → HTML landing page**, no direct zip | unusable anonymously |
| **CIC-IDS2017 — HF mirror `c01dsnap/CIC-IDS2017`** | ✅ ungated, all 8 original `MachineLearningCVE` CSVs, `Wednesday…csv` = **225 MB, HTTP 200** | **PRIMARY — E1 detector training + eval** |
| **OTRF/Security-Datasets** | ✅ MIT, **104** atomic datasets, each `_metadata/*.yaml` carries `attack_mappings: technique/sub-technique/tactics` | **SECONDARY — E2 attribution + kill chain** |
| `sbousseaden/EVTX-ATTACK-SAMPLES` | ✅ GPL-3.0, 6 MB — but raw `.evtx` needs a parser | fallback only |
| **mitre-attack/attack-stix-data** `enterprise-attack.json` | ✅ HTTP 200, **53 MB** | trimmed → real technique table (fixes issue 6) |
| Kaggle mirrors | ❌ require credentials | rejected |

**Handling the known CIC-IDS2017 quality problems.** The dataset has documented label and
duplication defects (Engelen et al. 2021; Lanvin et al. 2022 corrected release). We use the
original CSVs and apply, in `prepare_cicids.py`: strip whitespace from column names · drop
`NaN`/`±inf` rows · drop exact duplicate flows · drop zero-variance columns · downcast to float32 ·
**stratified** train/test split · scale. Every one of these steps is disclosed in the README and on
the metrics panel — the cleaning is part of the honesty story, not a footnote.

**What gets committed vs downloaded.** Never commit multi-GB data.
- committed: `scripts/download_datasets.py`, `data/samples/cicids_sample.csv` (~5k stratified rows, <2 MB),
  `data/mitre/techniques_trimmed.json` (~1 MB), `models/detector.joblib` (**hard cap 25 MB**), `metrics/*.json`
- gitignored: `data/raw/**` (~1 GB)

**Fallback (only if downloads break):** keep the synthetic generator, but implement a *real*
detector on it and label it **"SYNTHETIC — not a benchmark result"** everywhere it is shown.

---

## 4. Delete / Rewrite / Keep

### DELETE
- `detect_anomalies()` passthrough — the flag lookup goes, permanently.
- `mttd_minutes: 4.2` / `mttr_minutes: 12.8` in [main.py:78-79](backend/main.py#L78-L79).
- `is_anomaly` / `anomaly_score` as **detector inputs** (retained only as hidden ground truth for scoring).
- `backend/models/schemas.py` + `enums.py` as dead code — either wired into the API as response
  models or removed. `AnomalyAlert.baseline_deviation` describes a feature that never existed.
- The dead `/api` dev proxy in `vite.config.js` (never fires — `api.js` uses an absolute base URL).
- Deck claims with no implementation: IoT/SCADA sensors, CCTV/video ingestion, DuckDuckGo search,
  "Llama 3.1 70B" (code pins 3.3), "Railway" (DEPLOYMENT.md says skip it).

### REWRITE
- `agents/anomaly_detector.py` → load persisted model, score real feature vectors.
- `data/` → `loaders/` (CIC replay + OTRF host-event replay) with real timestamps.
- `agents/attack_mapper.py` → real technique table; temporally-ordered kill chain (current code
  dedupes by tactic taking the newest event then re-sorts, so displayed timestamps can run backwards).
- `agents/response_orchestrator.py` → playbook **plus** an Action Executor that performs simulated
  containment through a typed interface, with a blast-radius gate, writing to the ledger.
- `utils/mitre_loader.py` → trimmed real STIX-derived table, downloader for the full bundle.
- `main.py` → metrics served from artifacts; CORS locked; ledger endpoints; per-request latency timing.
- `README.md`, `DEPLOYMENT.md`, deck talking points + a **"What is real vs simulated"** section.

### KEEP
- The multi-agent chain shape (it is the right architecture — only its claims were false).
- `utils/groq_client.py` graceful degradation — genuinely good engineering, keep as-is.
- The whole frontend shell / dark SOC aesthetic / tab structure (15% of the score, already works).
- The India asset map — **but relabelled**: real flow features, *illustrative* asset assignment.
  Presenting CIC-IDS2017 flows as literal AIIMS traffic would be the same dishonesty we're removing.

---

## 5. Architecture

### Offline (runs locally, produces committed artifacts)
```
CIC-IDS2017 CSVs ──▶ prepare_cicids.py ──▶ clean + stratified split
                                             │
                                             ├─▶ train_detector.py ─▶ models/detector.joblib
                                             └─▶ evaluate.py ───────▶ metrics/detection.json
                                                                      (precision, recall, F1, FPR, FNR, AUC, n)

OTRF atomic datasets ─▶ prepare_attack_logs.py ─▶ labelled event→technique corpus
                                                   └─▶ eval_attribution.py ─▶ metrics/attribution.json
                                                                               (top-1 acc, N datasets, M techniques)
```

### Runtime
```
                 ┌──────────────── Replay Engine (held-out test flows + OTRF host events, real timestamps)
                 ▼
   A1  Anomaly Detector        model.predict_proba → real score          ─┐
   A2  Correlation Engine      entity–time graph → compound incidents     │  every automated
   A3  ATT&CK Mapper           technique attribution → kill chain → next  ├─▶ action appended to
   A4  Threat Intel            Tavily → Groq (unchanged)                  │   AUDIT LEDGER
   A5  Response Orchestrator   playbook + Action Executor + gate         ─┘   (hash-chained)
   A6  Copilot                 chat over real state
```
Note this is **six** stages, not the deck's five — the Correlation Engine (N1) is new and is the
main innovation claim. Deck must be updated regardless.

**Cross-cutting services:** Replay Engine, Audit Ledger, Metrics Registry (single source of truth
read by both API and dashboard — nothing hardcoded).

### Metrics contract (`GET /api/metrics`)
```json
{
  "detection":   { "dataset": "CIC-IDS2017", "source": "…", "model": "…", "precision": …,
                   "recall": …, "f1": …, "fpr": …, "fnr": …, "roc_auc": …, "test_rows": …,
                   "evaluated_at": "…", "caveats": ["duplicates dropped", "…"] },
  "attribution": { "corpus": "OTRF Security-Datasets", "top1_accuracy": …, "n_datasets": …, "n_techniques": … },
  "automation":  { "playbook_steps": …, "autonomous_steps": …, "coverage_pct": … },
  "latency":     { "label": "pipeline detection latency (measured)", "p50_ms": …, "p95_ms": … },
  "baseline":    { "label": "industry dwell time (cited reference, NOT measured by us)", "source": "…" }
}
```
Every field carries its own provenance. The UI renders "measured" and "cited" in visually
different styles.

---

## 6. Build order and checkpoints

| CP | Deliverable | Commit | Gate |
|---|---|---|---|
| **CP1** | `download_datasets.py` + `prepare_cicids.py`; sample committed; `data/raw` gitignored | "Add reproducible dataset acquisition + cleaning pipeline" | dataset downloads and cleans end-to-end on a fresh clone |
| **CP2** | Trained detector + `metrics/detection.json` with real P/R/F1/FPR/FNR | "Train real intrusion detector on CIC-IDS2017 benchmark" | **the single biggest credibility fix — E1 satisfied** |
| **CP3** | Replay engine; API serves real detections; hardcoded MTTD/MTTR deleted; real latency timers | "Replace passthrough detection with model inference; emit measured metrics" | dashboard shows numbers traceable to CP2 |
| **CP4** | Trimmed real ATT&CK JSON; OTRF corpus; `metrics/attribution.json` | "Add real ATT&CK technique table and measured attribution accuracy" | E2 satisfied; issue 6 closed |
| **CP5** | Correlation Engine + compound incidents + fusion-vs-no-fusion delta | "Add cross-signal correlation engine for compound incident detection" | N1 number exists |
| **CP6** | Action Executor + hash-chained ledger + `/api/audit/verify` | "Add tamper-evident audit ledger for all automated actions" | E5 + E3 satisfied |
| **CP7** | Frontend: honest metrics panel, Audit tab w/ integrity badge, real-vs-simulated banner | "Surface measured metrics and audit ledger in dashboard" | demo-ready |
| **CP8** | CORS locked to deployed origin; `VITE_API_URL` build guard + `netlify.toml`; README / DEPLOYMENT / deck rewritten | "Harden deployment config and correct all documentation claims" | issues 3, 4 closed |

**Priority if time runs short:** CP1→CP3 are non-negotiable (they fix the false claim).
CP6 next (pure rubric points, low risk). CP5 then CP4. CP7/CP8 can be compressed.

## 7. Risks

- **Render free tier is 512 MB RAM.** Model artifact capped at 25 MB; prefer a depth-limited
  RandomForest / ExtraTrees, fall back to LogisticRegression + IsolationForest. RSS measured at CP3.
- **New backend deps** (`scikit-learn`, `joblib`, `pandas`, `numpy`) slow Render cold starts —
  UptimeRobot pinger already in DEPLOYMENT.md keeps it warm; verify build stays under the free build timeout.
- **~1 GB local download.** 47 GB free on `C:` — fine. Local only.
- **Groq free-tier quota during judging** — `/api/compound-analysis` currently calls the LLM on
  every request with no caching; add TTL caching at CP3 or the demo will rate-limit on stage.
- **Scope.** N1/N2/N3 are all defensible on their own; if one slips, the other two still land.

## 8. Open questions for approval

1. **Six stages instead of five** (adding the Correlation Engine) — approve?
2. **Map relabelling.** Keep the India map with an explicit "illustrative asset mapping" label, or
   drop the Indian-asset framing entirely and present real dataset entities? Recommendation: keep
   with the label — the CNI framing is worth 25% Business Impact, and the label keeps it honest.
3. **Deck.** I can produce corrected talking points + a slide-by-slide diff, but I cannot re-render
   `CyberSentinel_Pitch.pdf`. Is a `DECK_NOTES.md` the right deliverable?
4. **Push.** Commit locally on `feature` only, or also push to `origin/feature`?
