# Deck corrections — `CyberSentinel_Pitch.pdf`

The deck was written against the previous build and several of its claims no longer match the
code — some never did. This is the slide-by-slide diff. The PDF itself is not in the repository
and has to be edited by hand.

**The rule to apply throughout:** if a number appears on a slide, a judge can ask which script
produced it. Every figure below has one.

---

## Slide 3 — The Solution

| Claim | Status | Replace with |
|---|---|---|
| "Anomaly Detector — Behavioral baseline deviation scoring" | **Was false.** The old detector filtered an `is_anomaly` flag the generator itself wrote; `anomaly_score` was `random.uniform()`. | "RandomForest trained on CIC-IDS2017 — 99.3% precision, 0.15% false positive rate on 749,410 held-out flows" |
| "compressing detection from weeks to minutes" | Compares a cited industry median against nothing we measured. | "Pipeline detection latency measured at 22 ms p50 / 41 ms p95. Industry dwell-time median of 10 days (Mandiant M-Trends 2024) shown separately as context, not as our result." |
| Five agents | Now six. | Add **Correlation Engine** between Anomaly Detector and ATT&CK Mapper — it is the main innovation claim. |

## Slide 4 — Architecture & Tech Stack

| Claim | Status | Replace with |
|---|---|---|
| Data ingestion: "IoT / SCADA Sensors", "CCTV / Video Feeds" | **Never implemented.** Nothing of the kind exists. | "Network flow telemetry (CIC-IDS2017) · Windows host telemetry (OTRF/Security-Datasets)" — two real planes is a stronger claim than five imaginary ones |
| "LLM: Groq (Llama 3.1 70B)" | Wrong model. 3.1-70b was decommissioned by Groq. | "Groq `llama-3.3-70b-versatile` (free tier)" |
| "Search: Tavily + DuckDuckGo" | DuckDuckGo was never implemented. | "Tavily (optional; degrades to LLM-only briefing)" |
| "Data: MITRE ATT&CK (Open JSON) + Synthetic Logs" | The ATT&CK JSON never shipped — it ran on 21 hardcoded techniques. Synthetic logs are gone. | "MITRE ATT&CK enterprise STIX (697 techniques) · CIC-IDS2017 · OTRF/Security-Datasets" |
| "Deploy: Netlify + Railway/Render" | Railway has no real free tier; DEPLOYMENT.md says to skip it. | "Netlify (frontend) + Render (backend)" |

## Slide 5 — Key Capabilities

| Claim | Status | Replace with |
|---|---|---|
| "Compound Risk Detection — detecting combinations no single system would flag alone" | The idea was right; nothing implemented it. Now it is real **and measured**. | "Across 15,000 flows, 9 incidents that no single sensor would have raised — 7 genuine attacks recovered from the sub-threshold band, at a cost of 2 benign flows promoted" |
| "Auto-maps every anomaly to ATT&CK techniques" | Circular — the technique id was written by the generator and read back. | "Technique attribution measured at 54.1% top-1 / 79.7% top-3 against a 24.3% majority baseline, on ATT&CK-labelled captures held out one at a time" |
| "Automated containment actions (isolate, block, snapshot, report)" | Text only; nothing executed or recorded. | "71.4% of playbook steps executed autonomously, with a blast-radius gate holding anything above 10 endpoints for a human — every action sealed in a hash-chained audit ledger" |

**Add a sixth capability tile:** *Tamper-evident auditability* — SHA-256 chain over every
automated action, with a verification endpoint that names the sequence number where the chain
first breaks. This maps 1:1 onto a graded criterion and is a ten-second live demo.

## Slide 6 — Impact & Metrics

This slide needs rebuilding. Every figure on it was invented.

| Was | Now |
|---|---|
| MTTD "Weeks → 4.2 min, 99.9% faster" | **Detection latency 22 ms p50 / 41 ms p95** (measured, pipeline processing time — labelled as such, not compared to dwell time) |
| MTTR "Days → 12.8 min, 99.5% faster" | **Automation coverage 71.4%** — 5 of 7 steps autonomous, 1 gated, 1 manual |
| "False Negatives: Near-zero" | **False negative rate 0.20%**, measured — with Bot at 66.3% and SQL injection at 42.9% shown alongside, because the average hides them |
| "Playbook Time: Hours → Seconds" | **7 actions executed and sealed in the audit chain**, timings in the ledger |

Keep the CERT-In / AIIMS / CBSE context on slide 2 — that framing is sound and carries the
Business Impact weighting. Only the results slide was fabricated.

## Slide 7 — Judging Criteria Alignment

| Claim | Fix |
|---|---|
| "behavioral anomaly scoring with statistical baselines" | "A supervised detector benchmarked on CIC-IDS2017 with published precision, recall and false positive rate" |
| "Stateless FastAPI backend, horizontally scalable" | The replay stream is process-global state. Either say "single-process demo; the model and metrics are stateless and the stream is a demo fixture", or stop claiming statelessness. |

---

## The line to open with

> "Most hackathon security demos label their own test data. We trained on a public benchmark,
> evaluated on 749,410 flows we never touched, and we will show you the families our model is
> *bad* at."

That is the differentiator. Every number above survives a judge opening the repository.
