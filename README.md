# CyberSentinel

Behavioural threat detection for critical national infrastructure that **gets better while you
use it**. Built for the ET AI Hackathon 2026, Problem Statement #7.

The rule the whole project runs on: **every headline number reduces to "we measured X on dataset
Y, here is the script."** Where something is simulated, the interface says so on screen.

---

## The short version

A frozen intrusion detector catches **36.7%** of attacks on capture days it was never trained on.
That is the honest number, and it is the number most projects would hide.

Give it **500 analyst verdicts** — clicks on *real* or *false* in the triage queue — and recall
goes to **98.8%** while precision holds at 98.6% and false positives stay at 0.40%.

Give it verdicts from one campaign and ask it about a **different, later** campaign, and it
improves by **0.0 points**. Novel attack families still need their own labels.

All three of those are measured, reproducible, and shown in the UI. The third one is the reason
to believe the first two.

---

## Measured results

### Detection, on captures the model never saw

Train Monday–Wednesday, test Thursday–Friday. 1,012,317 held-out flows.

| Metric | Frozen model | After 500 analyst verdicts |
|---|---|---|
| Recall | 36.67% | **98.79%** |
| Precision | 99.18% | 98.59% |
| False positive rate | 0.09% | 0.40% |
| False negative rate | 63.33% | 1.21% |

Per-family, the same evaluation set, never labelled:

| Family | Before | After |
|---|---|---|
| PortScan | 0.3% | **99.7%** |
| Web Attack – XSS | 2.4% | **95.9%** |
| Web Attack – Brute Force | 4.9% | **88.3%** |
| DDoS | 63.5% | **99.9%** |
| **Bot** | 0.0% | **0.3%** |
| **Infiltration** | 0.0% | **0.0%** |

Bot and Infiltration still fail. They are in the table because a project that only shows its wins
has told you nothing about its losses.

**Why not the 99.8% you may have seen earlier:** a random per-family split scored that, but
CIC-IDS2017 carries no timestamp, so near-duplicate flows from a single attack burst land on both
sides of it. That figure is retained in the UI only as a labelled comparison. A depth-6 decision
tree scores F1 0.5278 against this model's 0.5354 on the honest split — the benchmark is not hard,
and the interesting part of this project is what happens after deployment.

### Learning from feedback, both ways

| Setting | Recall before | After 500 verdicts | Verdict |
|---|---|---|---|
| Within an active campaign | 36.6% | **98.8%** | works |
| Across a later, different campaign | 37.0% | 37.0% | **no transfer** |

500 labels is 0.25% of the reviewable pool. Labels are acquired by uncertainty sampling plus a
random audit quota — necessary because the frozen model scores PortScan at ~0.0, so it never
reaches an analyst's queue on its own.

Two approaches were tried and rejected first, both recorded in `metrics/continual.json`:
`SGDClassifier.partial_fit` on small batches thrashed (recall swinging 0.72/0.41/0.96, FPR 18%),
and refitted logistic regression bought +3.6pp recall for a 25× worse FPR.

**Why not reinforcement learning:** it needs a reward signal we would have to invent and
interaction volumes far beyond a few hundred verdicts, so it could not be shown to beat the static
baseline. An analyst verdict is already a label. Rejecting RL for a stated reason beats using it
undemonstrated.

### Everything else

| Claim | Measured |
|---|---|
| ATT&CK technique attribution | 54.1% top-1, 79.7% top-3, vs 24.3% majority baseline (n=74, so ±11pp) |
| Cross-plane fusion | 9 incidents no single sensor would raise; 7 attacks recovered, 2 benign wrongly promoted |
| Response automation coverage | 71.4% — 5 of 7 steps autonomous, 1 gated by blast radius, 1 manual |
| Detection latency | 22 ms p50, 41 ms p95, timed per request |
| Zeek ingestion coverage | 31.9% of the feature space (10 direct, 12 approximated, 47 unavailable) |

---

## What is real, and what is not

