import { useState } from 'react'
import { PlayCircle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { api } from '../utils/api'
import SeverityBadge from './SeverityBadge'

export default function ResponsePanel() {
  const [playbook, setPlaybook] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [checked, setChecked] = useState({})

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setChecked({})
    try {
      const res = await api.generatePlaybook('latest')
      setPlaybook(res)
    } catch (e) {
      setError('Unable to generate playbook — check backend/Groq API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Incident Response</h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/20 transition disabled:opacity-50"
        >
          <PlayCircle size={16} />
          {loading ? 'Generating...' : 'Generate Playbook'}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      {!playbook && !loading && (
        <div className="bg-card border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          Click "Generate Playbook" to produce an AI-drafted incident response plan for the latest alert.
        </div>
      )}

      {loading && (
        <div className="bg-card border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          Drafting response playbook...
        </div>
      )}

      {playbook && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-100">{playbook.playbook_name}</h3>
              <SeverityBadge severity={playbook.severity} />
            </div>
            <ul className="space-y-2">
              {(playbook.steps || []).map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                    className="mt-1 accent-emerald-500"
                  />
                  <span className={`text-sm ${checked[i] ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Automated Actions</h3>
              <ul className="space-y-2">
                {(playbook.automated_actions || []).map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-400">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock size={14} />
                Est. Containment: <span className="mono text-gray-200">{playbook.estimated_containment_time}</span>
              </div>
              {playbook.escalation_required && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle size={14} />
                  Escalation Required
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
