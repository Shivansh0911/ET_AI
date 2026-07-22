import { useEffect, useState } from 'react'
import { Activity, GitMerge, Share2, Route, FlaskConical, ShieldCheck, ClipboardList, ScrollText, Eye } from 'lucide-react'
import { api } from '../utils/api'
import { Card, DataRow, Mono, SectionTitle, Stat, StatStrip } from './ui'
import { Mark, Wordmark } from './Logo'

// One page that explains the product to someone who has never seen it. Numbers come from the
// live metrics endpoint rather than being typed in, so this page cannot drift out of date the
// way a hand-written README section does.

const TABS = [
  { icon: Activity, name: 'Operations', text: 'The live console. Flows being scored right now, the alerts that crossed the threshold, and the triage queue where you mark each one real or false.' },
  { icon: GitMerge, name: 'Incidents', text: 'Where separate sensors agree. Quiet network activity, host activity, and a simulated OT/ICS signal on the same asset become one incident neither plane would have raised alone — including cross-domain IT+OT.' },
  { icon: Share2, name: 'Attack graph', text: 'Threat sources, targeted assets and ATT&CK techniques as one graph, with the convergence pivots and the longest attack path called out.' },
  { icon: ShieldCheck, name: 'Remediation', text: 'Real CVEs ranked by severity, asset exposure and live attack activity — the patch-first queue for a team that cannot patch everything at once.' },
  { icon: Route, name: 'Progression', text: 'How far the attacker has got, drawn across all fourteen MITRE ATT&CK stages, with the model’s guess at the next move marked separately as a projection.' },
  { icon: FlaskConical, name: 'Evidence', text: 'Every number this product claims, with the script that produced it. Including the ones that are unflattering.' },
  { icon: ClipboardList, name: 'Response', text: 'Drafts a containment playbook, runs the steps that can be automated, and stops anything with too wide a blast radius for a human to approve.' },
  { icon: ScrollText, name: 'Audit trail', text: 'Every automated action, hash-chained. Alter one record and verification tells you exactly which one broke.' },
]

const STEPS = [
  ['Open Operations', 'Look at “Caught this window”. It will be low — the detector is meeting traffic from capture days it was never trained on.'],
  ['Work the triage queue', 'Mark a handful of alerts Real and a handful False. Click a row to see the flow behind it first.'],
  ['Watch the number move', 'At twelve verdicts the detector refits and the recall figure jumps. Nothing reloaded; it learned.'],
  ['Read Evidence', 'The same result, measured properly on held-out data — plus the case where feedback does not help at all.'],
  ['Break the audit chain', 'On Audit trail, run the tamper simulation. The badge goes red and names the entry that failed.'],
]

