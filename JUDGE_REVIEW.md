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
