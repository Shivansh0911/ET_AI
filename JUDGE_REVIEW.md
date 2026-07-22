# CyberSentinel — judge's review and path to winning

Reviewing as a senior AI/security practitioner deciding whether this wins ET AI Hackathon 2026,
Problem Statement #7. I built most of it, so this is deliberately hard on my own work. Every
number was pulled from the live metrics, not memory.

---

## Verdict

**This is a strong, unusually honest submission that will place well — but as it stands it does
not clearly WIN, because it is deep on two of the five judging axes and thin on three.** The gap
to a winning entry is not more rigour on what exists; it is closing three specific holes that
judges scanning against the problem statement will notice within a minute.

| Judging criterion | Weight | Score | One-line justification |
|---|---|---|---|
| Innovation | 25% | **8/10** | The analyst-feedback loop with a measured before/after, and the tamper-evident ledger, are genuinely uncommon. Held back by no graph/lateral-movement and no digital twin. |
| Business Impact | 25% | **5/10** | 7/7 campaign detection reads as a real product, but the bullet most about *government* reality — CVE/patch prioritisation — is absent, and there is no OT despite the statement saying "IT **and** OT". |
| Technical Excellence | 20% | **8/10** | Held-out splits, calibrated thresholds, published trivial baselines, 26 tests that assert the *claims*. Leaking only on breadth: "RAG" is web-search-and-summarise, the "knowledge graph" is a table. |
| Scalability | 15% | **3/10** | Single process, in-memory stream state, ephemeral file ledger, no auth. This is the weakest axis and the cheapest to improve. |
| User Experience | 15% | **8/10** | After the redesign: layered surfaces, dark chrome on light content, a real map, an assistant that renders markdown and is guided. Genuinely strong. |

**Weighted, that is roughly a 6.4/10 — a good submission, not yet a winning one.** The three
low-scoring areas (Business Impact, Scalability, and the missing Innovation breadth) are worth
55% of the score between them, and every one has a cheap partial fix below.

### Would it win as-is?

Against a field of LLM-wrapper demos with invented metrics, it is top-quartile on the strength of
the honesty story alone. Against a genuinely strong team that *also* shows a CVE queue, a lateral-
movement graph, and a polished demo video, it loses on breadth — because a judge allocating 25% to
Business Impact will mark down "no vulnerability prioritisation" hard, and 15% to Scalability will
mark down "resets when the process restarts" hard.

---

## The current numbers (all measured, cross-capture, at a 1% FPR budget calibrated on training data)

| | Value |
|---|---|
| Attack campaigns detected | **7 of 7 (100%)** |
| Per-flow recall | 79.7% (supervised head alone: 60.1%) |
| Precision | 82.7% |
| False positive rate | 4.7% |
| **Alert volume** | **212 per 1,000 flows** |
| After 500 analyst verdicts | 79.6% → 99.0% recall |
| ATT&CK attribution | 54.1% top-1 (±11pp) |

**The number a security judge will challenge: 212 alerts per 1,000 flows.** That is a very high
alert rate — in a real SOC it is alert fatigue, and it partly comes from the novelty head's 4.7%
FPR against a benign-heavy stream. Have an answer ready (the union is deliberately high-recall;
the analyst loop then suppresses false positives), or tune the operating point toward precision
and show both.

---

## What to ADD, ranked by points-per-hour

1. **Demo video + corrected deck.** *Both are required deliverables. The video does not exist and
   the deck is stale (corrections live only in DECK_NOTES.md).* This is pure, uncontested points
   for a few hours of work, and a hackathon is often won or lost on the two-minute video. **Do
   this first.** — Deliverables, Business Impact
2. **Graph-based lateral-movement view.** We already carry `source_ip`/`dest_ip` on every flow and
   never build a graph. A NetworkX graph of host→host movement, rendered as a small force-directed
   panel, is a named suggested technology (Graph AI), high visual payoff, and directly supports the
   "correlate weak signals" story. Half a day. — Innovation
3. **CVE / vulnerability-prioritisation MVP.** The one missing build area that is *specifically*
   about the government context the statement centres on. A scoped version — map the 8 illustrative
   assets to a handful of real CVEs from a bundled NVD slice, rank by CVSS × exposure — is
   defensible if labelled as an MVP over a static feed. Highest Business-Impact return. — Business
   Impact 25%
4. **Persist the ledger + a token auth gate + a written scale story.** Scalability is 3/10 and worth
   15%. Moving the audit ledger to SQLite (survives restart), putting one bearer token on the
   action-executing endpoints, and writing a one-page horizontal-scaling note turns the weakest axis
   from "disqualifying" to "adequate" in an afternoon. — Scalability
5. **Honour "IT and OT".** The challenge statement says heterogeneous IT **and OT**; we have only IT.
   Even a small synthetic Modbus/ICS signal folded into the correlation engine, honestly labelled,
   answers a phrase judges will grep the statement for. — Business Impact, Innovation

## What to REMOVE or TRIM

- **The `next_move_prediction` LLM projection** adds little and is the softest thing on screen; if
  time is short, demote it rather than defend it.
