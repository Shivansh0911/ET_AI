import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { api } from '../utils/api'
import ProvenanceTag from './Provenance'

function pct(value) {
  return value == null ? '—' : `${(value * 100).toFixed(2)}%`
}

function Figure({ label, value, sub }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold mono text-gray-100 mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function Card({ title, provenance, subtitle, children }) {
  return (
    <div className="bg-card border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <ProvenanceTag kind={provenance} />
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-3 leading-relaxed">{subtitle}</p>}
      {children}
    </div>
  )
}

function Unavailable({ reason }) {
  return (
    <div className="flex items-start gap-2 text-xs text-gray-500">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      {reason}
    </div>
  )
}

export default function Evidence() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getMetrics().then(setMetrics).catch(() => setError('Unable to load metrics.'))
  }, [])

  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>
  if (!metrics) return <div className="text-gray-500 p-8 text-center">Loading evidence...</div>

  const { detection, attribution, fusion, automation, latency, baseline } = metrics

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-200">Evidence</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">{metrics.note}</p>
      </div>

      <Card
        title="Detection — CIC-IDS2017 benchmark"
        provenance="measured"
        subtitle={detection.available
          ? `${detection.model} evaluated on ${detection.test_rows.toLocaleString()} held-out flows (${detection.test_attack_rows.toLocaleString()} attack / ${detection.test_benign_rows.toLocaleString()} benign) at their true class balance.`
          : undefined}
      >
        {!detection.available ? <Unavailable reason={detection.reason} /> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
              <Figure label="Precision" value={pct(detection.precision)} />
              <Figure label="Recall" value={pct(detection.recall)} />
              <Figure label="F1" value={pct(detection.f1)} />
              <Figure label="False positive rate" value={pct(detection.false_positive_rate)} />
              <Figure label="False negative rate" value={pct(detection.false_negative_rate)} />
              <Figure label="ROC AUC" value={detection.roc_auc?.toFixed(4)} />
            </div>

            <h4 className="text-xs font-semibold text-gray-400 mb-2">
              Per-family detection rate — including where it is weak
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left font-medium py-1.5">Attack family</th>
                    <th className="text-right font-medium">Test flows</th>
                    <th className="text-right font-medium">Detected</th>
                    <th className="text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody className="mono">
                  {Object.entries(detection.per_family_detection_rate || {}).map(([name, s]) => (
                    <tr key={name} className="border-b border-gray-900">
                      <td className="py-1.5 text-gray-300">{name}</td>
                      <td className="text-right text-gray-500">{s.n.toLocaleString()}</td>
                      <td className="text-right text-gray-500">{s.detected.toLocaleString()}</td>
                      <td className={`text-right ${s.rate < 0.9 ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {(s.rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-3 space-y-1">
              {(detection.caveats || []).map((c, i) => (
                <li key={i} className="text-[11px] text-gray-500 leading-relaxed">— {c}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="ATT&CK technique attribution"
          provenance="measured"
          subtitle={attribution.available ? attribution.method : undefined}
        >
          {!attribution.available ? <Unavailable reason={attribution.reason} /> : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Figure label="Top-1" value={pct(attribution.top1_accuracy)} />
                <Figure label="Top-3" value={pct(attribution.top3_accuracy)} />
                <Figure label="Baseline" value={pct(attribution.majority_class_baseline)}
                  sub="majority class" />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {attribution.samples} dataset-technique samples over {attribution.techniques_evaluated} techniques.{' '}
                {(attribution.techniques_excluded_single_dataset || []).length} techniques excluded — a single
                dataset each, which leave-one-out cannot predict.
              </p>
              <ul className="mt-2 space-y-1">
                {(attribution.honesty || []).map((c, i) => (
                  <li key={i} className="text-[11px] text-gray-500 leading-relaxed">— {c}</li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card
          title="Cross-plane fusion"
          provenance="measured"
          subtitle={fusion?.available ? fusion.question : undefined}
        >
          {!fusion?.available ? <Unavailable reason={fusion?.reason} /> : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Figure label="Attacks recovered" value={fusion.with_fusion.true_attacks_recovered}
                  sub="invisible to the detector alone" />
                <Figure label="Benign promoted" value={fusion.with_fusion.benign_flows_promoted}
                  sub="the cost side" />
                <Figure label="Fusion-only incidents" value={fusion.with_fusion.fusion_only_incidents} />
                <Figure label="Weak-band attacks" value={fusion.weak_band.genuine_attacks}
                  sub={`score ${fusion.weak_band.range[0]}–${fusion.weak_band.range[1]}`} />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Across {fusion.windows} replay windows / {fusion.flows_evaluated.toLocaleString()} flows, the
                detector alone missed {fusion.detector_alone.attacks_missed} genuine attacks.
              </p>
              <ul className="mt-2 space-y-1">
                {(fusion.honesty || []).slice(0, 2).map((c, i) => (
                  <li key={i} className="text-[11px] text-gray-500 leading-relaxed">— {c}</li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Detection latency" provenance="measured"
          subtitle={latency?.label}>
          {latency?.available === false ? <Unavailable reason={latency.reason} /> : (
            <div className="grid grid-cols-3 gap-2">
              <Figure label="p50" value={latency?.p50_ms != null ? `${latency.p50_ms} ms` : '—'} />
              <Figure label="p95" value={latency?.p95_ms != null ? `${latency.p95_ms} ms` : '—'} />
              <Figure label="Batched" value={latency?.batch_ms_per_event != null
                ? `${latency.batch_ms_per_event} ms` : '—'} sub="per event" />
            </div>
          )}
        </Card>

        <Card title="Response automation coverage" provenance="measured"
          subtitle={automation?.definition}>
          {automation?.available === false ? <Unavailable reason={automation.reason} /> : (
            <div className="grid grid-cols-2 gap-2">
              <Figure label="Coverage" value={`${automation.coverage_pct}%`} />
              <Figure label="Playbook steps" value={automation.playbook_steps} />
              <Figure label="Executed autonomously" value={automation.executed_autonomously} />
              <Figure label="Held for a human" value={automation.held_for_human_approval}
                sub="blast-radius gate" />
            </div>
          )}
        </Card>
      </div>

      <Card title="Comparison baseline" provenance="cited" subtitle={baseline?.source}>
        <div className="flex items-center gap-4">
          <Figure label={baseline?.label} value={`${baseline?.value_days} days`} />
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-lg">
            Shown for context only. We did not measure this and it is not comparable to the
            millisecond figure above — one is an industry dwell-time median, the other is this
            pipeline's own processing time.
          </p>
        </div>
      </Card>
    </div>
  )
}
