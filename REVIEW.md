# CyberSentinel — Engineering Review

Reviewer brief: decide whether to fund this. ET AI Hackathon 2026, Problem Statement #7.
Scope: backend, ML, frontend, deploy. ~2,980 lines of Python, ~1,379 lines of JSX.

**Disclosure:** I wrote most of the current code earlier in this session. This review holds it to
the standard I would apply to someone else's, which means the hardest findings below are against
my own work. Every claim here was verified by running something, not by reading.

---

## 1. VERDICT

| Dimension | Score | One-line justification |
|---|---|---|
| Problem fit | **8/10** | PS#7 asks for behavioural detection, weak-signal correlation, ATT&CK mapping and orchestrated response. All six exist and map cleanly onto the brief. |
| Technical depth | **5/10** | A depth-6 decision tree reaches F1 0.9715 on this benchmark; the shipped forest reaches 0.9957. The ML is competent, not deep. The interesting engineering is the audit chain and the fusion layer. |
| ML rigor | **4/10** | Metrics are honest and reproducible *for the split they describe* — but the split is the wrong one, and it flatters the model by ~63 points of recall. See §2. This is the finding that matters. |
| Real-world deployability | **3/10** | The model consumes CICFlowMeter-derived bidirectional flow statistics. No real SOC emits those. There is no ingestion path, no persistence, no auth, and process-global mutable state. |
| UX / design | **4/10** | Structurally sound, visually generic. Neon-on-black, 14 accent colours, monospace used as decoration, and LLM markdown rendering as literal `**text**` in three places. |
| Demo-readiness | **8/10** | Runs end-to-end, every endpoint returns 200, the tamper demo is genuinely good theatre, and the provenance labelling is unusual and defensible. |

### Would this win as-is?

**No — but it is two days of work away from being the most credible submission in the room, and
the gap is not where you would guess.**

What it has that almost nothing else will: a public benchmark instead of self-labelled synthetic
data, a per-family table that voluntarily shows where the model is *bad*, a hash-chained audit
ledger that fails visibly on tamper, and a provenance vocabulary that separates measured from
cited. Those are genuine differentiators against a field that will mostly present LLM wrappers
with invented metrics.

What kills it under questioning: **the headline 99.8% recall does not survive contact with an
unseen capture.** Trained on Monday–Wednesday and tested on Thursday–Friday, recall collapses to
**36.7%** — PortScan 0.3%, Bot 0%, Infiltration 0%. The problem statement is explicitly about APTs
that evade signature-based detection, which is to say *novel* behaviour. The current evaluation
measures the opposite: recognition of attack families already seen in training. One judge asking
"how does it do on an attack type it has never seen?" ends the conversation.

Second-order gaps: the ML has no learning loop (it is a static pickle), the copilot has no
guardrails and interpolates untrusted log text straight into its system prompt, there are zero
tests, and the UI looks like every other hackathon security dashboard.

**The fix is not a better model. It is a better claim** — and a continual-learning loop that turns
the cross-day collapse from a weakness into the demo's centrepiece.

---

## 2. ML REALITY CHECK

### Is it learning signal? Partly. Is the benchmark hard? No.

Measured on the shipped random split, 749,410 held-out flows:

| Model | Precision | Recall | F1 | FPR |
|---|---|---|---|---|
| Majority-class dummy | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| Decision stump (depth 1) | 0.9886 | 0.5672 | 0.7209 | 0.0013 |
| Decision tree (depth 3) | 0.7723 | 0.9458 | 0.8503 | 0.0573 |
| Decision tree (depth 6) | 0.9648 | 0.9784 | **0.9715** | 0.0073 |
| **Shipped RandomForest** | 0.9931 | 0.9983 | **0.9957** | 0.0014 |

**A single decision rule gets 57% recall at 99% precision. Six levels of tree get F1 0.97.** The
forest earns about 2.4 F1 points over a model you could draw on a napkin. CIC-IDS2017 is a
well-known easy benchmark and a knowledgeable judge may say so out loud. Reporting 99.57% without
this baseline column is the kind of number that invites the question you do not want.

### The split is the real problem

The shipped split is a per-family round-robin — 30% of every family held out, randomly
interleaved. Exact duplicate flows were removed globally (329,206 of them), which was necessary,
but **near-duplicates within the same attack burst were not**, and cannot be: the
`MachineLearningCVE` CSVs carry no timestamp or flow ID. A DoS Hulk burst produces thousands of
near-identical vectors; splitting them randomly puts siblings on both sides.

