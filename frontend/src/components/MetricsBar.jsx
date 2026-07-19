import { ShieldAlert, Activity, Clock, Timer, Server } from 'lucide-react'

function Metric({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-card border border-gray-800 rounded-xl p-4 flex items-center gap-3">
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
  const { severity_counts, total_events, total_anomalies, assets_monitored, mttd_minutes, mttr_minutes } = dashboard

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <Metric icon={Activity} label="Total Events" value={total_events} accent="text-blue-400" />
      <Metric icon={ShieldAlert} label="Anomalies" value={total_anomalies} accent="text-red-400" />
      <Metric icon={ShieldAlert} label="Critical" value={severity_counts?.critical ?? 0} accent="text-red-400" />
      <Metric icon={Server} label="Assets Monitored" value={assets_monitored} accent="text-emerald-400" />
      <Metric icon={Clock} label="MTTD" value={`${mttd_minutes}m`} accent="text-yellow-400" />
      <Metric icon={Timer} label="MTTR" value={`${mttr_minutes}m`} accent="text-orange-400" />
    </div>
  )
}
