import { useCallback, useEffect, useState } from 'react'
import { RotateCw, Undo2, TrendingUp } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../utils/api'
import { Panel, Figure, Button, Provenance, Loading, Failed, Answer, severityHex } from './ui'
import TriageQueue from './TriageQueue'

const CHART_STYLE = {
  background: '#0e1013', border: '1px solid #1e232c', borderRadius: 8, fontSize: 12,
}

export default function Overview() {
  const [dashboard, setDashboard] = useState(null)
  const [events, setEvents] = useState([])
  const [loop, setLoop] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [d, e, f] = await Promise.all([
        api.getDashboard(), api.getEvents(600), api.getFeedback(),
      ])
      setDashboard(d)
      setEvents(e.events)
      setLoop(f)
      setError(null)
    } catch {
      setError('No response from the backend. Is it running on port 8000?')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const refresh = async () => {
    setBusy(true)
    try { await api.refresh(); await load() } finally { setBusy(false) }
  }

  const reset = async () => {
    setBusy(true)
    try { await api.resetFeedback(); await load(); setAnalysis(null) } finally { setBusy(false) }
  }

  if (error) return <Failed>{error}</Failed>
  if (!dashboard) return <Loading>Scoring the window…</Loading>

  const attacks = events.filter((e) => e.ground_truth?.is_attack)
  const caught = attacks.filter((e) => e.detected).length
  const recall = attacks.length ? caught / attacks.length : 0
  const surfaced = events.filter((e) => e.surfaced_by_feedback).length
  const queue = events.filter((e) => e.detected).slice(0, 25)
  const state = loop?.state

  const severityData = Object.entries(dashboard.severity_counts || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
  const infraData = Object.entries(dashboard.infra_breakdown || {}).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-content">Live window</h1>
          <p className="mt-0.5 text-[12px] text-content-faint">{dashboard.stream_source}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={reset} disabled={busy} title="Clear analyst verdicts and refit from scratch">
            <Undo2 size={13} /> Reset loop
          </Button>
          <Button variant="primary" onClick={refresh} disabled={busy}>
            <RotateCw size={13} className={busy ? 'animate-spin' : ''} /> New window
          </Button>
        </div>
      </div>

      <div className="rounded-panel border border-severity-medium/25 bg-severity-medium/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Provenance kind="illustrative" />
          <span className="text-[12px] font-medium text-content">Read this before the numbers</span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-content-muted">
          {dashboard.data_provenance}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Panel className="!p-0"><div className="p-4">
          <Figure label="Flows scored" value={dashboard.total_events} />
        </div></Panel>
        <Panel className="!p-0"><div className="p-4">
          <Figure label="Detections" value={dashboard.total_anomalies}
            note={surfaced > 0 ? `${surfaced} from your feedback` : 'frozen model only'} />
        </div></Panel>
        <Panel className="!p-0"><div className="p-4">
          <Figure label="Recall this window" value={`${(recall * 100).toFixed(1)}%`}
            tone={recall > 0.7 ? 'good' : recall > 0.4 ? 'default' : 'bad'}
            note={`${caught} of ${attacks.length} known attacks`} />
        </div></Panel>
        <Panel className="!p-0"><div className="p-4">
          <Figure label="Detect latency p50" value={`${dashboard.latency?.p50_ms ?? '—'} ms`} />
        </div></Panel>
        <Panel className="!p-0"><div className="p-4">
          <Figure label="Analyst verdicts" value={state?.labels_held ?? 0}
            tone={state?.adaptive_active ? 'accent' : 'muted'}
            note={state?.adaptive_active ? state.model_version : `${state?.labels_until_active ?? 0} more to activate`} />
        </div></Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TriageQueue
            alerts={queue}
            onVerdict={load}
            emptyNote="The frozen model flagged nothing here. That is the problem the loop solves — open a new window or check Evidence."
          />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Learning loop"
            subtitle={state?.adaptive_active
              ? 'Active. Your verdicts are changing what gets flagged.'
              : 'Dormant until it has enough verdicts of each kind.'}
          >
            <div className="grid grid-cols-2 gap-3">
              <Figure label="Confirmed" value={state?.confirmed ?? 0} size="sm" tone="good" />
              <Figure label="Dismissed" value={state?.dismissed ?? 0} size="sm" tone="muted" />
            </div>
            {loop?.measured_offline?.available && (
              <div className="mt-4 border-t border-ink-800 pt-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-good" />
                  <span className="text-[12px] font-medium text-content">Measured offline</span>
                  <Provenance kind="measured" />
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-content-muted">
                  On a held-out evaluation set, {loop.measured_offline.headline_label_budget} verdicts
                  moved recall from{' '}
                  <span className="mono text-content">
                    {(loop.measured_offline.settings[0].before.recall * 100).toFixed(1)}%
                  </span>{' '}to{' '}
                  <span className="mono text-good">
                    {(loop.measured_offline.settings[0].at_headline_budget.recall * 100).toFixed(1)}%
                  </span>. Across a different later campaign it moved{' '}
                  <span className="mono text-content">
                    {(loop.measured_offline.settings[1].delta_at_headline.recall * 100).toFixed(1)}pp
                  </span> — feedback does not transfer to novel families.
                </p>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-content-faint">
              {state?.caveat}
            </p>
          </Panel>

          <Panel
            title="Compound analysis"
            actions={
              <Button size="sm" onClick={async () => {
                setAnalysis('…')
                try { setAnalysis((await api.getCompoundAnalysis()).analysis) }
                catch { setAnalysis('Analysis unavailable.') }
              }}>Run</Button>
            }
            subtitle="Groq reasoning over the current detections."
          >
            {analysis ? <Answer>{analysis}</Answer> : (
              <p className="text-[12px] text-content-faint">
                Asks the model what this cluster of detections adds up to.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Severity mix" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={46}
                outerRadius={72} paddingAngle={2} stroke="none">
                {severityData.map((entry) => (
                  <Cell key={entry.name} fill={severityHex(entry.name)} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {severityData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-[11px] text-content-faint">
                <span className="h-2 w-2 rounded-sm" style={{ background: severityHex(s.name) }} />
                {s.name} {s.value}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Detections by infrastructure type" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={infraData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1e232c" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#6b7482', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7482', fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#151920' }} />
              <Bar dataKey="value" fill="#5b8def" radius={[3, 3, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  )
}