The honest test is a cross-capture split. Train on Monday/Tuesday/Wednesday (1,485,663 flows),
test on Thursday/Friday (1,012,317 flows):

| Split | Precision | Recall | F1 | FNR |
|---|---|---|---|---|
| Random per-family (shipped) | 0.9931 | 0.9983 | 0.9957 | 0.0017 |
| **Cross-day (unseen captures)** | 0.9893 | **0.3668** | **0.5352** | **0.6332** |

Per-family recall on unseen days:

| Family | Test flows | Recall |
|---|---|---|
| DDoS | 128,014 | 63.6% |
| PortScan | 90,694 | **0.3%** |
| Bot | 1,948 | **0.0%** |
| Web Attack – Brute Force | 1,470 | 2.1% |
| Web Attack – XSS | 652 | 3.5% |
| Web Attack – SQL Injection | 21 | 14.3% |
| Infiltration | 36 | **0.0%** |

Precision holds (98.9%) and FPR stays low (0.11%) — the model is not wildly guessing, it simply
does not recognise anything it was not shown. DDoS partially transfers because DoS Hulk in the
training days resembles it. Nothing else does.

**This is not a bug in the code. It is a bug in the claim.** The pipeline is reproducible and the
numbers are real; they answer a question the problem statement did not ask.

### One earlier caveat was overstated — correcting it

I previously flagged `Destination Port` as a feature that "can flatter a classifier on this
dataset." Retraining without it: F1 0.9943 vs 0.9957. **It contributes almost nothing.** The
README's caveat should be corrected rather than left in as false modesty. Top features are packet
length statistics (`Packet Length Std` 0.076, `Bwd Packet Length Std` 0.065), which is
behaviourally sensible.

### Metric honesty audit

| Metric | Status |
|---|---|
| Precision / recall / F1 / FPR / FNR / AUC | **Real**, reproducible via `ml/train_detector.py`, full test split at true class balance. Correctly scoped, wrongly framed. |
| Detection latency 22 ms p50 / 41 ms p95 | **Real**, timed per request. Correctly labelled as pipeline processing time, not MTTD. |
| Automation coverage 71.4% | **Real** but **fragile** — it is measured against an LLM-drafted playbook, so the denominator changes run to run. Currently often the hardcoded fallback playbook, because a local run has no Groq key. Needs a fixed reference playbook to be a stable number. |
| ATT&CK attribution 54.1% top-1 | **Real** but **underpowered**: n=74 gives a 95% CI of **[42.7%, 65.4%]**. Quoting "54.1%" to one decimal implies precision the sample size does not support. |
| Fusion: 7 attacks recovered / 2 benign promoted | **Real mechanism, soft number.** Host captures are assigned to assets and time windows by a spreading policy I invented. Change the policy, change the number. The counterfactual is sound; the magnitude is an artifact. |
| MTTD 4.2 min / MTTR 12.8 min | **Deleted.** No hardcoded metric remains — verified: `mttd_minutes` no longer appears in any response. |
| Dwell-time baseline (10 days) | **Cited**, attributed to Mandiant M-Trends 2024, visually separated. Correct handling. |

---

## 3. BACKEND

**Architecture is sound.** Clean separation: `engine/` owns detection, replay, fusion, ledger,
actions; `agents/` orchestrates; `main.py` is thin. The metrics registry as single source of truth
is the right pattern and is what makes "no hardcoded numbers" enforceable rather than aspirational.

**Claim-versus-code, per agent:**

| Agent | Claim | Reality |
|---|---|---|
| Anomaly Detector | Behavioural detection | **True now.** Model inference over numeric features; never sees a label. |
| Correlation Engine | Cross-plane weak-signal fusion | **True mechanism**, synthetic co-occurrence. Honestly labelled in the response payload. |
| ATT&CK Mapper | Technique attribution + kill chain | **Mixed.** Host-plane attribution is a real classifier. Network-plane `mitre_id` is a *hardcoded family→technique lookup* in `replay.py`. It is labelled as curated, but the Kill Chain tab is therefore driven by a dictionary, not a model. |
| Threat Intel | Live intelligence | True; degrades to LLM-only without a Tavily key. |
| Response Orchestrator | Automated containment | Honest — actions are simulated and every response says so. Gate and ledger are real. |
| Copilot | SOC analyst assistant | **Weakest link.** See below. |

### Security of the service itself

