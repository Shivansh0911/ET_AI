import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RotateCw, Undo2, ChevronDown } from 'lucide-react'
import { api } from '../utils/api'
import {
  AXIS, Answer, Button, Card, DataRow, Empty, Failed, GRID, Loading, Mono, Note,
  Provenance, SERIES, Severity, Stat, StatStrip, TOOLTIP, TOOLTIP_FILL, VIZ, severityHex,
} from './ui'
import TriageQueue from './TriageQueue'

// The screen leads with four numbers and one chart. Everything else is behind a click, because
// an analyst arriving at a console needs to know "is it bad, and is it getting worse" before
// they need a severity histogram.

function hourlyVolume(events) {
  const buckets = new Map()
  for (const event of events) {
    const at = new Date(event.timestamp)
    at.setMinutes(0, 0, 0)
    const key = at.toISOString()
    const bucket = buckets.get(key) || {
      key, label: `${String(at.getHours()).padStart(2, '0')}:00`, flows: 0, detections: 0,
    }
    bucket.flows += 1
    if (event.detected) bucket.detections += 1
    buckets.set(key, bucket)
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export default function Overview() {
  const [dashboard, setDashboard] = useState(null)
  const [events, setEvents] = useState([])
  const [loop, setLoop] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [baseline, setBaseline] = useState(null)

  const load = useCallback(async () => {
    try {
      const [d, e, f, m] = await Promise.all([
        api.getDashboard(), api.getEvents(600), api.getFeedback(), api.getMetrics(),
      ])
      setDashboard(d); setEvents(e.events); setLoop(f); setMetrics(m); setError(null)
    } catch {
      setError('No answer from the API. Start the backend on port 8000 and reload.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const attacks = events.filter((e) => e.ground_truth?.is_attack)
    const caught = attacks.filter((e) => e.detected).length
    return {
      recall: attacks.length ? caught / attacks.length : 0,
      caught,
      attacks: attacks.length,
      surfaced: events.filter((e) => e.surfaced_by_feedback).length,
      volume: hourlyVolume(events),
    }
  }, [events])

  // Recall before the first verdict, captured once, so the delta shown is a real before/after
  // rather than a decorative arrow.
  useEffect(() => {
    if (baseline === null && stats.attacks > 0 && loop?.state?.labels_held === 0) {
      setBaseline(stats.recall)
    }
  }, [stats, loop, baseline])

  const refresh = async () => {
    setBusy(true)
    try { await api.refresh(); setBaseline(null); await load() } finally { setBusy(false) }
  }

  const reset = async () => {
    setBusy(true)
    try { await api.resetFeedback(); setBaseline(null); setAnalysis(null); await load() }
    finally { setBusy(false) }
  }

  if (error) return <Failed>{error}</Failed>
  if (!dashboard) return <Loading>Scoring the window</Loading>

  const state = loop?.state
  const offline = loop?.measured_offline
  const detection = metrics?.detection
  const severityData = Object.entries(dashboard.severity_counts || {})
    .filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  const infraData = Object.entries(dashboard.infra_breakdown || {})
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const queue = events.filter((e) => e.detected).slice(0, 25)
  const recallDelta = baseline !== null && state?.labels_held > 0
    ? Math.round((stats.recall - baseline) * 1000) / 10 : undefined

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold text-ink">Operations</h1>
          <p className="mt-1 text-meta text-ink-faint">{dashboard.stream_source}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={reset} disabled={busy} title="Discard analyst verdicts and start over">
            <Undo2 size={13} /> Reset training
          </Button>
          <Button variant="primary" onClick={refresh} disabled={busy}>
            <RotateCw size={13} className={busy ? 'animate-spin' : ''} /> Pull new window
          </Button>
        </div>
      </div>

      {/* Headline numbers first — live window, then the benchmark they should be read against. */}
      <StatStrip>
        <Card>
          <Stat
            label="Caught this window"
            value={`${(stats.recall * 100).toFixed(0)}%`}
            tone={stats.recall > 0.7 ? 'good' : stats.recall > 0.4 ? 'default' : 'bad'}
            delta={recallDelta}
            deltaLabel="pts since you started"
            note={`${stats.caught} of ${stats.attacks} known attacks`}
            size="display"
          />
        </Card>
        <Card>
          <Stat label="Open detections" value={dashboard.total_anomalies}
            note={stats.surfaced > 0
              ? `${stats.surfaced} surfaced by your feedback`
              : 'frozen model only — no verdicts yet'} />
        </Card>
        <Card>
          <Stat label="Analyst verdicts" value={state?.labels_held ?? 0}
            tone={state?.adaptive_active ? 'accent' : 'muted'}
            note={state?.adaptive_active
              ? `adaptive layer live · ${state.model_version}`
              : `${state?.labels_until_active ?? 0} more before the model refits`} />
        </Card>
        <Card>
          <Stat label="Time to score a flow" value={dashboard.latency?.p50_ms ?? '—'} unit="ms p50"
            note={`p95 ${dashboard.latency?.p95_ms ?? '—'} ms · measured, not estimated`} />
        </Card>
      </StatStrip>

      {detection?.available && (
        <Card
          title="The detector before any of your input"
          hint="Measured on capture days it never trained on. These are the numbers the loop above exists to move."
          aside={<Provenance kind="measured" />}
          tint="neutral"
        >
          <StatStrip columns={4}>
            <Stat label="Precision" value={`${(detection.precision * 100).toFixed(1)}%`} size="tabular" />
            <Stat label="Recall" value={`${(detection.recall * 100).toFixed(1)}%`} tone="bad" size="tabular" />
            <Stat label="Missed" value={`${(detection.false_negative_rate * 100).toFixed(1)}%`}
              tone="bad" size="tabular" note="false negatives" />
            <Stat label="False alarms" value={`${(detection.false_positive_rate * 100).toFixed(2)}%`}
              tone="good" size="tabular" />
          </StatStrip>
        </Card>
      )}

      <Card
        title="Traffic and detections across the window"
        hint="Every flow scored, hour by hour, with what the detector flagged laid over it."
      >
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={stats.volume} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="flows" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VIZ[1]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={VIZ[1]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="hits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.bad} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES.bad} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 5" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="flows" stroke={VIZ[1]} strokeWidth={1.6}
              fill="url(#flows)" name="flows scored" />
            <Area type="monotone" dataKey="detections" stroke={SERIES.bad} strokeWidth={1.6}
              fill="url(#hits)" name="detections" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {dashboard.alert_summary && dashboard.alert_summary.reduction_factor > 1 && (
        <Card title="Alert load" tint="neutral"
          hint="Detection is unchanged; this is what an analyst actually sees. Raw per-flow detections group into the campaigns they belong to.">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Stat label="Raw detections" value={dashboard.alert_summary.raw_detections} size="tabular" tone="muted" />
            <span className="pb-1 text-ink-faint">→</span>
            <Stat label="Grouped alerts" value={dashboard.alert_summary.aggregated_alerts} size="tabular" tone="good"
              note={`${dashboard.alert_summary.reduction_factor}x fewer to triage`} />
            {dashboard.alert_summary.per_operating_point?.map((p) => (
              <Stat key={p.label} label={p.label} size="tabular"
                value={`${p.aggregated_per_1000}/1k`} note={`raw ${p.raw_per_1000}/1k`} />
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3"><Note>{dashboard.alert_summary.at_scale}</Note></div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TriageQueue
            alerts={queue}
            onVerdict={load}
            emptyNote="Nothing crossed the threshold here. That is the gap the training loop exists to close — pull a new window, or read Evidence."
          />
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card
            title="Training loop"
            tint={state?.adaptive_active ? 'accent' : undefined}
            hint={state?.adaptive_active
              ? 'Live. Your verdicts are changing what gets flagged.'
              : 'Waiting for enough verdicts of each kind before it refits.'}
          >
            <StatStrip columns={3}>
              <Stat label="Marked real" value={state?.confirmed ?? 0} tone="good" size="tabular" />
              <Stat label="Marked false" value={state?.dismissed ?? 0} tone="muted" size="tabular" />
              <Stat label="Refits" value={state?.model_version?.replace('live-v', '') ?? 0}
                tone="accent" size="tabular" />
            </StatStrip>

            {offline?.available && (
              <div className="mt-4 border-t border-line pt-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-body font-medium text-ink">Measured on held-out data</span>
                  <Provenance kind="measured" />
                </div>
                <DataRow label={`within a campaign · ${offline.headline_label_budget} verdicts`} tone="good">
                  {(offline.settings[0].before.recall * 100).toFixed(1)}% →{' '}
                  {(offline.settings[0].at_headline_budget.recall * 100).toFixed(1)}%
                </DataRow>
                <DataRow label="across a later campaign">
                  {(offline.settings[1].before.recall * 100).toFixed(1)}% →{' '}
                  {(offline.settings[1].at_headline_budget.recall * 100).toFixed(1)}%
                </DataRow>
                <Note>
                  Feedback fixes the campaign in front of you. It does not carry to an unfamiliar
                  one — new attack families still need their own verdicts.
                </Note>
              </div>
            )}
          </Card>

          <Card title="Assessment"
            hint="What the language model makes of the current cluster."
            aside={
              <Button size="sm" onClick={async () => {
                setAnalysis('…')
                try { setAnalysis((await api.getCompoundAnalysis()).analysis) }
                catch { setAnalysis('The assessment did not come back.') }
              }}>Generate</Button>
            }
          >
            {analysis ? <Answer>{analysis}</Answer> : (
              <Empty title="Not yet run">
                Asks the model what this set of detections adds up to.
              </Empty>
            )}
          </Card>
        </div>
      </div>

      {/* Progressive disclosure: secondary breakdowns stay folded until asked for. */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-line
          bg-surface-1 py-2.5 text-meta text-ink-faint transition-colors
          hover:border-line-strong hover:text-ink-muted"
      >
        <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Hide breakdowns' : 'Severity and sector breakdowns'}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 rise lg:grid-cols-2">
          <Card title="Severity mix" hint="Across every flow scored, not just detections.">
            <div className="flex items-center gap-5">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={44}
                    outerRadius={70} paddingAngle={2} stroke="none">
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={severityHex(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_FILL} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {severityData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-meta">
                    <Severity level={s.name} dot />
                    <Mono>{s.value}</Mono>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Detections by sector" hint="Which kind of infrastructure is taking the hits.">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={infraData} layout="vertical" margin={{ left: 34, right: 12 }}>
                <CartesianGrid strokeDasharray="2 5" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={92} />
                <Tooltip {...TOOLTIP_FILL} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16} name="detections">
                  {infraData.map((entry, i) => (
                    <Cell key={entry.name} fill={VIZ[i % VIZ.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <Note>{dashboard.data_provenance}</Note>
    </div>
  )
}
