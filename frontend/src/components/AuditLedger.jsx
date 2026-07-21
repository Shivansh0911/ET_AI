import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Link2, FlaskConical } from 'lucide-react'
import { api } from '../utils/api'
import { Loading, Failed } from './ui'

function IntegrityBadge({ verification }) {
  if (!verification) return null
  const intact = verification.intact
  const Icon = intact ? ShieldCheck : ShieldAlert
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium ${
      intact ? 'border-good/30 bg-good/10 text-good' : 'border-bad/30 bg-bad/10 text-bad'
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

  if (error) return <Failed>{error}</Failed>
  if (!audit) return <Loading>Reading the chain…</Loading>

  const entries = [...(audit.entries || [])].reverse()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[15px] font-semibold text-content">Audit</h1>
          <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-content-faint">
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
          <div key={label} className="rounded-panel border border-ink-700 bg-ink-900 p-4">
            <div className="text-label uppercase text-content-faint">{label}</div>
            <div className="figure mt-0.5 text-[19px] font-semibold text-content">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-panel border border-ink-700 bg-ink-900 p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-[13px] font-semibold text-content">Tamper detection</h3>
          <button
            onClick={handleTamper}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 text-[12px] text-content-muted transition-colors hover:border-bad/40 hover:text-content disabled:opacity-40"
          >
            <FlaskConical size={13} />
            {busy ? 'Running...' : 'Simulate tampering'}
          </button>
        </div>
        {!tamper && (
          <p className="text-[12px] leading-relaxed text-content-faint">
            Runs verification against a modified copy of the chain. The live ledger is never touched.
          </p>
        )}
        {tamper && tamper.available === false && (
          <p className="text-[12px] text-content-faint">{tamper.reason}</p>
        )}
        {tamper?.available !== false && tamper && (
          <div className="space-y-2 text-[12px]">
            <p className="text-content-muted">
              Entry <span className="mono text-content">#{tamper.altered_entry}</span> had its{' '}
              <span className="mono text-content">{tamper.field}</span> changed from{' '}
              <span className="mono text-content">{tamper.from}</span> to{' '}
              <span className="mono text-bad">{tamper.to}</span> on a copy.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <IntegrityBadge verification={tamper.verification_before} />
              <span className="text-content-faint">→</span>
              <IntegrityBadge verification={tamper.verification_after} />
            </div>
            <p className="text-content-faint">{tamper.verification_after.reason}</p>
          </div>
        )}
      </div>

      <div className="rounded-panel border border-ink-700 bg-ink-900 p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-content">Chain — newest first</h3>
        {entries.length === 0 ? (
          <p className="text-[12px] text-content-faint">
            No actions recorded yet. Generate a playbook on the Response tab to populate the chain.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ink-700 text-content-faint">
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
                  <tr key={e.seq} className="border-b border-ink-800">
                    <td className="py-1.5 text-content-faint">{e.seq}</td>
                    <td className="text-content-muted">{e.action}</td>
                    <td className="text-content-faint">{e.target}</td>
                    <td className={e.result === 'executed' ? 'text-good' : 'text-severity-medium'}>
                      {e.result}
                    </td>
                    <td className="text-right text-content-faint">{e.blast_radius}</td>
                    <td className="flex items-center gap-1 pl-3 text-content-faint">
                      <Link2 size={10} className="text-ink-600" />
                      {e.hash.slice(0, 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-content-faint">{audit.stats.persistence_caveat}</p>
      </div>
    </div>
  )
}