| Issue | Severity | Evidence |
|---|---|---|
| **Prompt injection via ingested content** | **High** | `copilot.py` interpolates alert descriptions directly into the system prompt with no delimiting, no sanitisation, no instruction-hierarchy defence. Verified: no injection defence present. Detection descriptions today are template-generated, but the moment real log text flows in, an attacker who controls a hostname or command line controls part of the prompt. This is the classic path and it is wide open. |
| **Unhandled 500 on malformed input** | Medium | `POST /api/copilot` with `context=[{"foo":"bar"}]` → **500**. Unguarded `msg['role']` / `msg['content']`. Trivially triggerable. |
| **No input length limits** | Medium | A 200,000-character `message` is accepted and forwarded to Groq (**200 OK**). A 100,000-character threat-intel query likewise. Free-tier quota exhaustion is a one-request attack. |
| **Negative pagination bug** | Low | `GET /api/events?limit=-5` returns **595** of 600 events — Python negative slicing. `limit=999999999` silently returns everything. No `Query(ge=1, le=...)` bounds. |
| CORS | **Fixed** | Explicit origin list, credentials off, methods narrowed. Verified: unknown origin receives no `Access-Control-Allow-Origin` header. |
| Secrets | **Clean** | No `.env` ever committed — verified across all history. `.gitignore` correct. |
| Authentication | Absent | Every endpoint is public, including `POST /api/respond`, which executes actions and writes to the audit ledger. Acceptable for a demo; must be named as a gap, not omitted. |

**Zero tests. No CI.** For a project whose entire pitch is "our numbers are trustworthy", there is
no automated check that the numbers stay reproducible. That is a credibility hole as much as an
engineering one.

**Scalability.** `_stream`, `_detections`, `_incidents` and `_last_coverage` are module globals.
`POST /api/refresh` mutates shared state for every connected user — two judges clicking at once
see each other's data. The audit ledger is a local JSONL file on an ephemeral dyne. Measured
footprint: **234 MB RSS** with both models loaded, against Render's 512 MB. Fits, with no room for
a second worker.

---

## 4. FRONTEND — design critique

It reads as auto-generated because, structurally, it is. Specific evidence:

**The markdown bug — worst first.** Three components render LLM output as raw text with
`whitespace-pre-wrap`: `Dashboard.jsx:145`, `AttackChain.jsx:88`, `CopilotChat.jsx:58`. No
markdown renderer in `package.json`. The model emits `**Threat Assessment**:` and the UI displays
literal asterisks. This is on the Dashboard — the first screen a judge sees.

**Colour has no system.** 14 distinct accent shades across `emerald / red / orange / yellow /
blue / amber`, with 40 separate `emerald-*` usages. Emerald is simultaneously "info severity",
"system healthy", "measured provenance", "chain intact", "detected correctly", and every primary
button. When one colour means six things it means nothing.

**Monospace as decoration.** `CopilotChat.jsx:52` sets the entire conversation in monospace.
Monospace should mark machine-emitted values — hashes, IPs, technique IDs — not prose. The current
usage says "hacker aesthetic", not "engineering precision".

**Templated copy, verbatim:** `SYSTEM ACTIVE` · `ONLINE` with a pulsing dot · `Analyzing...` ·
`CyberSentinel Copilot online. Ask me about active threats, MITRE mappings, or containment
recommendations.` · `Click Analyze for AI-generated compound risk assessment.` · `No active
anomalies detected.` This is the house style of every generated dashboard. A real product does not
tell you it is online; it shows you data and you infer it.

**Structural problems beyond styling:**
- **Eight top-level tabs**, all peers. Evidence and Audit — the two tabs carrying the graded
  criteria — sit fifth and seventh, behind Threat Map.
- **Copilot as a tab** is wrong. An assistant you have to navigate away from your data to consult
  is useless during an investigation. It belongs as a persistent surface.
- **No empty-state design.** The Audit tab before any playbook runs shows a bare sentence.
- **No loading skeletons** — panels pop in.
- The India SVG map is decorative. Eight dots on a static outline is not situational awareness.
- Bundle is **599 KB** (168 KB gzipped) in one chunk, mostly Recharts.

**What is genuinely good and must survive a redesign:** the provenance tag vocabulary
(measured/cited/illustrative), showing ground truth beside predictions including misses, the
per-family weakness table, and the tamper-detection interaction. Those are product decisions no
template would produce.

---

## 5. REAL-WORLD DEPLOYABILITY — top 5 gaps

