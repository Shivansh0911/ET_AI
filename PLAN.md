# CyberSentinel — Rebuild Plan v2

Supersedes the v1 plan (checkpoints CP1–CP8, all shipped). Written against the findings in
[REVIEW.md](REVIEW.md). Branch `feature`, local commits only, no history rewrites, no pushes.

---

## The strategic move

REVIEW.md established that our headline 99.8% recall collapses to **36.7% on unseen captures**.
Every instinct says hide that. Do the opposite.

**The submission leads with the collapse and then beats it.** "Static detector: 36.7% recall on
attack types it never saw. Give it 500 analyst labels: X%. Here is the script." No other team will
show a failure mode and then close it on stage, and it converts our biggest liability into the
answer to *Innovation (25%)* and *Technical Excellence (20%)* simultaneously.

That reframing also fixes the deepest problem with the project: the problem statement is about
**APTs that evade signature-based detection**, and a frozen classifier is a signature engine with
extra steps. A detector that improves from analyst feedback is a genuine answer to the brief.

---

## Continual learning: the design, and why not RL

### What the field actually does

Industry HITL systems retrain classifiers on analyst workflow signals — tags, dismissals,
escalations. [Secureworks](https://www.fortinet.com/blog/business-and-technology/how-feedback-loops-and-machine-learning-power-high-precision-intrusion-detection)
and Fortinet's Lacework both describe feedback loops of this shape, not policy learning.
RL for drift-aware IDS exists in the literature
([Springer 2025](https://link.springer.com/chapter/10.1007/978-3-031-94445-1_17),
[arXiv 2506.18462](https://arxiv.org/html/2506.18462) on learning-to-defer) but assumes an
environment you can interact with thousands of times and a reward signal you can define.

### Decision: incremental learning, not RL

| | Incremental (chosen) | RL |
|---|---|---|
| Labels needed | Hundreds | Tens of thousands of interactions |
| Reward signal | Not needed — the analyst verdict *is* the label | Must be invented; a wrong reward silently teaches the wrong thing |
| Provable in a demo | Yes — before/after on a held-out set | No; variance would swamp any effect at our scale |
| Honest at our data volume | Yes | No |

Choosing RL here would be a slide, not a system. We would be unable to demonstrate that it beats a
static baseline, which is the only thing that matters. **Stated plainly in the deck: we evaluated
RL and rejected it as unprovable at this data scale.** That is a stronger answer than using it.

### The mechanism

```
Base model      RandomForest trained on Mon+Tue+Wed only              (frozen, versioned)
                        │
Deployment      Thu+Fri stream, chronological, split once:
                  first 40% -> analyst feedback period
                  last  60% -> evaluation set, NEVER trained on
                        │
Adaptive layer  SGDClassifier(log_loss).partial_fit over analyst labels only
                        │
Served score    combine(base_probability, adaptive_probability)
```

**Label acquisition is the honest part.** An analyst only sees what the system surfaces — and
PortScan scores ~0.0, so it is never surfaced. That cold-start trap is real, so labels come from
**uncertainty sampling plus a random audit quota** (standard active learning): most of the budget
goes to flows nearest the decision boundary, a fixed slice to random unreviewed flows, which is how
a missed family gets discovered at all. Budget spent in batches so we produce a learning curve, not
a single point.

**Guards against fooling ourselves:**
- the evaluation set is never labelled, never trained on, and fixed before the first batch
- FPR is reported at every point — an adaptive layer that buys recall by alerting on everything is a regression, and the curve will show it
- the base model never sees Thursday or Friday
- if the loop does not beat the baseline, **the plan is to report that it did not**

### What is measured

`metrics/continual.json`: recall / precision / F1 / FPR on the evaluation set at 0, 50, 100, …, 500
labels, plus per-family recall before and after, and the label budget spent.

---

## Benchmark story (the five graded criteria)

| Criterion | What we report |
|---|---|
| Detection rate + FPR | Two numbers, both stated: random split (99.8% recall) **and** cross-day (36.7%), with a depth-6 tree baseline column so nobody has to ask how easy the benchmark is |
| ATT&CK attribution | 54.1% top-1, quoted **with its 95% CI [42.7%, 65.4%]** and the 24.3% baseline |
| IR automation coverage | Fixed reference playbook so the denominator stops moving; currently 71.4% |
| Detection latency | Measured pipeline time, p50/p95, never compared to dwell time |
| Auditability | Hash chain, verification endpoint, tamper demo — plus every model update and copilot refusal now written to it |

---

## Deployability: what the MVP proves

The largest real gap is that the model eats CICFlowMeter features that no production network emits.
Closing it properly is a project; **proving the path is not.** We ship one ingestion adapter — Zeek
`conn.log` → feature vector — that names exactly which features map, which are approximated, and
which are unavailable. That converts "cannot deploy" into "here is the adapter and here is what it
costs", which is a far better answer under questioning than silence.

The audit ledger stays file-backed with its ephemerality stated. Model artifacts get versioned and
the version is recorded in every ledger entry, so a decision can always be traced to the weights
that made it.

---

## Execution order

| # | Work | Criterion served |
|---|---|---|
| **P1** | Cross-day baseline + continual learning loop + measured before/after | Innovation, ML rigor |
| **P2** | Runtime feedback API, adaptive model persistence, ledger-logged updates | Technical Excellence, Auditability |
| **P3** | Copilot guardrails, injection defence, real tool-calls, logged refusals | Technical Excellence |
| **P4** | Input validation, bounded pagination, length caps, tests + CI | Technical Excellence |
| **P5** | Frontend redesign: design system, markdown renderer, floating copilot, confirm/dismiss UI | UX 15% |
| **P6** | Zeek adapter + docs/deck rewritten to match | Scalability, Business Impact |

Every checkpoint is one commit. If the loop fails to beat the baseline, P1 still ships — with the
negative result written down.
