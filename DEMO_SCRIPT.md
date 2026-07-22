# CyberSentinel — demo script

A 2.5–3 minute run. The spine is: **lead with the failure, fix it live, show the limit.** No
other team can give this demo, because it requires having measured the failure first.

Record the backend running locally (`python main.py`) and the frontend (`npm run dev`), or the
live Netlify + Render deployment. Reset feedback first (Operations → Reset training) so the
recall jump is clean.

---

### 0:00 — Open on the failure (Operations tab)

> "This is a threat detector meeting network traffic from days it was never trained on. Look at
> the top-left tile — **it's catching about 60% of malicious flows.** Most demos hide a number
> like that. We lead with it, because it's the honest one."

Point at **Caught this window** and the frozen-detector card below it.

### 0:25 — Two heads (say it while it's on screen)

> "It's actually two detectors. One recognises attacks it's seen before. The second learns only
> what *normal* looks like and flags anything that deviates — so it can catch a family nobody
> labelled. That second head takes port-scan detection from 4% to 52%."

### 0:45 — Fix it live (the money shot — triage queue)

Click **Real** on 4–5 genuine detections, **False** on 2–3 benign ones.

> "Every click is a training label. At twelve verdicts the model refits — watch the recall tile."

The **Caught this window** number jumps (typically past 90%). Let it land silently for a beat.

> "Nothing reloaded. It learned from me."

### 1:15 — Show the limit (Evidence tab)

Scroll to the two learning curves.

> "Measured properly on held-out data: 500 verdicts take recall from 80% to 99% **within a
> campaign**. But across a *different* later campaign —" point at the flat curve "— feedback
> transfers **zero**. New attack families still need their own labels. We measured that and we
> publish it."

### 1:40 — Breadth, fast (three quick tabs)

- **Attack graph:** "Sources, assets and techniques as one graph — the pivot is where multiple
  sources converge on host activity."
- **Incidents:** point at an **IT + OT** badge. "This incident links a network probe to a Modbus
  write on the same substation — the cross-domain signal a purely-IT SOC can't see. OT is
  simulated and labelled."
- **Remediation:** "Real CVEs, ranked by severity times exposure times *live attack activity* —
  the patch-first queue for a team that can't patch everything."

### 2:10 — The trust close (Audit trail)

Click **Simulate tampering.** The integrity badge goes red and names the broken entry.

> "Every automated action is hash-chained. Change one record and verification tells you exactly
> which one. It's in SQLite, so it survives a restart."

### 2:30 — Land it

> "We trained on a public benchmark, evaluated on a million flows we never touched, showed you
> the family we're still bad at, and fixed the rest with 500 clicks. That's the difference
> between a demo and a system."

---

## If Groq is rate-limited

Everything except the copilot and the compound-analysis panel works with no LLM. Detection, the
learning loop, the graph, incidents, remediation and the audit chain need no API key. Skip the
copilot beat if it's slow; the recall jump and the tamper demo are the two that matter.

## Pre-record checklist

- [ ] `Reset training` on Operations so the recall delta starts from the frozen baseline
- [ ] Backend healthy: `/` shows `"detector": {"available": true}` with both heads
- [ ] Pick a window (Pull new window) that has a visible IT+OT incident and a few triage items
- [ ] Audit tab has entries (run a playbook once) so the tamper demo has a chain to break
