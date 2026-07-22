import { useState } from 'react'
import { Check, X, Sparkles, ChevronDown } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Button, Severity, Mono, DataRow, Empty } from './ui'

// Where the loop is actually driven. Each verdict is a labelled example; the detector refits
// every fourth one. Rows stay collapsed until clicked — an analyst scans the queue first and
// reads one alert at a time.

function relative(timestamp) {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
  if (minutes < 1) return 'moments ago'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
}

export default function TriageQueue({ alerts, onVerdict, emptyNote }) {
  const [settled, setSettled] = useState({})
  const [open, setOpen] = useState(null)

  const submit = async (alert, verdict, event) => {
    event.stopPropagation()
    setSettled((s) => ({ ...s, [alert.id]: verdict }))
    try {
      onVerdict?.(await api.sendFeedback(alert.id, verdict))
    } catch {
      setSettled((s) => ({ ...s, [alert.id]: undefined }))
    }
  }

  if (!alerts?.length) {
    return (
      <Card title="Triage queue">
        <Empty title="Queue is clear">{emptyNote}</Empty>
      </Card>
    )
  }

  return (
    <Card
      title="Triage queue"
      hint="Mark each one real or false. Your verdicts train the detector — it refits every fourth."
    >
      <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
        {alerts.map((alert) => {
          const verdict = settled[alert.id]
          const isOpen = open === alert.id
          return (
            <div
              key={alert.id}
              onClick={() => setOpen(isOpen ? null : alert.id)}
              className={`cursor-pointer rounded-lg border transition-colors ${
                verdict ? 'border-line/60 bg-surface-1 opacity-55'
                  : isOpen ? 'border-line-strong bg-surface-2'
                  : 'border-line bg-surface-2 hover:border-line-strong'
              }`}
            >
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ChevronDown size={12}
                    className={`shrink-0 text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  <span className="shrink-0 text-body font-medium text-ink">{alert.asset}</span>
                  <Severity level={alert.severity} />
                  {alert.surfaced_by_feedback && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded border
                      border-accent-line px-1.5 py-px text-[10px] text-accent">
                      <Sparkles size={9} /> your training
                    </span>
                  )}
                  <span className="truncate text-meta text-ink-faint">{alert.description}</span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Mono className="text-[11px]">{relative(alert.timestamp)}</Mono>
                  {verdict ? (
                    <span className={`font-mono text-[11px] ${
                      verdict === 'confirm' ? 'text-good' : 'text-ink-faint'}`}>
                      {verdict === 'confirm' ? 'confirmed' : 'dismissed'}
                    </span>
                  ) : (
                    <>
                      <Button variant="good" size="sm" onClick={(e) => submit(alert, 'confirm', e)}
                        title="Genuine attack — teach the detector to catch this">
                        <Check size={12} /> Real
                      </Button>
                      <Button variant="quiet" size="sm" onClick={(e) => submit(alert, 'dismiss', e)}
                        title="False alarm — teach the detector to stop">
                        <X size={12} /> False
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-line px-3.5 py-3 rise">
                  <DataRow label="alert">{alert.id}</DataRow>
                  <DataRow label="model score">
                    {alert.anomaly_score}
                    {alert.base_score !== alert.anomaly_score && ` (frozen model: ${alert.base_score})`}
                  </DataRow>
                  <DataRow label="source">{alert.source_ip}</DataRow>
                  <DataRow label="destination">{alert.dest_ip}</DataRow>
                  <DataRow label="site">{alert.location}</DataRow>
                  {alert.mitre_id && <DataRow label="technique">{alert.mitre_id}</DataRow>}
                  <p className="mt-2 text-meta leading-relaxed text-ink-faint">
                    {alert.description}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