- **Trim the deck's remaining ambition** to exactly what runs. Every unbuilt capability named on a
  slide is a question you cannot answer well on stage.
- **Do not add** CERT-In RAG or the digital twin unless there is real time — both need corpora/
  simulation we cannot build convincingly under deadline, and a thin version reintroduces exactly
  the demo-ware this project spent three passes removing.

## What to KEEP and lead with

The honesty infrastructure is the moat: measured-vs-cited provenance, published trivial baselines,
the two-headed detector that matches the statement's first bullet, the analyst loop's before/after,
and the tamper-evident ledger. **Open the pitch with the failure you fixed** ("our detector missed
40% of flows on traffic it had never seen — here is how analyst feedback and a behavioural baseline
close it, and here is the family it still cannot see"). No other team can give that demo, because it
requires having measured the failure first.

---

## The blunt bottom line

Rigour is already at a winning level; **breadth is not.** Spend the remaining time on the demo
video, one graph, one CVE panel, and a minimal scalability story — in that order — and this moves
from "impressive and honest" to "impressive, honest, and complete against the brief." Skip them and
it remains a very good submission that a broader entry can edge out on Business Impact and
Scalability, which together are 40% of the score.

---

## Re-score after the winning-path build

The graph, the CVE queue, the scalability hardening and the OT plane are now built and tested.
Re-grading honestly:

| Criterion | Weight | Was | Now | What changed |
|---|---|---|---|---|
| Innovation | 25% | 8/10 | **9/10** | Attack graph (source→asset→technique, pivots) closes the graph-AI gap on top of the feedback loop and ledger. |
| Business Impact | 25% | 5/10 | **7/10** | CVE remediation queue (the government bullet) + IT/OT correlation. Still no named-actor attribution or digital twin. |
| Technical Excellence | 20% | 8/10 | **8/10** | Held. 52 tests now, all four new capabilities asserted; RAG still shallow, "knowledge graph" still a table. |
| Scalability | 15% | 3/10 | **6/10** | Durable SQLite ledger, token-gated writes, a documented worker path. Stream state still process-global (a demo fixture, and named as one). |
| UX | 15% | 8/10 | **8/10** | Two strong new screens; also more tabs to keep legible. |

**Weighted: ~6.4 → ~7.9/10.** That crosses from "will place well" into "can win", provided the
two remaining deliverables land: the **demo video** (script ready in DEMO_SCRIPT.md, the user's to
record) and the **rebuilt deck** (content ready in DECK.md).

### What still separates this from a 9+ overall

- **Named-actor / campaign attribution** (we map to techniques, not APT groups).
- **A real knowledge graph** rather than an ATT&CK table, and RAG over an actual advisory corpus.
- **The digital twin** — untouched, and correctly so under deadline.
- **The alert load** — 212/1k at the high-recall point is still heavy; the precision point and the
  loop are the answers, but a judge will still press on it.

None of those are cheap, and attempting them now would risk the rigour that is the moat. The
highest-value remaining action is not more code — it is the video and the deck.

---

## Re-score after the "definitely win" build

Five more capabilities landed: named-actor attribution over a real ATT&CK knowledge graph, a
cyber-resilience digital twin, alert aggregation, a measured-vs-cited detection-speed panel, and
a consolidated four-section navigation with a guided tour. 61 tests, all green; every new
capability live-verified.

| Criterion | Weight | Prev | Now | What moved it |
|---|---|---|---|---|
| Innovation | 25% | 9 | **9** | Digital twin (attack-path simulation, chokepoint) + graph-based actor attribution. Genuinely broad now; the subjective ceiling holds it at 9. |
| Business Impact | 25% | 7 | **9** | Actor attribution → "who, what next, how to stop it"; CVE queue; IT/OT; the twin turns hardening into a measured investment decision; MTTD vs a cited baseline. |
| Technical Excellence | 20% | 8 | **9** | The ATT&CK "table" is now a traversed knowledge graph; alert aggregation; 61 tests that assert the claims. RAG is still shallow — short of 10. |
| Scalability | 15% | 6 | **6** | Unchanged this round. Durable ledger + auth + worker path already banked; a real live deploy is the next lever, still pending. |
| UX | 15% | 8 | **8** | Grouped nav + guided tour + the interactive twin help; ten screens is still dense, so a full design-polish pass separates 8 from 9. |

**Weighted: ~7.9 → ~8.4/10.**

**Which hit 9:** Innovation, Business Impact, Technical Excellence — the three the build targeted.
**Which did not:** Scalability (6, untouched this round) and UX (8, dense). Both are named, not hidden.

### The remaining lever

The single highest-value action left is **item 5 — deploy live and record the demo.** A working
public URL lifts Scalability and Business-Impact credibility at once, and the video is what a
hackathon is actually judged on. That is now the bottleneck, not more features. Attempting the
last 9→10 items (named-campaign attribution, RAG over a real advisory corpus, a design-polish
pass) would trade the rigour that is the moat for marginal points — not worth it under deadline.
