# CyberSentinel

Behavioural threat detection for critical national infrastructure that **improves as your
analysts use it**. Built for the ET AI Hackathon 2026, Problem Statement #7.

The rule the project runs on: **every headline number reduces to "we measured X on dataset Y,
here is the script."** Where something is simulated, the interface says so.

---

## The short version

On capture days it has never seen, the detector catches **every one of the 7 attack campaigns**
present, and **79.7% of individual malicious flows** at 82.7% precision.

Give it **500 analyst verdicts** — clicks on *real* or *false* — and per-flow recall goes to
**99.0%**.

Give it verdicts from one campaign and ask about a **different, later** campaign, and it
improves by **0.0 points**. Novel families still need their own labels.

All three are measured, reproducible, and shown in the interface. The third is why you should
believe the first two.

---

## Two heads, and why

PS#7 argues that signature-based detection fails because "by the time a signature exists, the
attack has already succeeded somewhere", and asks for baselines scored for deviation
*"without relying on known malware signatures"*.

A supervised classifier is structurally the thing being criticised. Ours recognised families it
was trained on and was blind to the rest — PortScan 4.3%, Bot 0.0%. So the detector now runs
two heads and alerts if **either** fires:

| Head | Fitted on | Catches |
|---|---|---|
| Supervised RandomForest | labelled attacks from Mon–Wed | families it has seen |
| **Novelty (IsolationForest over rank-normalised benign traffic)** | **benign traffic only — never sees an attack** | anything unlike normal |

What the second head is worth, on capture days neither has seen:

| | Supervised alone | Both heads |
|---|---|---|
| Per-flow recall | 60.1% | **79.7%** |
| PortScan | 4.3% | **52.3%** |
| Infiltration | 38.9% | **58.3%** |
| Bot | 0.0% | 0.7% |

Bot stays broken. It is in the table because a project that shows only its wins has told you
nothing about its losses.

**How the head was chosen, honestly.** Three selection criteria were tried on training-day data
and *all three were uninformative* — union recall saturates at 1.0, per-family recall is
dominated by DoS floods, and leave-one-family-out separates the candidates by 0.0003. Monday to
Wednesday contains only DoS and brute force, so nothing there resembles a port scan. The choice
rests instead on a modelling argument that stands without reference to test data: density-based
novelty detection degrades on heavy-tailed features, and rank-normalising to the benign quantile
is the standard remedy. **Every candidate's test result is published** in
`metrics/baseline.json` so the cost of that argument being wrong is visible, not hidden.

---

## Measured results

### Detection, on captures never trained on

Train Mon/Tue/Wed, test Thu/Fri. 1,012,317 held-out flows. Thresholds calibrated on a
validation split carved from the **training** days, to a 1% false-positive budget per head.

| Metric | Frozen detector | After 500 verdicts |
|---|---|---|
| **Campaigns detected** | **7 of 7 (100%)** | 7 of 7 |
| Per-flow recall | 79.7% | **99.0%** |
| Precision | 82.7% | 86.0% |
| False positive rate | 4.7% | 4.8% |
| Alerts raised | 212 per 1,000 flows | — |
| Median flows to first alert | 1 (worst campaign: 203) | — |

**Campaign detection uses a different denominator from per-flow recall and is labelled as such
everywhere it appears.** A port scan that fires 90,000 flows is one campaign; catching any one
of those flows means the scan was noticed. It is the question a SOC is actually judged on.
Timing is measured in flows elapsed, not seconds — the CIC-IDS2017 ML CSVs carry no timestamp
column, so row order within a capture is the only ordering available.

### Learning from feedback, both ways

| Setting | Before | After 500 verdicts | Verdict |
|---|---|---|---|
| Within an active campaign | 79.6% | **99.0%** | works |
| Across a later, different campaign | 79.5% | 79.5% | **no transfer** |

500 labels is 0.25% of the reviewable pool. Two configurations were tried and rejected first,
both recorded in `metrics/continual.json`. **RL was evaluated and rejected**: it needs a reward
signal we would have to invent and interaction volumes far beyond a few hundred verdicts, so it
could not be shown to beat a static baseline.

### Everything else

| Claim | Measured |
|---|---|
| ATT&CK technique attribution | 54.1% top-1, 79.7% top-3, vs 24.3% baseline (n=74, so ±11pp) |
| Cross-plane correlation | 9 incidents no single sensor would raise; 7 attacks recovered, 2 benign wrongly promoted |
| Response automation coverage | 71.4% — 5 of 7 steps autonomous, 1 gated by blast radius, 1 manual |
| Detection latency | measured p50/p95 per request, shown live |
| Zeek ingestion coverage | 31.9% of the feature space (10 direct, 12 approximated, 47 unavailable) |

---

## What is real, and what is not

| Component | Status |
|---|---|
| Both detector heads, metrics, learning loop | **Real.** Trained and evaluated by scripts in `ml/`. |
| Network telemetry | **Real** CIC-IDS2017 captures the model never trained on. |
| Host telemetry | **Real** OTRF Windows logs with ground-truth ATT&CK labels. |
| ATT&CK table | **Real** — 697 techniques from the official MITRE STIX bundle. |
| Audit ledger | **Real** SHA-256 hash chain; tampering is detected and located. |
| Indian asset mapping | Presentation only — real flows, illustrative locations. |
| Containment actions | Simulated. The approval gate and audit record are real. |
| Dwell-time baseline | Cited from Mandiant M-Trends 2024, not measured here. |

---

## Run it

```bash
cd backend && pip install -r requirements.txt
cp .env.example .env          # add GROQ_API_KEY, free at console.groq.com
python main.py                # http://localhost:8000

cd frontend && npm install && npm run dev   # http://localhost:5173
```

Only the LLM panels need the Groq key. Detection, metrics, the learning loop and the audit
chain all work without it.

### Reproduce every number

```bash
cd backend && pip install -r requirements-ml.txt
python ml/download_datasets.py     # ~1 GB, gitignored
python ml/prepare_cicids.py        # clean, dedupe, split
python ml/train_hybrid.py          # both heads + calibration -> metrics/baseline.json
python ml/eval_continual.py        # the learning result      -> metrics/continual.json
python ml/trim_mitre.py && python ml/prepare_attack_logs.py && python ml/eval_attribution.py
python ml/eval_fusion.py
python -m pytest tests -q          # 40 tests
```

The tests assert the claims, not just the routes: that the cross-capture split is the headline,
that campaign metrics are labelled as a different denominator, that the novelty head's
selection is disclosed as an a priori choice, that editing a ledger entry breaks the chain, and
that the guardrails refuse and log.

## Documentation

[ARCHITECTURE.md](ARCHITECTURE.md) — system and evaluation diagrams ·
[GAPS.md](GAPS.md) — audit against every line of PS#7 ·
[REVIEW.md](REVIEW.md) — the engineering review that drove the rebuild ·
[DEPLOYMENT.md](DEPLOYMENT.md) — hosting and demo runbook ·
[DECK_NOTES.md](DECK_NOTES.md) — slide-by-slide corrections

## Known limits

- Feedback does not transfer across campaigns — measured at exactly 0.0pp.
- Bot remains effectively undetected (0.7%) even with both heads.
- 212 alerts per 1,000 flows is a heavy load; precision is 82.7%, so roughly 5 in 6 are real.
- Attribution's ±11pp interval means "about half", not 54.1%.
- No CVE prioritisation, no digital twin, no CERT-In RAG — named gaps, see GAPS.md.
- Single process, in-memory stream state, ledger on ephemeral disk, no authentication.