| Component | Status |
|---|---|
| Detector, metrics, learning loop | **Real.** Trained and evaluated by scripts in `ml/`. |
| Network telemetry | **Real** CIC-IDS2017 captures the model never trained on. |
| Host telemetry | **Real** OTRF/Security-Datasets Windows logs with ground-truth ATT&CK labels. |
| ATT&CK table | **Real** — 697 techniques from the official MITRE STIX bundle, with revocation mapping. |
| Audit ledger | **Real** SHA-256 hash chain. Tamper is detected and located. |
| Analyst verdicts in the demo | **Real clicks**, but you are the analyst. The offline evaluation simulated verdicts from ground truth. |
| Indian asset mapping (AIIMS, CBSE…) | **Illustrative.** Real flows, illustrative asset overlay. The UI says so above the numbers. |
| Containment actions | **Simulated.** No production estate is attached. The gate and audit record are real. |
| Dwell-time baseline (10 days) | **Cited** — Mandiant M-Trends 2024. Not our measurement. |
| LLM narrative and next-move projection | Generative. Reasons over real detections; not a measured claim. |

---

## Architecture

```
  Replay (unseen Thu/Fri captures)
        │
        ▼
  1 Detector          frozen RandomForest, versioned
  2 Adaptive layer    refits on analyst verdicts, gated by a 1% FPR budget
  3 Correlation       cross-plane compound incidents
  4 ATT&CK mapper     technique attribution + kill chain
  5 Threat intel      Tavily → Groq
  6 Orchestrator      playbook → executor → blast-radius gate
        │
  Audit ledger (hash-chained)   ·   Metrics registry (single source of truth)
        │
  Copilot — guarded, tool-calling, available from every screen
```

**The copilot** refuses out-of-scope requests by category and logs every refusal. Untrusted log
content never enters its system prompt: it goes in the user turn inside a fenced block, and
override phrasings are neutralised and recorded. Prompt injection has no complete fix and the code
says so rather than claiming immunity.

---

## Run it

```bash
# backend
cd backend
pip install -r requirements.txt
cp .env.example .env          # add GROQ_API_KEY, free at console.groq.com
python main.py                # http://localhost:8000

# frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Only the LLM panels need the Groq key. Detection, metrics, the learning loop and the audit chain
all work without it.

### Reproduce every number

```bash
cd backend
pip install -r requirements-ml.txt
python ml/download_datasets.py     # ~1 GB, gitignored
python ml/prepare_cicids.py        # clean, dedupe, split
python ml/train_base.py            # frozen cross-capture baseline -> metrics/baseline.json
python ml/eval_continual.py        # the learning result      -> metrics/continual.json
python ml/trim_mitre.py            # 697-technique ATT&CK table
python ml/prepare_attack_logs.py && python ml/eval_attribution.py
python ml/eval_fusion.py
python -m pytest tests -q          # 37 tests
```

The tests assert the claims, not just the routes: that the honest split is the one being served,
that no invented metric has returned, that both learning settings are reported including the one
showing no improvement, that editing a ledger entry breaks the chain, and that the guardrails
refuse and log.

## Deploying on real telemetry

`engine/ingest.py` translates Zeek `conn.log` into the model's feature vector and reports exactly
how far that gets you: **31.9%** of features — 10 direct, 12 approximated, 47 unavailable because
`conn.log` summarises a connection rather than describing each packet. `GET /api/ingest/coverage`
returns the breakdown. Closing the rest needs packet-level telemetry: Zeek packet analyzers, an
IPFIX exporter configured for per-packet metrics, or CICFlowMeter on a span port.

That is not production-ready and is not claimed to be. It makes the deployment conversation start
from a number.

## Known limits

- Feedback does not transfer across campaigns — measured at exactly 0.0pp.
- Bot and Infiltration remain undetected even after feedback.
- Attribution's ±11pp interval means "about half", not 54.1%.
- Fusion's recovery count depends on how host captures are placed onto assets; the mechanism is
  real, the magnitude is an artifact of that policy.
- The live loop cannot report its own accuracy — you choose what to label, so there is no
  held-out set. The rigorous number lives in `metrics/continual.json`.
- Single process, in-memory stream state, ledger on an ephemeral disk. No authentication.

## Docs

[REVIEW.md](REVIEW.md) — the audit that produced this rebuild ·
[PLAN.md](PLAN.md) — the plan it produced ·
[DEPLOYMENT.md](DEPLOYMENT.md) — hosting ·
[DECK_NOTES.md](DECK_NOTES.md) — slide-by-slide corrections
