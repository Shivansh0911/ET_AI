# PS#7 gap audit

Re-read from the source PDF, not from our own documentation. Every line of the statement
checked against the code as it stands.

---

## 1. "What you may build" — five areas

| Area | State | Evidence |
|---|---|---|
| **Behavioural Anomaly Detection Engine** | **CLOSED** | `ml/train_hybrid.py` now fits a novelty head on **benign traffic only** alongside the supervised classifier. It never sees an attack during fitting, so what it catches owes nothing to prior knowledge. PortScan went 4.3% → 52.3% and overall per-flow recall 60.1% → 79.7%. |
| **APT Campaign Attribution & Prediction** | **CLOSED** | engine/actor.py ranks named APT groups by TTP overlap over the ATT&CK knowledge graph, predicts next techniques from their playbooks, and lists mitigations. Probabilistic, labelled candidates. CERT-In advisory corpus still absent. |
| **Autonomous Incident Response Orchestrator** | **HAVE** | `engine/actions.py` — typed catalog, blast-radius gate at 10 endpoints, 71.4% coverage measured, every action hash-chained. Actions are simulated and say so. |
| **Government Infrastructure Vulnerability Prioritisation** | **CLOSED (MVP)** | engine/vuln.py ranks real NVD CVEs by CVSS x exposure x live attack activity into a remediation queue. Asset-to-software mapping is illustrative; CVEs and formula are real. |
| **Cyber Resilience Digital Twin** | **CLOSED (scoped)** | engine/twin.py simulates attacker propagation, blast radius and the top chokepoint over real exposure/CVE data; topology and propagation labelled simulated. |

## 2. "Suggested technologies"

| Technology | State | Blunt assessment |
|---|---|---|
| Agentic AI / multi-agent | **HAVE** | Six coordinated stages, each with a real job. |
| **Unsupervised anomaly detection (UEBA)** | **CLOSED** | IsolationForest over rank-normalised benign traffic, served as the second head. |
| **Graph AI** (attack path, lateral movement) | **CLOSED** | engine/graph.py builds a source->asset->technique graph with pivots and longest-path. Inferred topology, labelled not-confirmed-lateral-movement. |
| RAG over threat intel / CVE / CERT-In | **PARTIAL, improved** | Tavily search-and-summarise, plus a real NVD CVE slice now drives the remediation queue. Still no CERT-In advisory corpus. |
| Knowledge graph (ATT&CK TTP mapping) | **CLOSED** | ml/trim_attack_graph.py + engine/actor.py traverse group→technique and technique→mitigation edges from real STIX. |
| SOAR integration & response automation | **HAVE** | See orchestrator above. |

## 3. Evaluation focus

| Criterion | State |
|---|---|
| Detection rate **and** FPR on benchmark datasets | **HAVE** — 79.7% per-flow recall / 100% campaign detection at 4.7% FPR, thresholds calibrated on training-day validation only. |
| ATT&CK attribution accuracy at technique level | **HAVE** — 54.1% top-1 (±11pp at n=74), vs 24.3% baseline. |
| IR automation coverage | **HAVE** — 71.4%, defined and reported. |
| **MTTD/MTTR vs a baseline SOC** | **IMPROVED** — now measures flows from campaign onset to first alert: median 1, worst 203, across 7 of 7 campaigns detected. Still measured in flows rather than seconds, because the CSVs carry no timestamp. |
| Full auditability | **HAVE** — hash-chained ledger, tamper detection, verification endpoint. |

## 4. Judging weights — where points are leaking

| Criterion | Weight | Assessment |
|---|---|---|
| Innovation | 25% | Strong: the analyst-feedback loop and the tamper-evident ledger are genuinely uncommon. Weakened by having no unsupervised layer and no graph. |
| Business Impact | 25% | **Improved.** 100% campaign detection and 79.7% per-flow recall read as a working product. Still no CVE/remediation angle. |
| Technical Excellence | 20% | Good rigour (held-out splits, published baselines, 37 tests). Leaking on breadth: three named technologies absent. |
| Scalability | 15% | **Improved.** Durable SQLite ledger, token-gated write endpoints, a documented path to N stateless workers (SCALABILITY.md). Stream state still process-global (a demo fixture). |
| User Experience | 15% | Strong after the redesign. |

## 5. Expected deliverables

| Deliverable | State |
|---|---|
| Working prototype | **HAVE** |
| **Architecture diagram** | **CLOSED** — [ARCHITECTURE.md](ARCHITECTURE.md), Mermaid so it stays in version control. |
| Presentation deck | Exists but stale; corrections in `DECK_NOTES.md`, not applied to the PDF. |
| Demo video | **NOT PRODUCED** — out of scope for me, but flagged. |

---

## What I am building, ranked by points per hour

1. **Unsupervised novelty head** — closes the largest capability gap, is the statement's own first bullet, and is the only honest route to a strong detection number. *(Phase B)*
2. **Campaign-level detection + time-to-first-detection** — turns the weakest evaluation criterion (MTTD) into a measured one, and gives a defensible headline figure. Cheap: the data already supports it. *(Phase B)*
3. **Architecture diagram** — a required deliverable currently at zero. Very cheap.
4. **Graph-based lateral movement** — a named technology we lack, built from `source_ip`/`dest_ip` we already carry.

## What I am deliberately not building, and why

- **CVE prioritisation** and **digital twin** are each a project in their own right, and both would be shallow if rushed. A convincing CVE agent needs a real asset inventory and a live NVD feed; a thin version would be exactly the kind of demo-ware this rebuild removed. Named here as a known gap rather than faked.
- **CERT-In advisory RAG** needs a scraped corpus we do not have and cannot responsibly fabricate.
- **Scalability hardening** (persistence, auth, multi-process) is real engineering with no visible demo payoff at 15% weight — lower return than the four items above.


---

## Update after the second pass

Closed: the behavioural baseline (the largest gap), unsupervised anomaly detection, the
architecture diagram, and a real MTTD analogue. Detection went from 36.7% per-flow recall at an
arbitrary 0.5 threshold to 79.7% at a calibrated 1% false-positive budget, with 7 of 7
campaigns detected.

Two thirds of that gain came from **calibrating the operating point** — the 0.5 threshold was
never justified — and one third from the new novelty head. Both are reported separately in
`metrics/baseline.json` so neither gets credit for the other's work.

Still open, and still named rather than faked: CVE prioritisation, the digital twin, CERT-In
advisory RAG, graph-based lateral movement, and scalability hardening.


---

## Update after the third pass (winning path)

Closed: graph AI (attack graph), CVE/vulnerability prioritisation, and a durable + auth-gated
scalability story. Added a simulated OT plane so incidents span IT and OT — honouring the "IT and
OT" wording. Produced the two missing deliverables in text form (DECK.md, DEMO_SCRIPT.md); the
video is the user's to record.

Still open, still named rather than faked: the full Cyber Resilience Digital Twin, CERT-In
advisory RAG, and named-actor campaign attribution. These need corpora or simulation we cannot
build convincingly under deadline.


---

## Update after the fourth pass (definitely-win)

Closed: named-actor APT attribution, a real (traversed) ATT&CK knowledge graph, the cyber
resilience digital twin, alert aggregation, and a measured-vs-cited detection-speed comparison.
Navigation consolidated into four capability sections with a guided tour. 61 tests.

Still open: CERT-In advisory RAG (corpus risk) and a full production deployment. Named, not faked.