1. **The input schema does not exist in the field.** The model wants 69 CICFlowMeter features —
   `Bwd Packet Length Std`, `Flow IAT Mean`, `Active Std`. Real infrastructure emits NetFlow/IPFIX,
   Zeek `conn.log`, or vendor EDR events. Nobody is running CICFlowMeter on a production tap.
   Without an ingestion adapter this model cannot score a single real packet. **This is the largest
   gap in the project** and it is invisible in the demo.
2. **No generalisation to novel attacks** — §2. A detector that recognises what it has seen is a
   signature engine with extra steps, which is the exact failure mode the problem statement opens
   by describing.
3. **No persistence, no state, no multi-tenancy.** In-memory globals, ephemeral ledger file. A
   restart erases the audit chain — for a compliance artifact, that is disqualifying in production.
4. **No feedback path.** An analyst dismissing a false positive changes nothing. The model is a
   frozen pickle. Over weeks in a real environment its FPR drifts and there is no mechanism to
   correct it.
5. **No authentication, authorisation, or rate limiting** on endpoints that execute containment
   actions and write to an audit ledger.

Honourable mentions: single-process serving, no model versioning at inference (the artifact has no
embedded version to log against a decision), no alert deduplication, no way to tune the 0.5
threshold per asset criticality.

---

## 6. KEEP / REWRITE / DELETE — ranked by judging impact

### Do these or do not bother (highest impact per hour)

| # | Action | Criterion | Why |
|---|---|---|---|
| 1 | **Report the cross-day number yourself, then beat it with a learning loop** | Innovation 25% · ML rigor | Turns the fatal question into the demo. "Static model: 36.7% recall on unseen captures. After 200 analyst labels: X%." A measured before/after is worth more than any architecture slide. |
| 2 | **Fix the markdown rendering** | UX 15% | One dependency. Literal `**bold**` on the first screen undoes every credibility signal elsewhere. |
| 3 | **Copilot guardrails + make it act** | Technical Excellence 20% | Injection defence, scope refusal with logged refusals, and real tool-calls (query detections, explain a technique, draft a playbook). Currently the weakest agent and the easiest to break live. |
| 4 | **Add the baseline column to every metric** | ML rigor | Depth-6 tree at F1 0.9715 next to the forest, majority-class baseline next to attribution. Pre-empts the question instead of absorbing it. |
| 5 | **Design system pass** | UX 15% | One accent, semantic severity ramp, monospace only for machine values, real hierarchy, rewritten copy. |
| 6 | **Copilot → persistent floating panel** | UX 15% | Available from every screen; frees a tab slot and matches how analysts actually work. |
| 7 | **Input validation + length caps + bounded pagination** | Technical Excellence | Three small fixes; removes a live 500 and a quota-exhaustion vector. |
| 8 | **A real ingestion adapter (even one)** | Scalability 15% · Business Impact | Zeek `conn.log` → the feature vector, with the unmappable features named honestly. Converts "cannot deploy" into "here is the path". |
| 9 | **A handful of tests + CI** | Technical Excellence | Metrics reproducibility, ledger chain integrity, API contract. Cheap, and it backs the whole honesty pitch. |

### Keep unchanged
Metrics registry and provenance vocabulary · audit ledger and tamper demo · the ATT&CK revocation
map · dataset pipeline and cleaning disclosure · per-family weakness reporting · graceful LLM
degradation · CORS lock.

### Rewrite
`replay.py` family→technique dictionary (present it as what it is, or attribute network detections
properly) · `CopilotChat.jsx` (guardrails, markdown, placement) · `MetricsBar`/`Dashboard` visual
language · fusion host-plane placement (make the policy explicit and show sensitivity) · automation
coverage (fix the reference playbook so the denominator is stable).

### Delete
The India SVG map unless it earns its space with real per-asset state · `vite.config.js` dev proxy
(dead — `api.js` uses an absolute base URL) · `pulse-ring` CSS and the `SYSTEM ACTIVE` header
indicator · `shadow-glow-red`.

---

## Bottom line

The honesty infrastructure here is genuinely unusual and worth defending. The ML claim is not —
not because the numbers are fake, but because they answer the wrong question, and I can produce
the experiment that shows it in ninety seconds. Fix the framing, add a learning loop that
demonstrably beats the static baseline on unseen captures, make the interface look like something
a SOC would trust, and this is a winning submission.

Ship it as-is and it loses to a worse system with a better story.

**Stopping here for approval before Phase 2.**
