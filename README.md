# CyberSentinel — AI-Powered Cyber Resilience Platform

An AI-driven cyber threat detection and response platform for critical national infrastructure,
built for the ET AI Hackathon 2026 (**Problem Statement #7**).

Its governing rule: **every headline number reduces to "we measured X on dataset Y, here is the
script that produces it."** Where something is simulated, the platform says so on screen.

---

## What is real, and what is simulated

| Component | Status |
|---|---|
| Intrusion detection model | **Real.** RandomForest trained on CIC-IDS2017, evaluated on 749,410 held-out flows. |
| Detection metrics (P/R/F1/FPR/FNR/AUC) | **Real.** Produced by `ml/train_detector.py`, written to `metrics/detection.json`. |
| Network telemetry in the live stream | **Real.** Held-out CIC-IDS2017 flows the model never saw during training. |
| Host telemetry | **Real.** OTRF/Security-Datasets Windows captures with ground-truth ATT&CK labels. |
| ATT&CK technique attribution | **Real.** Measured by leave-one-dataset-out cross validation. |
| ATT&CK technique table | **Real.** 697 techniques from the official MITRE STIX bundle. |
| Detection latency | **Real.** Timed at request time, reported p50/p95. |
| Cross-plane fusion recovery | **Real.** Measured against an explicit fusion-off counterfactual. |
| Audit ledger | **Real.** SHA-256 hash chain, verifiable, tamper-detecting. |
| **Indian asset mapping** (AIIMS, CBSE, PowerGrid…) | **Illustrative.** A presentation layer over real flows. These are not Indian networks and the UI says so. |
| **Containment actions** (isolate, block, revoke…) | **Simulated.** No production estate is attached. The classification, blast-radius gate and audit record are real. |
| **Dwell-time baseline** (10 days) | **Cited**, not measured — Mandiant M-Trends 2024. |
| LLM narrative (compound analysis, next-move, copilot) | Generative. Reasons over the real detections above; not a measured claim. |

---

## Measured results

### Detection — CIC-IDS2017

| Metric | Value |
|---|---|
| Precision | 99.26% |
| Recall | 99.80% |
| F1 | 99.53% |
| False positive rate | 0.15% |
| False negative rate | 0.20% |
| ROC AUC | 0.9998 |

Evaluated on **749,410 held-out flows** (127,732 attack / 621,678 benign) at their true class
balance. Training subsamples the majority class; the test split is never rebalanced, because
doing so would flatter precision and understate the false positive rate.

**Where it is weak** — reported, not averaged away:

| Attack family | Test flows | Detection rate |
|---|---|---|
| Bot | 585 | 66.3% |
| Web Attack – SQL Injection | 7 | 42.9% |
| Infiltration | 12 | 83.3% |
| Web Attack – XSS | 197 | 95.4% |
| (everything else) | — | ≥ 98.6% |

### ATT&CK technique attribution — OTRF/Security-Datasets

| Metric | Value |
|---|---|
| Top-1 accuracy | 54.1% |
| Top-3 accuracy | 79.7% |
| Majority-class baseline | 24.3% |

74 dataset–technique samples over 10 techniques, scored by leave-one-dataset-out so every
prediction concerns a capture absent from training. 22 techniques are excluded because a single
dataset exercises them, which leave-one-out cannot predict. The configuration was chosen against
this same estimate, so the figure is mildly optimistic. Every misclassification is listed in
`metrics/attribution.json`.

### Cross-plane fusion

Across 25 replay windows totalling 15,000 flows, the detector alone missed 78 genuine attacks;
60 sat in the 0.20–0.50 sub-threshold band. Fusion with the host plane raised 415 incidents, **9
of which no single sensor would have raised**, recovering **7 true attacks** at a cost of **2
benign flows wrongly promoted**. Both sides of that trade are reported.

### Response automation coverage

On the standard containment playbook: **71.4% coverage** — 7 steps, 5 executed autonomously,
1 held for human approval by the blast-radius gate, 1 with no automated form. Steps that cannot
be automated count in the denominator rather than being excluded from it.

---

## Architecture

Six stages over two independent telemetry planes, plus two cross-cutting services.

```
   Replay Engine ──▶ 1 Anomaly Detector      RandomForest probability per flow
                     2 Correlation Engine    cross-plane compound incidents
                     3 ATT&CK Mapper         technique attribution, kill chain, next move
                     4 Threat Intel          Tavily search -> Groq briefing
                     5 Response Orchestrator LLM playbook -> Action Executor -> gate
                     6 Copilot               conversational access to current state
                              │
                     Audit Ledger (hash-chained)  ·  Metrics Registry (single source of truth)
```

## Tech Stack

- **Backend**: FastAPI, scikit-learn, NumPy, Groq SDK, Tavily SDK
- **Frontend**: React 18 + Vite, Tailwind CSS, Recharts, Lucide
- **Data**: CIC-IDS2017 · OTRF/Security-Datasets · MITRE ATT&CK STIX
- **LLM**: Groq `llama-3.3-70b-versatile` (free tier only — no paid APIs)

## Setup

### Reproduce the models and metrics

```bash
cd backend
pip install -r requirements-ml.txt

python ml/download_datasets.py       # ~1 GB, never committed
python ml/prepare_cicids.py          # clean + split -> data/processed/
python ml/train_detector.py          # -> ml/artifacts/detector.joblib, metrics/detection.json
python ml/trim_mitre.py              # -> data/mitre/techniques.json
python ml/prepare_attack_logs.py     # -> ATT&CK-labelled corpus
python ml/eval_attribution.py        # -> metrics/attribution.json
python ml/eval_fusion.py             # -> metrics/fusion.json
```

The trained artifacts and metrics are committed, so this is only needed to verify or retrain.

### Run

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env                 # add GROQ_API_KEY (free at console.groq.com)
python main.py                       # http://localhost:8000
```

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard` | KPIs, detections, geospatial rollup |
| `GET /api/metrics` | Every measured figure, each tagged with its provenance |
| `GET /api/incidents` | Compound incidents, fusion-only flagged |
| `GET /api/attribution` | Technique predictions beside ground truth, misses included |
| `GET /api/kill-chain` | Observed ATT&CK progression + LLM next-move projection |
| `GET /api/audit` · `/api/audit/verify` | The hash chain and its integrity state |
| `POST /api/audit/simulate-tamper` | Tamper detection demo, run against a copy |
| `POST /api/respond` | Draft playbook, execute what is executable, record all of it |
| `POST /api/copilot` | Conversational access to the current state |
| `POST /api/refresh` | Re-score a fresh slice of held-out flows |

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Deck talking points corrected against reality live in
[DECK_NOTES.md](DECK_NOTES.md).

## Dataset notes

CIC-IDS2017 has documented label and duplication defects (Engelen et al. 2021; Lanvin et al.
2022 published a corrected release). We use the original CSVs and disclose the cleaning:
whitespace-stripped headers, the duplicated `Fwd Header Length.1` column dropped, NaN/±inf rows
removed, 329,206 exact duplicate flows removed globally, 8 zero-variance features dropped. Full
counts in `metrics/dataset_report.json`. `Destination Port` is retained as a feature and carries
service-identity signal that can flatter a classifier on this dataset.
