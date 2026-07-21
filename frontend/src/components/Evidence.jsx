import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../utils/api'
import { Panel, Figure, Provenance, Loading, Failed, Empty, Row } from './ui'

const CHART_STYLE = { background: '#0e1013', border: '1px solid #1e232c', borderRadius: 8, fontSize: 12 }
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`)
const pct1 = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

export default function Evidence() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getMetrics().then(setMetrics).catch(() => setError('Could not load the metrics.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!metrics) return <Loading>Reading evaluation artifacts…</Loading>

  const { detection, continual_learning: loop, attribution, fusion, automation, latency, baseline } = metrics

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-content">Evidence</h1>
        <p className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-content-faint">
          {metrics.note}
        </p>
      </div>

      {/* The result the whole submission rests on. */}
      {loop?.available && (
        <Panel
          title="Learning from analyst verdicts"
          subtitle={loop.question}
          actions={<Provenance kind="measured" />}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {loop.settings.map((setting) => {
              const improved = setting.delta_at_headline.recall > 0.01
              return (
                <div key={setting.setting} className="rounded-md border border-ink-700 bg-ink-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-medium text-content">
                      {setting.setting === 'campaign_assisted'
                        ? 'Within an active campaign'
                        : 'Across a later, different campaign'}
                    </h3>
                    <span className={`mono text-[11px] ${improved ? 'text-good' : 'text-content-faint'}`}>
                      {improved ? 'improves' : 'no transfer'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end gap-6">
                    <Figure label="Recall before" value={pct1(setting.before.recall)} size="sm" tone="muted" />
                    <span className="pb-1 text-content-faint">→</span>
                    <Figure
                      label={`After ${loop.headline_label_budget} verdicts`}
                      value={pct1(setting.at_headline_budget.recall)}
                      tone={improved ? 'good' : 'muted'}
                    />
                    <Figure
                      label="FPR cost"
                      value={`${(setting.before.false_positive_rate * 100).toFixed(2)}% → ${(setting.at_headline_budget.false_positive_rate * 100).toFixed(2)}%`}
                      size="sm"
                    />
                  </div>

                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={setting.learning_curve} margin={{ top: 12, left: -24, right: 6 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e232c" vertical={false} />
                      <XAxis dataKey="labels" tick={{ fill: '#6b7482', fontSize: 10 }}
                        axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1]} tick={{ fill: '#6b7482', fontSize: 10 }}
                        axisLine={false} tickLine={false} tickFormatter={(v) => `${v * 100}%`} />
                      <Tooltip contentStyle={CHART_STYLE}
                        formatter={(v, n) => [`${(v * 100).toFixed(1)}%`, n]} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#6b7482' }} />
                      <Line type="monotone" dataKey="recall" stroke="#30a46c" strokeWidth={2}
                        dot={false} name="recall" />
                      <Line type="monotone" dataKey="false_positive_rate" stroke="#e5484d"
                        strokeWidth={1.5} dot={false} name="false positives" />
                    </LineChart>
                  </ResponsiveContainer>

                  <p className="text-[11px] leading-relaxed text-content-faint">
                    {setting.description}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-4 border-t border-ink-800 pt-3">
            <h4 className="text-[12px] font-medium text-content">What was tried first</h4>
            <div className="mt-1.5 space-y-1">
              {loop.engineering_log.map((entry) => (
                <div key={entry.attempt} className="text-[11px] leading-relaxed text-content-faint">
                  <span className="mono text-content-muted">{entry.attempt}</span> — {entry.result}
                  <span className="text-content-faint"> ({entry.why})</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-content-faint">
              <span className="text-content-muted">Why not reinforcement learning: </span>
              {loop.why_not_reinforcement_learning}
            </p>
          </div>
        </Panel>
      )}

      <Panel
        title="Detector on unseen captures"
        subtitle={detection.available ? detection.why_this_split : undefined}
        actions={<Provenance kind="measured" />}
      >
        {!detection.available ? <Empty>{detection.reason}</Empty> : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Figure label="Precision" value={pct(detection.precision)} />
              <Figure label="Recall" value={pct(detection.recall)} tone="bad" />
              <Figure label="F1" value={pct(detection.f1)} />
              <Figure label="False positive rate" value={pct(detection.false_positive_rate)} tone="good" />
              <Figure label="False negative rate" value={pct(detection.false_negative_rate)} tone="bad" />
              <Figure label="ROC AUC" value={detection.roc_auc?.toFixed(4)} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-1.5 text-[12px] font-medium text-content">
                  How hard is this benchmark, really?
                </h4>
                {Object.entries(detection.trivial_baselines || {}).map(([name, stat]) => (
                  <Row key={name} label={name.replace(/_/g, ' ')}>F1 {stat.f1?.toFixed(4)}</Row>
                ))}
                <Row label="this model">F1 {detection.f1?.toFixed(4)}</Row>
                <p className="mt-2 text-[11px] leading-relaxed text-content-faint">
                  A depth-6 tree is close behind. The forest is not the interesting part of this
                  project — what happens after deployment is.
                </p>
              </div>

              <div>
                <h4 className="mb-1.5 text-[12px] font-medium text-content">Per-family recall</h4>
                <div className="max-h-[220px] overflow-y-auto pr-1">
                  {Object.entries(detection.per_family_detection_rate || {}).map(([name, stat]) => (
                    <Row key={name} label={`${name} (n=${stat.n.toLocaleString()})`}>
                      <span className={stat.rate < 0.5 ? 'text-bad' : stat.rate < 0.9 ? 'text-severity-high' : 'text-good'}>
                        {pct1(stat.rate)}
                      </span>
                    </Row>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-ink-800 pt-3">
              <Row label="superseded random-split recall">
                {pct1(detection.superseded_random_split?.recall)}
              </Row>
              <p className="mt-1.5 text-[11px] leading-relaxed text-content-faint">
                {detection.superseded_random_split?.note}
              </p>
            </div>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="ATT&CK technique attribution" actions={<Provenance kind="measured" />}
          subtitle={attribution.available ? attribution.method : undefined}>
          {!attribution.available ? <Empty>{attribution.reason}</Empty> : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Figure label="Top-1" value={pct1(attribution.top1_accuracy)} />
                <Figure label="Top-3" value={pct1(attribution.top3_accuracy)} />
                <Figure label="Baseline" value={pct1(attribution.majority_class_baseline)}
                  tone="muted" note="majority class" />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-content-faint">
                {attribution.samples} samples over {attribution.techniques_evaluated} techniques.
                At this sample size the 95% interval on top-1 is roughly ±11 points, so treat it
                as "about half", not 54.1%.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Cross-plane fusion" actions={<Provenance kind="measured" />}
          subtitle={fusion?.available ? fusion.question : undefined}>
          {!fusion?.available ? <Empty>{fusion?.reason}</Empty> : (
            <div className="grid grid-cols-2 gap-4">
              <Figure label="Attacks recovered" value={fusion.with_fusion.true_attacks_recovered}
                tone="good" note="invisible to the detector alone" />
              <Figure label="Benign promoted" value={fusion.with_fusion.benign_flows_promoted}
                tone="bad" note="the cost" />
              <Figure label="Fusion-only incidents" value={fusion.with_fusion.fusion_only_incidents} size="sm" />
              <Figure label="Weak-band attacks" value={fusion.weak_band.genuine_attacks} size="sm"
                note={`score ${fusion.weak_band.range[0]}–${fusion.weak_band.range[1]}`} />
            </div>
          )}
        </Panel>

        <Panel title="Detection latency" actions={<Provenance kind="measured" />}
          subtitle={latency?.label}>
          <div className="grid grid-cols-3 gap-4">
            <Figure label="p50" value={latency?.p50_ms != null ? `${latency.p50_ms} ms` : '—'} />
            <Figure label="p95" value={latency?.p95_ms != null ? `${latency.p95_ms} ms` : '—'} />
            <Figure label="Batched" value={latency?.batch_ms_per_event != null ? `${latency.batch_ms_per_event} ms` : '—'}
              size="sm" note="per event" />
          </div>
        </Panel>

        <Panel title="Response automation coverage" actions={<Provenance kind="measured" />}
          subtitle={automation?.definition}>
          {automation?.available === false ? (
            <Empty>{automation.reason}</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Figure label="Coverage" value={`${automation.coverage_pct}%`} />
              <Figure label="Playbook steps" value={automation.playbook_steps} size="sm" />
              <Figure label="Ran autonomously" value={automation.executed_autonomously} size="sm" />
              <Figure label="Held for a human" value={automation.held_for_human_approval} size="sm"
                note="blast-radius gate" />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Comparison baseline" actions={<Provenance kind="cited" />} subtitle={baseline?.source}>
        <div className="flex flex-wrap items-center gap-6">
          <Figure label={baseline?.label} value={`${baseline?.value_days} days`} tone="muted" />
          <p className="max-w-xl text-[11px] leading-relaxed text-content-faint">
            Context only. This is not comparable to the millisecond figure above — one is an
            industry dwell-time median, the other is how long this pipeline takes to score a flow.
            Putting them on the same axis would be the trick we removed from this project.
          </p>
        </div>
      </Panel>
    </div>
  )
}
