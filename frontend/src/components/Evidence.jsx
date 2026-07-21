import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../utils/api'
import { AXIS, Card, CHART_TOOLTIP, DataRow, Empty, Failed, GRID, Loading, Provenance,
  SectionTitle, Stat } from './ui'

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
        <h1 className="text-title font-semibold text-ink">Evidence</h1>
        <p className="mt-0.5 max-w-3xl text-meta leading-relaxed text-ink-faint">
          {metrics.note}
        </p>
      </div>

      {/* The result the whole submission rests on. */}
      {loop?.available && (
        <Card
          title="Learning from analyst verdicts"
          hint={loop.question}
          aside={<Provenance kind="measured" />}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {loop.settings.map((setting) => {
              const improved = setting.delta_at_headline.recall > 0.01
              return (
                <div key={setting.setting} className="rounded-md border border-line bg-surface-0 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-body font-medium text-ink">
                      {setting.setting === 'campaign_assisted'
                        ? 'Within an active campaign'
                        : 'Across a later, different campaign'}
                    </h3>
                    <span className={`font-mono text-[11px] ${improved ? 'text-good' : 'text-ink-faint'}`}>
                      {improved ? 'improves' : 'no transfer'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end gap-6">
                    <Stat label="Recall before" value={pct1(setting.before.recall)} size="figure" tone="muted" />
                    <span className="pb-1 text-ink-faint">→</span>
                    <Stat
                      label={`After ${loop.headline_label_budget} verdicts`}
                      value={pct1(setting.at_headline_budget.recall)}
                      tone={improved ? 'good' : 'muted'}
                    />
                    <Stat
                      label="FPR cost"
                      value={`${(setting.before.false_positive_rate * 100).toFixed(2)}% → ${(setting.at_headline_budget.false_positive_rate * 100).toFixed(2)}%`}
                      size="figure"
                    />
                  </div>

                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={setting.learning_curve} margin={{ top: 12, left: -24, right: 6 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
                      <XAxis dataKey="labels" tick={AXIS}
                        axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1]} tick={AXIS}
                        axisLine={false} tickLine={false} tickFormatter={(v) => `${v * 100}%`} />
                      <Tooltip contentStyle={CHART_TOOLTIP}
                        formatter={(v, n) => [`${(v * 100).toFixed(1)}%`, n]} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#697384' }} />
                      <Line type="monotone" dataKey="recall" stroke="#3fb47f" strokeWidth={2}
                        dot={false} name="recall" />
                      <Line type="monotone" dataKey="false_positive_rate" stroke="#f0616a"
                        strokeWidth={1.5} dot={false} name="false positives" />
                    </LineChart>
                  </ResponsiveContainer>

                  <p className="text-meta leading-relaxed text-ink-faint">
                    {setting.description}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-4 border-t border-line/60 pt-3">
            <h4 className="text-[12px] font-medium text-ink">What was tried first</h4>
            <div className="mt-1.5 space-y-1">
              {loop.engineering_log.map((entry) => (
                <div key={entry.attempt} className="text-meta leading-relaxed text-ink-faint">
                  <span className="font-mono tabular text-ink-muted">{entry.attempt}</span> — {entry.result}
                  <span className="text-ink-faint"> ({entry.why})</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-meta leading-relaxed text-ink-faint">
              <span className="text-ink-muted">Why not reinforcement learning: </span>
              {loop.why_not_reinforcement_learning}
            </p>
          </div>
        </Card>
      )}

      <Card
        title="Detector on unseen captures"
        hint={detection.available ? detection.why_this_split : undefined}
        aside={<Provenance kind="measured" />}
      >
        {!detection.available ? <Empty title="Not evaluated yet">{detection.reason}</Empty> : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Stat label="Precision" value={pct(detection.precision)} />
              <Stat label="Recall" value={pct(detection.recall)} tone="bad" />
              <Stat label="F1" value={pct(detection.f1)} />
              <Stat label="False positive rate" value={pct(detection.false_positive_rate)} tone="good" />
              <Stat label="False negative rate" value={pct(detection.false_negative_rate)} tone="bad" />
              <Stat label="ROC AUC" value={detection.roc_auc?.toFixed(4)} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-1.5 text-[12px] font-medium text-ink">
                  How hard is this benchmark, really?
                </h4>
                {Object.entries(detection.trivial_baselines || {}).map(([name, stat]) => (
                  <DataRow key={name} label={name.replace(/_/g, ' ')}>F1 {stat.f1?.toFixed(4)}</DataRow>
                ))}
                <DataRow label="this model">F1 {detection.f1?.toFixed(4)}</DataRow>
                <p className="mt-2 text-meta leading-relaxed text-ink-faint">
                  A depth-6 tree is close behind. The forest is not the interesting part of this
                  project — what happens after deployment is.
                </p>
              </div>

              <div>
                <h4 className="mb-1.5 text-[12px] font-medium text-ink">Per-family recall</h4>
                <div className="max-h-[220px] overflow-y-auto pr-1">
                  {Object.entries(detection.per_family_detection_rate || {}).map(([name, stat]) => (
                    <DataRow key={name} label={`${name} (n=${stat.n.toLocaleString()})`}>
                      <span className={stat.rate < 0.5 ? 'text-bad' : stat.rate < 0.9 ? 'text-severity-high' : 'text-good'}>
                        {pct1(stat.rate)}
                      </span>
                    </DataRow>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-line/60 pt-3">
              <DataRow label="superseded random-split recall">
                {pct1(detection.superseded_random_split?.recall)}
              </DataRow>
              <p className="mt-1.5 text-meta leading-relaxed text-ink-faint">
                {detection.superseded_random_split?.note}
              </p>
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="ATT&CK technique attribution" actions={<Provenance kind="measured" />}
          hint={attribution.available ? attribution.method : undefined}>
          {!attribution.available ? <Empty title="Not evaluated yet">{attribution.reason}</Empty> : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Top-1" value={pct1(attribution.top1_accuracy)} />
                <Stat label="Top-3" value={pct1(attribution.top3_accuracy)} />
                <Stat label="Baseline" value={pct1(attribution.majority_class_baseline)}
                  tone="muted" note="majority class" />
              </div>
              <p className="mt-3 text-meta leading-relaxed text-ink-faint">
                {attribution.samples} samples over {attribution.techniques_evaluated} techniques.
                At this sample size the 95% interval on top-1 is roughly ±11 points, so treat it
                as "about half", not 54.1%.
              </p>
            </>
          )}
        </Card>

        <Card title="Cross-plane fusion" actions={<Provenance kind="measured" />}
          hint={fusion?.available ? fusion.question : undefined}>
          {!fusion?.available ? <Empty title="Not evaluated yet">{fusion?.reason}</Empty> : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Attacks recovered" value={fusion.with_fusion.true_attacks_recovered}
                tone="good" note="invisible to the detector alone" />
              <Stat label="Benign promoted" value={fusion.with_fusion.benign_flows_promoted}
                tone="bad" note="the cost" />
              <Stat label="Fusion-only incidents" value={fusion.with_fusion.fusion_only_incidents} size="figure" />
              <Stat label="Weak-band attacks" value={fusion.weak_band.genuine_attacks} size="figure"
                note={`score ${fusion.weak_band.range[0]}–${fusion.weak_band.range[1]}`} />
            </div>
          )}
        </Card>

        <Card title="Detection latency" actions={<Provenance kind="measured" />}
          hint={latency?.label}>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="p50" value={latency?.p50_ms != null ? `${latency.p50_ms} ms` : '—'} />
            <Stat label="p95" value={latency?.p95_ms != null ? `${latency.p95_ms} ms` : '—'} />
            <Stat label="Batched" value={latency?.batch_ms_per_event != null ? `${latency.batch_ms_per_event} ms` : '—'}
              size="figure" note="per event" />
          </div>
        </Card>

        <Card title="Response automation coverage" actions={<Provenance kind="measured" />}
          hint={automation?.definition}>
          {automation?.available === false ? (
            <Empty title="No playbook run yet">{automation.reason}</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Coverage" value={`${automation.coverage_pct}%`} />
              <Stat label="Playbook steps" value={automation.playbook_steps} size="figure" />
              <Stat label="Ran autonomously" value={automation.executed_autonomously} size="figure" />
              <Stat label="Held for a human" value={automation.held_for_human_approval} size="figure"
                note="blast-radius gate" />
            </div>
          )}
        </Card>
      </div>

      <Card title="Comparison baseline" actions={<Provenance kind="cited" />} subtitle={baseline?.source}>
        <div className="flex flex-wrap items-center gap-6">
          <Stat label={baseline?.label} value={`${baseline?.value_days} days`} tone="muted" />
          <p className="max-w-xl text-meta leading-relaxed text-ink-faint">
            Context only. This is not comparable to the millisecond tabular above — one is an
            industry dwell-time median, the other is how long this pipeline takes to score a flow.
            Putting them on the same axis would be the trick we removed from this project.
          </p>
        </div>
      </Card>
    </div>
  )
}
