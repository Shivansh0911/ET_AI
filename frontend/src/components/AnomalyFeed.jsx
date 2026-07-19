import SeverityBadge from './SeverityBadge'

function timeAgo(ts) {
  const diffMs = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AnomalyFeed({ anomalies, loading }) {
  if (loading) {
    return <div className="text-gray-500 text-sm p-4">Loading intel...</div>
  }
  if (!anomalies || anomalies.length === 0) {
    return <div className="text-gray-500 text-sm p-4">No active anomalies detected.</div>
  }

  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
      {anomalies.map((a) => (
        <div
          key={a.id}
          className={`bg-card border border-gray-800 rounded-lg p-3 flex flex-col gap-1.5 ${
            a.severity === 'critical' ? 'shadow-glow-red' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-200">{a.asset}</span>
            <span className="text-xs text-gray-500 mono">{timeAgo(a.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-400">{a.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={a.severity} />
            {a.mitre_id && (
              <span className="px-2 py-0.5 rounded-md border border-gray-700 text-xs mono text-gray-400">
                {a.mitre_id}
              </span>
            )}
            <span className="text-xs text-gray-600 mono">src: {a.source_ip}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
