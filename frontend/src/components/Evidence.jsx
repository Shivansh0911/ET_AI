import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../utils/api'
import {
  AXIS, Card, DataRow, Empty, Failed, GRID, Loading, Note, Provenance,
  SERIES, Stat, StatStrip, TOOLTIP,
} from './ui'

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`)
const pct1 = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

export default function Evidence() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getMetrics().then(setMetrics).catch(() => setError('The metrics artifacts did not load.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!metrics) return <Loading>Reading evaluation artifacts</Loading>

  const { detection, continual_learning: loop, attribution, fusion, automation, latency, baseline } = metrics
  const speed = metrics.detection_speed
  const campaignSetting = loop?.settings?.[0]
  const campaign = detection?.campaign_level

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Evidence</h1>
        <p className="mt-1 max-w-3xl text-meta leading-relaxed text-ink-faint">{metrics.note}</p>
      </div>

      {/* Headline figures first. Everything below is the working behind them. */}
      <StatStrip columns={5}>
        <Card>
          <Stat label="Campaigns detected"
            value={campaign ? `${campaign.campaigns_detected}/${campaign.campaigns}` : '—'}
            tone="good" size="tabular"
            note="every attack campaign, caught at all" />
        </Card>
        <Card>
          <Stat label="Flows caught" value={pct1(detection?.recall)} size="tabular"
            note="per-flow recall, unseen captures" />
        </Card>
        <Card>
          <Stat label={`After ${loop?.headline_label_budget ?? 500} verdicts`}
            value={pct1(campaignSetting?.at_headline_budget?.recall)} tone="good" size="tabular"
            note="same held-out data" />
        </Card>
        <Card>
          <Stat label="False alarms" value={pct(detection?.false_positive_rate)} size="tabular"
            note="frozen model" />
        </Card>
        <Card>
          <Stat label="ATT&CK top-1" value={pct1(attribution?.top1_accuracy)} size="tabular"
            note={`vs ${pct1(attribution?.majority_class_baseline)} baseline`} />
        </Card>
        <Card>
          <Stat label="Playbook automated" size="tabular"
            value={automation?.coverage_pct != null ? `${automation.coverage_pct}%` : '—'}
            note={automation?.available === false ? 'run a playbook first' : 'of all steps'} />
        </Card>
      </StatStrip>

      {loop?.available && (
        <Card title="Learning from analyst verdicts" hint={loop.question}
          aside={<Provenance kind="measured" />} tint="accent">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {loop.settings.map((setting) => {
              const improved = setting.delta_at_headline.recall > 0.01
              return (
                <div key={setting.setting} className="rounded-lg border border-line bg-surface-2 p-4">
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

                  <div className="mt-3 flex flex-wrap items-end gap-6">
                    <Stat label="Before" value={pct1(setting.before.recall)} size="tabular" tone="muted" />
                    <span className="pb-2 text-ink-faint">→</span>
                    <Stat label="After" value={pct1(setting.at_headline_budget.recall)}
                      size="tabular" tone={improved ? 'good' : 'muted'} />
                    <Stat label="False alarms" size="tabular"
                      value={`${(setting.at_headline_budget.false_positive_rate * 100).toFixed(2)}%`} />
                  </div>

                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={setting.learning_curve} margin={{ top: 14, left: -22, right: 6 }}>
                      <CartesianGrid strokeDasharray="2 5" stroke={GRID} vertical={false} />
                      <XAxis dataKey="labels" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1]} tick={AXIS} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${v * 100}%`} />
                      <Tooltip {...TOOLTIP}
                        formatter={(v, n) => [`${(v * 100).toFixed(1)}%`, n]}
                        labelFormatter={(v) => `${v} verdicts`} />
                      <Legend wrapperStyle={{ fontSize: 11, color: SERIES.muted }} />
                      <Line type="monotone" dataKey="recall" stroke={SERIES.good} strokeWidth={2}
                        dot={false} name="attacks caught" />
                      <Line type="monotone" dataKey="false_positive_rate" stroke={SERIES.bad}
                        strokeWidth={1.5} dot={false} name="false alarms" />
                    </LineChart>
                  </ResponsiveContainer>

                  <Note>{setting.description}</Note>
                </div>
              )
            })}
          </div>

          <div className="mt-4 border-t border-line pt-3.5">
            <h4 className="text-body font-medium text-ink">What was tried first</h4>
            <div className="mt-1.5 space-y-1">
              {loop.engineering_log.map((entry) => (
                <div key={entry.attempt} className="text-meta leading-relaxed text-ink-faint">
                  <span className="font-mono text-ink-muted">{entry.attempt}</span> — {entry.result}
                  <span> ({entry.why})</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-meta leading-relaxed text-ink-faint">
              <span className="text-ink-muted">Why not reinforcement learning: </span>
              {loop.why_not_reinforcement_learning}
            </p>
          </div>
        </Card>
      )}

      {detection?.operating_points?.length > 0 && (
        <Card title="Two operating points"
          hint="The detector is high-recall by default. A precision-leaning point trades recall for a lighter alert load — a SOC picks per its alert budget."
          aside={<Provenance kind="measured" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {detection.operating_points.map((op) => (
              <div key={op.label} className="rounded-lg border border-line bg-surface-2 p-4">
                <div className="text-body font-medium text-ink">{op.label}</div>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <Stat label="Recall" value={pct1(op.recall)} size="tabular"
                    tone={op.recall > 0.75 ? 'good' : 'default'} />
                  <Stat label="Precision" value={pct1(op.precision)} size="tabular" />
                  <Stat label="Alerts / 1k" value={op.alerts_per_1000_flows} size="tabular"
                    tone={op.alerts_per_1000_flows > 200 ? 'bad' : 'muted'} />
                </div>
                <Note>{op.note}</Note>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <Note>Alerts per 1,000 flows is rate-independent. At the shipped point the analyst
              feedback loop then suppresses false positives over time; the precision point is the
              lever for a team that cannot absorb the volume up front.</Note>
          </div>
        </Card>
      )}

      <Card title="Detector on unseen captures" hint={detection?.why_this_split}
        aside={<Provenance kind="measured" />}>
        {!detection?.available ? <Empty title="Not evaluated yet">{detection?.reason}</Empty> : (
          <>
            <StatStrip columns={6}>
              <Stat label="Precision" value={pct(detection.precision)} size="tabular" />
              <Stat label="Recall" value={pct(detection.recall)} tone="bad" size="tabular" />
              <Stat label="F1" value={pct(detection.f1)} size="tabular" />
              <Stat label="False positives" value={pct(detection.false_positive_rate)} tone="good" size="tabular" />
              <Stat label="False negatives" value={pct(detection.false_negative_rate)} tone="bad" size="tabular" />
              <Stat label="ROC AUC" value={detection.roc_auc?.toFixed(4)} size="tabular"
                note="supervised head" />
            </StatStrip>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-body font-medium text-ink">
                  How hard is this benchmark, really?
                </h4>
                {Object.entries(detection.trivial_baselines || {}).map(([name, stat]) => (
                  <DataRow key={name} label={name.replace(/_/g, ' ')}>F1 {stat.f1?.toFixed(4)}</DataRow>
                ))}
                <DataRow label="this model" tone="good">F1 {detection.f1?.toFixed(4)}</DataRow>
                <Note>
                  A six-level decision tree comes close. The classifier is not the interesting
                  part of this project — what happens to it after deployment is.
                </Note>
              </div>

              <div>
                <h4 className="mb-2 text-body font-medium text-ink">Per-family recall</h4>
                <div className="max-h-[230px] overflow-y-auto pr-1">
                  {Object.entries(detection.per_family_detection_rate || {}).map(([name, stat]) => (
                    <DataRow key={name} label={`${name} · n=${stat.n.toLocaleString()}`}>
                      <span className={stat.rate < 0.5 ? 'text-bad'
                        : stat.rate < 0.9 ? 'text-severity-high' : 'text-good'}>
                        {pct1(stat.rate)}
                      </span>
                    </DataRow>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-3.5">
              <DataRow label="superseded random-split recall">
                {pct1(detection.superseded_random_split?.recall)}
              </DataRow>
              <Note>{detection.superseded_random_split?.note}</Note>
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="ATT&CK technique attribution" aside={<Provenance kind="measured" />}
          hint={attribution?.method}>
          {!attribution?.available ? <Empty title="Not evaluated yet">{attribution?.reason}</Empty> : (
            <>
              <StatStrip columns={3}>
                <Stat label="Top-1" value={pct1(attribution.top1_accuracy)} size="tabular" />
                <Stat label="Top-3" value={pct1(attribution.top3_accuracy)} size="tabular" />
                <Stat label="Baseline" value={pct1(attribution.majority_class_baseline)}
                  tone="muted" size="tabular" note="majority class" />
              </StatStrip>
              <Note>
                {attribution.samples} samples across {attribution.techniques_evaluated} techniques.
                At that size the 95% interval on top-1 is roughly ±11 points, so read it as
                "about half", not to the decimal.
              </Note>
            </>
          )}
        </Card>

        <Card title="Cross-plane correlation" aside={<Provenance kind="measured" />}
          hint={fusion?.question}>
          {!fusion?.available ? <Empty title="Not evaluated yet">{fusion?.reason}</Empty> : (
            <StatStrip columns={4}>
              <Stat label="Attacks recovered" value={fusion.with_fusion.true_attacks_recovered}
                tone="good" size="tabular" />
              <Stat label="Benign promoted" value={fusion.with_fusion.benign_flows_promoted}
                tone="bad" size="tabular" note="the cost" />
              <Stat label="Fusion-only" value={fusion.with_fusion.fusion_only_incidents} size="tabular" />
              <Stat label="Weak band" value={fusion.weak_band.genuine_attacks} size="tabular"
                note={`score ${fusion.weak_band.range[0]}–${fusion.weak_band.range[1]}`} />
            </StatStrip>
          )}
        </Card>

        <Card title="Detection latency" aside={<Provenance kind="measured" />} hint={latency?.label}>
          <StatStrip columns={3}>
            <Stat label="p50" value={latency?.p50_ms != null ? `${latency.p50_ms} ms` : '—'} size="tabular" />
            <Stat label="p95" value={latency?.p95_ms != null ? `${latency.p95_ms} ms` : '—'} size="tabular" />
            <Stat label="Batched" size="tabular"
              value={latency?.batch_ms_per_event != null ? `${latency.batch_ms_per_event} ms` : '—'}
              note="per event" />
          </StatStrip>
        </Card>

        <Card title="Response automation" aside={<Provenance kind="measured" />}
          hint={automation?.definition}>
          {automation?.available === false ? (
            <Empty title="No playbook run yet">{automation.reason}</Empty>
          ) : (
            <StatStrip columns={4}>
              <Stat label="Coverage" value={`${automation.coverage_pct}%`} size="tabular" />
              <Stat label="Steps" value={automation.playbook_steps} size="tabular" />
              <Stat label="Autonomous" value={automation.executed_autonomously} tone="good" size="tabular" />
              <Stat label="Gated" value={automation.held_for_human_approval}
                tone="muted" size="tabular" note="blast radius" />
            </StatStrip>
          )}
        </Card>
      </div>

      {speed && (
        <Card title="Detection speed — measured vs cited" tint="neutral">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-body font-medium text-ink">Our measured latency</span>
                <Provenance kind="measured" />
              </div>
              <DataRow label="campaigns detected">
                {speed.measured.campaigns_detected} / {speed.measured.campaigns}
              </DataRow>
              <DataRow label="median flows to first alert">{speed.measured.median_flows_to_first_detection}</DataRow>
              <DataRow label="worst case">{speed.measured.worst_flows_to_first_detection}</DataRow>
              <Note>{speed.measured.unit_caveat}</Note>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-body font-medium text-ink">Industry baseline</span>
                <Provenance kind="cited" />
              </div>
              <DataRow label="median dwell time">{speed.cited_baseline.mttd_days} days</DataRow>
              <DataRow label="mean time to contain">{speed.cited_baseline.mttc_days} days</DataRow>
              <Note>{speed.cited_baseline.mttd_source}</Note>
              <Note>{speed.cited_baseline.mttc_source}</Note>
            </div>
          </div>
          <div className="mt-4 border-t border-line pt-3.5">
            <Note>{speed.framing.statement}</Note>
            <Note>{speed.framing.cost_reference}</Note>
          </div>
        </Card>
      )}

      <Card title="Comparison baseline" aside={<Provenance kind="cited" />} hint={baseline?.source}>
        <div className="flex flex-wrap items-center gap-8">
          <Stat label={baseline?.label} value={`${baseline?.value_days} days`} tone="muted" />
          <p className="max-w-xl text-meta leading-relaxed text-ink-faint">
            Context only, and not comparable to the millisecond figure above — one is an
            industry dwell-time median, the other is how long this pipeline takes to score a
            single flow. Putting them on one axis is the trick this project removed.
          </p>
        </div>
      </Card>
    </div>
  )
}
