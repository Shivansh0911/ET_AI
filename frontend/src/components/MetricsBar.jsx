import { ShieldAlert, Activity, Gauge, Target, Server } from 'lucide-react'

function Metric({ icon: Icon, label, value, accent, hint }) {
  return (
    <div className="bg-card border border-gray-800 rounded-xl p-4 flex items-center gap-3" title={hint}>
      <div className={`p-2 rounded-lg bg-gray-900 ${accent}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold mono text-gray-100">{value}</div>
      </div>
    </div>
  )
}

export default function MetricsBar({ dashboard }) {
  if (!dashboard) return null
  const { severity_counts, total_events, total_anomalies, assets_monitored, window_accuracy, latency } = dashboard

  const p50 = latency?.p50_ms != null ? `${latency.p50_ms.toFixed(1)}ms` : '—'
  const accuracy = window_accuracy != null ? `${(window_accuracy * 100).toFixed(1)}%` : '—'

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <Metric icon={Activity} label="Flows Scored" value={total_events} accent="text-blue-400"
        hint="Held-out CIC-IDS2017 flows scored by the model in this window" />
      <Metric icon={ShieldAlert} label="Detections" value={total_anomalies} accent="text-red-400"
        hint="Flows the model flagged as malicious — not a pre-labelled count" />
      <Metric icon={ShieldAlert} label="Critical" value={severity_counts?.critical ?? 0} accent="text-red-400"
        hint="Detections scoring 0.95 or above" />
      <Metric icon={Server} label="Assets Monitored" value={assets_monitored} accent="text-emerald-400"
        hint="Illustrative critical-infrastructure asset personas" />
      <Metric icon={Gauge} label="Detect Latency p50" value={p50} accent="text-yellow-400"
        hint="Measured: feature vector to scored detection, median over this window" />
      <Metric icon={Target} label="Window Accuracy" value={accuracy} accent="text-orange-400"
        hint="Model verdicts matching dataset ground truth across this replay window" />
    </div>
  )
}
