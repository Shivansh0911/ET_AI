import { useState } from 'react'
import { Check, X, Sparkles } from 'lucide-react'
import { api } from '../utils/api'
import { Severity, Button, Panel } from './ui'

// The triage queue is where the learning loop is actually driven. Confirming or dismissing an
// alert sends a labelled example to the detector; after enough verdicts the adaptive layer
// fits and the numbers on screen move. This is the demo.

function relative(timestamp) {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

export default function TriageQueue({ alerts, onVerdict, emptyNote }) {
  const [pending, setPending] = useState({})
  const [done, setDone] = useState({})

  const submit = async (alert, verdict) => {
    setPending((p) => ({ ...p, [alert.id]: verdict }))
    try {
      const result = await api.sendFeedback(alert.id, verdict)
      setDone((d) => ({ ...d, [alert.id]: verdict }))
      onVerdict?.(result)
    } catch {
      setPending((p) => ({ ...p, [alert.id]: undefined }))
    }
  }

  if (!alerts?.length) {
    return (
      <Panel title="Triage queue">
        <div className="text-[13px] text-content-faint">
          {emptyNote || 'Nothing above threshold in this window.'}
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      title="Triage queue"
      subtitle="Your verdict becomes a training label. The detector refits every four verdicts."
    >
      <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
        {alerts.map((alert) => {
          const verdict = done[alert.id] || pending[alert.id]
          return (
            <div
              key={alert.id}
              className={`rounded-md border px-3 py-2.5 transition-colors ${
                verdict ? 'border-ink-800 bg-ink-950 opacity-60' : 'border-ink-700 bg-ink-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-content">{alert.asset}</span>
                    <span className="mono text-[11px] text-content-faint">{alert.id}</span>
                    {alert.surfaced_by_feedback && (
                      <span className="inline-flex items-center gap-1 rounded border
                        border-accent-line px-1.5 py-px text-[10px] text-accent">
                        <Sparkles size={9} /> from feedback
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-content-muted">
                    {alert.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Severity level={alert.severity} />
                    <span className="mono text-[11px] text-content-faint">
                      score {alert.anomaly_score}
                      {alert.base_score !== alert.anomaly_score && ` (base ${alert.base_score})`}
                    </span>
                    {alert.mitre_id && (
                      <span className="mono rounded border border-ink-600 px-1.5 py-px
                        text-[10px] text-content-faint">{alert.mitre_id}</span>
                    )}
                    <span className="text-[11px] text-content-faint">
                      {relative(alert.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {verdict ? (
                    <span className={`mono text-[11px] ${
                      verdict === 'confirm' ? 'text-good' : 'text-content-faint'}`}>
                      {verdict === 'confirm' ? 'confirmed' : 'dismissed'}
                    </span>
                  ) : (
                    <>
                      <Button variant="good" size="sm" onClick={() => submit(alert, 'confirm')}
                        title="Real attack — teach the model to catch this">
                        <Check size={12} /> Real
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => submit(alert, 'dismiss')}
                        title="False positive — teach the model to stop alerting">
                        <X size={12} /> False
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
