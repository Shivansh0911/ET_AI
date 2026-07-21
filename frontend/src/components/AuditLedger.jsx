import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Link2, FlaskConical } from 'lucide-react'
import { api } from '../utils/api'

function IntegrityBadge({ verification }) {
  if (!verification) return null
  const intact = verification.intact
  const Icon = intact ? ShieldCheck : ShieldAlert
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
      intact
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/10 text-red-400 border-red-500/30'
    }`}>
      <Icon size={16} />
      {intact
        ? `Chain intact — ${verification.entries} entries`
        : `Chain broken at entry ${verification.broken_at}`}
    </span>
  )
}

export default function AuditLedger() {
  const [audit, setAudit] = useState(null)
  const [tamper, setTamper] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.getAudit().then(setAudit).catch(() => setError('Unable to load the audit ledger.'))

  useEffect(() => { load() }, [])

  const handleTamper = async () => {
    setBusy(true)
    try {
      setTamper(await api.simulateTamper())
    } catch {
      setError('Tamper simulation failed.')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>
  if (!audit) return <div className="text-gray-500 p-8 text-center">Loading audit chain...</div>

  const entries = [...(audit.entries || [])].reverse()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Audit Ledger</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Every automated action, sealed with the SHA-256 of the entry before it. Altering any
            record breaks every hash that follows, which is what makes this auditable rather than
            merely logged.
          </p>
        </div>
        <IntegrityBadge verification={tamper ? tamper.verification_before : audit.verification} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Actions recorded', audit.stats.total_actions],
          ['Executed autonomously', audit.stats.executed_autonomously],
          ['Held for a human', audit.stats.held_for_human_approval],
          ['Chain head', (audit.verification.head || '').slice(0, 10) || '—'],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
            <div className="text-lg font-bold mono text-gray-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-400">Tamper detection</h3>
          <button
            onClick={handleTamper}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300 hover:border-red-500/50 transition disabled:opacity-50"
          >
            <FlaskConical size={13} />
            {busy ? 'Running...' : 'Simulate tampering'}
          </button>
        </div>
        {!tamper && (
          <p className="text-xs text-gray-500 leading-relaxed">
            Runs verification against a modified copy of the chain. The live ledger is never touched.
          </p>
        )}
        {tamper && tamper.available === false && (
          <p className="text-xs text-gray-500">{tamper.reason}</p>
        )}
        {tamper?.available !== false && tamper && (
          <div className="space-y-2 text-xs">
            <p className="text-gray-400">
              Entry <span className="mono text-gray-200">#{tamper.altered_entry}</span> had its{' '}
              <span className="mono text-gray-200">{tamper.field}</span> changed from{' '}
              <span className="mono text-gray-200">{tamper.from}</span> to{' '}
              <span className="mono text-red-400">{tamper.to}</span> on a copy.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <IntegrityBadge verification={tamper.verification_before} />
              <span className="text-gray-600">→</span>
              <IntegrityBadge verification={tamper.verification_after} />
            </div>
            <p className="text-gray-500">{tamper.verification_after.reason}</p>
          </div>
        )}
      </div>

      <div className="bg-card border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Chain — newest first</h3>
        {entries.length === 0 ? (
          <p className="text-xs text-gray-500">
            No actions recorded yet. Generate a playbook on the Response tab to populate the chain.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left font-medium py-1.5">#</th>
                  <th className="text-left font-medium">Action</th>
                  <th className="text-left font-medium">Target</th>
                  <th className="text-left font-medium">Result</th>
                  <th className="text-right font-medium">Blast</th>
                  <th className="text-left font-medium pl-3">Hash</th>
                </tr>
              </thead>
              <tbody className="mono">
                {entries.map((e) => (
                  <tr key={e.seq} className="border-b border-gray-900">
                    <td className="py-1.5 text-gray-600">{e.seq}</td>
                    <td className="text-gray-300">{e.action}</td>
                    <td className="text-gray-500">{e.target}</td>
                    <td className={e.result === 'executed' ? 'text-emerald-400' : 'text-amber-400'}>
                      {e.result}
                    </td>
                    <td className="text-right text-gray-500">{e.blast_radius}</td>
                    <td className="pl-3 text-gray-600 flex items-center gap-1">
                      <Link2 size={10} className="text-gray-700" />
                      {e.hash.slice(0, 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">{audit.stats.persistence_caveat}</p>
      </div>
    </div>
  )
}
