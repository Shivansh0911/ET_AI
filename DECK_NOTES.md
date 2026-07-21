# Deck corrections — `CyberSentinel_Pitch.pdf`

The PDF is not in the repository, so these are the edits to make by hand. Every number below is
produced by a script in `backend/ml/` and visible in the running UI.

**The test to apply to each slide:** could a judge open the repo and reproduce this? If not, cut it.

---

## The story to tell

The deck currently pitches "AI detects threats". Every team will pitch that. Pitch this instead:

> **Our detector catches 37% of attacks it has never seen. We will show you.
> Then we will fix it live, on stage, in ninety seconds — and show you where it still fails.**

That is a demo nobody else in the room can give, because it requires having measured the failure
first. Innovation (25%) and Technical Excellence (20%) both land on it.

---

## Slide 3 — The Solution

| Claim | Status | Replace with |
|---|---|---|
| "Behavioral baseline deviation scoring" | **Was false** — the old detector filtered a flag the generator wrote, and `anomaly_score` was `random.uniform()` | "RandomForest trained on CIC-IDS2017, evaluated on 1,012,317 flows from capture days it never trained on" |
| "compressing detection from weeks to minutes" | Compares a cited median against nothing we measured | "22 ms p50 pipeline latency, measured. Dwell-time median of 10 days (Mandiant M-Trends 2024) shown separately as cited context." |
| Five agents | Now six, plus a learning loop | Add **Adaptive layer** — the thing that makes this different |

## Slide 4 — Architecture & Tech Stack

| Claim | Status | Replace with |
|---|---|---|
| "IoT / SCADA Sensors", "CCTV / Video Feeds" | **Never existed** | "Network flows (CIC-IDS2017) + Windows host telemetry (OTRF)" — two real planes beats five imaginary ones |
| "Groq (Llama 3.1 70B)" | Wrong; 3.1-70b was decommissioned | "Groq `llama-3.3-70b-versatile`" |
| "Tavily + DuckDuckGo" | DuckDuckGo never implemented | "Tavily, optional" |
| "MITRE ATT&CK (Open JSON) + Synthetic Logs" | The JSON never shipped — it ran on 21 hardcoded techniques | "697 techniques from the official MITRE STIX bundle, with ATT&CK's 2026 revocations mapped" |
| "Railway/Render" | Railway has no real free tier | "Netlify + Render" |

**Add a row:** *Ingestion — Zeek `conn.log` adapter, 31.9% feature coverage, gap enumerated.*
It sounds modest. It is the answer to "could you actually deploy this?", and most teams will have
no answer at all.

## Slide 5 — Key Capabilities

| Claim | Replace with |
|---|---|
| "Compound Risk Detection" | "9 incidents across 15,000 flows that no single sensor would have raised — 7 genuine attacks recovered, 2 benign flows wrongly promoted. Both sides reported." |
| "Auto-maps every anomaly to ATT&CK" | "54.1% top-1 technique attribution (±11pp at n=74) against a 24.3% baseline, leave-one-dataset-out" |
| "Automated containment actions" | "71.4% of playbook steps executed autonomously; anything above 10 endpoints waits for a human; every action sealed in a hash chain" |

**Replace the weakest tile with the headline capability:**
*Learns from your analysts* — 500 verdicts, recall 36.7% → 98.8%, FPR 0.09% → 0.40%.

**And add:** *Tamper-evident auditability* — edit one ledger row and verification names the entry
that broke. Ten-second live demo, maps directly onto a graded criterion.

## Slide 6 — Impact & Metrics

Rebuild entirely. Every figure on it was invented.

| Was (invented) | Now (measured) |
|---|---|
| MTTD "Weeks → 4.2 min, 99.9% faster" | **Recall 36.7% → 98.8% after 500 analyst verdicts** — with the learning curve |
| MTTR "Days → 12.8 min, 99.5% faster" | **71.4% automation coverage**, 1 step gated, 1 manual |
| "False Negatives: Near-zero" | **FNR 63.3% → 1.2%**, with Bot at 0.3% and Infiltration at 0.0% shown alongside |
| "Playbook Time: Hours → Seconds" | **22 ms p50 detection latency**, and 7 actions sealed in the ledger |

**Add the slide that wins the room** — *Where it still fails*: Bot 0.3%, Infiltration 0.0%,
attribution ±11pp, and feedback transferring 0.0pp to a different campaign. Volunteering your
limits is the strongest possible signal that the rest of your numbers are real.

Keep slide 2's CERT-In / AIIMS / CBSE framing. That context is sound and carries Business Impact.

## Slide 7 — Judging Criteria Alignment

| Claim | Fix |
|---|---|
| "behavioral anomaly scoring with statistical baselines" | "A supervised detector benchmarked on unseen captures, improved by analyst feedback, with published precision, recall and false positive rate at every stage" |
| "Stateless FastAPI backend, horizontally scalable" | Not true — the stream is process-global state. Say "single-process demo; the model and metrics are stateless, the stream is a demo fixture." |

---

## Answers to the three questions you will be asked

**"Isn't CIC-IDS2017 easy?"**
Yes. A depth-6 decision tree gets F1 0.5278 on our split against our 0.5354, and we publish that
column. Which is why the submission is not about the classifier — it is about what happens after
it meets traffic it does not know.

**"Your metrics look too good."**
The ones that look too good are the random-split numbers, and we demoted them for exactly that
reason. Our headline is 36.7% recall. The 98.8% is what 500 human verdicts buy, and the same
experiment shows those verdicts buying 0.0 points against a different campaign.

**"Could this run on a real network?"**
Not yet, and we can tell you precisely how far off: our Zeek adapter fills 31.9% of the feature
space. The other 47 features need packet-level telemetry. That number is an endpoint in the API.
