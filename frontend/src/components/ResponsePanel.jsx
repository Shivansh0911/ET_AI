import { useState } from 'react'
import { PlayCircle, CheckCircle2, AlertTriangle, Clock, ShieldQuestion } from 'lucide-react'
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
              <h3 className="text-sm font-semibold text-gray-400 mb-1">Executed Actions</h3>
              <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">
                Each one recorded in the audit chain. Simulated — no production estate attached.
              </p>
              <ul className="space-y-2">
                {(playbook.execution?.executed || []).map((action, i) => {
                  const held = action.status !== 'executed'
                  const Icon = held ? ShieldQuestion : CheckCircle2
                  return (
                    <li key={i} className={`flex items-start gap-2 text-sm ${
                      held ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      <Icon size={14} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="mono">{action.action}</span>
                        <span className="text-gray-500"> · blast {action.blast_radius} · #{action.ledger_seq}</span>
                        {held && <div className="text-[11px] text-amber-500/80">held for approval — {action.gate}</div>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            {playbook.execution?.coverage && (
              <div className="bg-card border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Automation Coverage</h3>
                <div className="text-2xl font-bold mono text-emerald-400">
                  {playbook.execution.coverage.coverage_pct}%
                </div>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <div>{playbook.execution.coverage.executed_autonomously} executed autonomously</div>
                  <div>{playbook.execution.coverage.held_for_human_approval} held for a human</div>
                  <div>{playbook.execution.coverage.manual_only} with no automated form</div>
                </div>
                <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
                  {playbook.execution.coverage.definition}
                </p>
              </div>
            )}

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
              {playbook.note && (
                <p className="text-[11px] text-gray-600 leading-relaxed">{playbook.note}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
