# CyberSentinel — presentation deck

Final slide-by-slide content. Every number here is produced by a script in `backend/ml/` or
`backend/engine/` and is visible in the running UI. Build the actual slides from this; do not add
a figure that is not here.

---

## Slide 1 — Title

**CyberSentinel**
Behavioural threat detection for critical national infrastructure that improves as your analysts
use it.
ET AI Hackathon 2026 · Problem Statement #7

---

## Slide 2 — The problem (keep the framing, it is sound)

- CERT-In handled **1.59M** incidents in 2023, climbing since.
- AIIMS Delhi: down **2+ weeks** to ransomware. CBSE 2024 & 2026: student data breached.
- **70%** of government entities run end-of-life IT.
- The real problem is **detection speed** — APTs run low-and-slow to evade signatures. By the
  time a signature exists, the attack has already succeeded somewhere.

**Our thesis:** you cannot pre-train a detector for an attack nobody has labelled yet. So build
one that (a) also scores deviation from *normal*, and (b) gets better every time an analyst
corrects it.

---

## Slide 3 — What we built

A six-stage pipeline over three telemetry planes, with two things almost no other entry will have:
a **detector that learns from analyst clicks**, and a **tamper-evident audit chain**.

- **Two-headed detector** — a supervised model for known attacks + a behavioural baseline
  (novelty) head that never sees an attack in training.
- **Cross-plane correlation** — network (IT) + Windows host (IT) + a simulated OT/ICS plane.
- **Attack graph, ATT&CK mapping, SOAR playbooks, CVE remediation queue, a guarded copilot.**

---

## Slide 4 — Architecture & stack

- **Ingestion:** CIC-IDS2017 network flows · OTRF Windows host telemetry · simulated Modbus/ICS ·
  a Zeek conn.log adapter (31.9% feature coverage, honestly measured).
- **Detection:** RandomForest (supervised) + IsolationForest over rank-normalised benign traffic
  (novelty), union at a calibrated 1% false-positive budget.
- **Stack:** FastAPI · scikit-learn · React + Vite + Tailwind · Groq `llama-3.3-70b-versatile`
  (free tier) · Netlify + Render.
- **Data:** 697-technique MITRE ATT&CK STIX · real NVD CVEs · audit chain in SQLite.

*(Full diagrams: ARCHITECTURE.md)*

---

## Slide 5 — Key capabilities

- **Learns from your analysts** — 500 verdicts take per-flow recall **79.6% → 99.0%**, measured
  on held-out data.
- **Behavioural baseline** — the novelty head lifts PortScan from **4.3% → 52.3%** on a family the
  classifier never saw.
- **Cross-domain correlation** — incidents that span **IT and OT** on one asset; 9 incidents no
  single sensor would raise.
- **Attack graph** — sources → assets → techniques, with convergence pivots.
- **Vulnerability prioritisation** — real CVEs ranked by CVSS × exposure × live attack activity.
- **Tamper-evident auditability** — edit one ledger row, verification names the entry that broke.

---

## Slide 6 — Results (measured, on capture days the model never trained on)

| | Value |
|---|---|
| **Attack campaigns detected** | **7 of 7 (100%)** |
| Per-flow recall | **79.7%** (supervised alone: 60.1%) |
| Precision | 82.7% |
| Median flows to first detection | 1 |
| Recall after 500 analyst verdicts | **99.0%** |
| ATT&CK attribution (top-1) | 54.1% (±11pp) vs 24.3% baseline |
| Response automation coverage | 71.4% |

Two operating points are published: high-recall (shipped, 212 alerts/1k) and high-precision
(60.1% recall, 153 alerts/1k). A SOC picks per its alert budget.

---

## Slide 7 — Where it still fails *(the slide that wins trust)*

- **Bot: 0.7%.** Even with both heads, one family stays nearly invisible.
- **Feedback does not transfer across campaigns** — measured at exactly **0.0pp**. New families
  need their own labels.
- **Attribution is "about half"** (±11pp at n=74), not a precise number.
- **212 alerts/1,000 flows** at the high-recall point is a heavy load; the loop and the
  precision point are the mitigations.
- **OT is simulated; the asset↔CVE mapping is illustrative** — both labelled everywhere.

Volunteering the limits is the strongest signal that the rest of the numbers are real.

---

## Slide 8 — What is real vs simulated

| Real | Simulated / illustrative |
|---|---|
| Both detector heads, all metrics, the learning loop | Indian asset personas on the map |
| CIC-IDS2017 flows, OTRF host telemetry | OT/ICS Modbus signal |
| MITRE ATT&CK table, NVD CVEs + CVSS | Asset-to-software mapping |
| SHA-256 audit chain, tamper detection | Containment actions (gate + record are real) |

---

## Slide 9 — Judging alignment

- **Innovation (25%):** analyst-feedback loop with a measured before/after; attack graph;
  tamper-evident ledger.
- **Business Impact (25%):** 100% campaign detection; CVE remediation queue for the government
  patch-prioritisation reality; IT+OT correlation.
- **Technical Excellence (20%):** held-out splits, calibrated thresholds, published trivial
  baselines, 52 tests that assert the *claims*.
- **Scalability (15%):** durable SQLite ledger, token-gated write endpoints, a documented path to
  N stateless workers.
- **UX (15%):** layered light interface, dark chrome, real map and graph, guided assistant.

---

## Slide 10 — Close

> Most security demos label their own test data. We trained on a public benchmark, evaluated on
> a million flows we never touched, and we will show you the family our model is still bad at —
> then fix it live with 500 clicks.

Live demo: cybersentinell.netlify.app