export default function About() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => { api.getMetrics().then(setMetrics).catch(() => {}) }, [])

  const detection = metrics?.detection
  const loop = metrics?.continual_learning
  const before = loop?.settings?.[0]?.before?.recall
  const after = loop?.settings?.[0]?.at_headline_budget?.recall
  const transfer = loop?.settings?.[1]

  return (
    <div className="mx-auto max-w-[860px] space-y-8 pb-8">
      <header className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border
            border-accent-line bg-accent-soft text-accent">
            <Mark size={26} />
          </span>
          <Wordmark className="text-heading" />
        </div>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
          A threat detector for critical infrastructure that gets better the more your analysts
          use it. It watches network and host activity, flags what looks wrong, and — this is
          the part that matters — treats every correction an analyst makes as a lesson.
        </p>
      </header>

      <section className="space-y-3">
        <SectionTitle hint="The gap this closes.">The problem</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card tint="warn" title="Detectors go stale the day they ship">
            <p className="text-body leading-relaxed text-ink-muted">
              A model trained on last year’s attacks recognises last year’s attacks. So we run a
              second detector alongside it, fitted only on what normal traffic looks like — it
              never sees an attack during training, which is how it flags families nobody has
              labelled yet. Together they catch{' '}
              <Mono className="text-ink">
                {detection ? `${(detection.recall * 100).toFixed(0)}%` : '—'}
              </Mono>{' '}
              of malicious flows on capture days neither was trained on, and{' '}
              <Mono className="text-ink">
                {detection?.campaign_level
                  ? `${detection.campaign_level.campaigns_detected} of ${detection.campaign_level.campaigns}`
                  : '—'}
              </Mono>{' '}
              attack campaigns outright.
            </p>
          </Card>
          <Card tint="neutral" title="Analysts already know the answer">
            <p className="text-body leading-relaxed text-ink-muted">
              Every day, a human looks at an alert and decides whether it was real. In most
              products that judgement is thrown away. Here it is a training label — the same
              click that closes a ticket also teaches the detector.
            </p>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle hint="Measured on data the model never trained on, not asserted.">
          What that is worth
        </SectionTitle>
        <Card>
          <StatStrip columns={3}>
            <Stat label="Before any feedback" value={before != null ? `${(before * 100).toFixed(1)}%` : '—'}
              note="malicious flows caught, frozen detector" />
            <Stat label={`After ${loop?.headline_label_budget ?? 500} verdicts`}
              value={after != null ? `${(after * 100).toFixed(1)}%` : '—'} tone="good"
              note="same held-out data, nothing retuned by hand" />
            <Stat label="False alarms" value={detection ? `${(detection.false_positive_rate * 100).toFixed(2)}%` : '—'}
              note="the cost side, reported too" />
          </StatStrip>
          {transfer && (
            <p className="mt-4 border-t border-line pt-3.5 text-body leading-relaxed text-ink-muted">
              <span className="font-medium text-ink">And where it stops working: </span>
              feedback from one campaign moves recall on a different, later campaign by{' '}
              <Mono className="text-ink">
                {(transfer.delta_at_headline.recall * 100).toFixed(1)} points
              </Mono>. New attack families still need their own verdicts. That limit is measured
              and published for the same reason the good number is.
            </p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle hint="Four steps, and you can watch it happen.">
          How the learning loop works
        </SectionTitle>
        <Card bare>
          <ol className="divide-y divide-line">
            {[
              ['An alert appears', 'The detector scores a flow and anything above the threshold reaches your queue.'],
              ['You judge it', 'Real or false. That is the whole interaction — no labelling tool, no separate workflow.'],
              ['The model refits', 'Every fourth verdict, it retrains on everything you have told it so far.'],
              ['Scores change', 'The current window is re-scored immediately, so flows the frozen model ignored can surface.'],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4 px-5 py-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                  border border-accent-line bg-accent-soft font-mono text-[11px] text-accent">
                  {i + 1}
                </span>
                <div>
                  <div className="text-body font-medium text-ink">{title}</div>
                  <div className="text-meta leading-relaxed text-ink-muted">{text}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle>What each screen is for</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {TABS.map(({ icon: Icon, name, text }) => (
            <div key={name} className="rounded-card border border-line bg-surface-1 p-4">
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-accent" />
                <span className="text-body font-medium text-ink">{name}</span>
              </div>
              <p className="mt-1.5 text-meta leading-relaxed text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle hint="Five minutes, in this order.">Driving it yourself</SectionTitle>
        <Card bare>
          <ol className="divide-y divide-line">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-4 px-5 py-3.5">
                <span className="mt-0.5 font-mono text-meta text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="text-body font-medium text-ink">{title}</div>
                  <div className="text-meta leading-relaxed text-ink-muted">{text}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionTitle hint="So you can weigh what you are looking at.">
          What is real and what is not
        </SectionTitle>
        <Card>
          <DataRow label="Detector, metrics, learning loop">real — trained and evaluated by scripts in this repo</DataRow>
          <DataRow label="Network traffic">real CIC-IDS2017 captures the model never trained on</DataRow>
          <DataRow label="Host telemetry">real Windows logs with ground-truth ATT&CK labels</DataRow>
          <DataRow label="ATT&CK technique table">real — 697 techniques from the official MITRE bundle</DataRow>
          <DataRow label="Audit chain">real SHA-256 chain; tampering is detected and located</DataRow>
          <DataRow label="Indian sites on the map">presentation only — real flows, illustrative locations</DataRow>
          <DataRow label="Containment actions">simulated; the approval gate and audit record are real</DataRow>
          <DataRow label="Dwell-time comparison">quoted from Mandiant M-Trends, not measured here</DataRow>
        </Card>
      </section>

      <section className="rounded-card border border-accent-line bg-accent-soft px-5 py-4">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-accent" />
          <span className="text-body font-medium text-ink">Stuck? Ask Argus.</span>
        </div>
        <p className="mt-1.5 max-w-[62ch] text-meta leading-relaxed text-ink-muted">
          The assistant in the bottom-right corner can read the live detections, explain any
          ATT&CK technique, tell you what the learning loop has done, and check the audit chain.
          It is scoped to this deployment — anything outside security work here, it will decline,
          and the refusal goes into the audit trail.
        </p>
      </section>
    </div>
  )
}
