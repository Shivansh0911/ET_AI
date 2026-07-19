const STYLES = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  info: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
}

export default function SeverityBadge({ severity = 'info' }) {
  const style = STYLES[severity] || STYLES.info
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold uppercase tracking-wide mono ${style}`}>
      {severity}
    </span>
  )
}

export function severityColor(severity) {
  return {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
    info: '#10b981',
  }[severity] || '#10b981'
}
