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
          <h1 className="text-title font-semibold text-ink">Audit</h1>
          <p className="mt-0.5 max-w-2xl text-meta leading-relaxed text-ink-faint">
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
          <div key={label} className="rounded-card border border-line bg-surface-1 p-4">
            <div className="text-label uppercase text-ink-faint">{label}</div>
            <div className="tabular mt-0.5 text-tabular font-semibold text-ink">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-line bg-surface-1 p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-title font-semibold text-ink">Tamper detection</h3>
          <button
            onClick={handleTamper}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-meta text-ink-muted transition-colors hover:border-bad/40 hover:text-ink disabled:opacity-40"
          >
            <FlaskConical size={13} />
            {busy ? 'Running...' : 'Simulate tampering'}
          </button>
        </div>
        {!tamper && (
          <p className="text-meta leading-relaxed text-ink-faint">
            Runs verification against a modified copy of the chain. The live ledger is never touched.
          </p>
        )}
        {tamper && tamper.available === false && (
          <p className="text-meta text-ink-faint">{tamper.reason}</p>
        )}
        {tamper?.available !== false && tamper && (
          <div className="space-y-2 text-[12px]">
            <p className="text-ink-muted">
              Entry <span className="font-mono tabular text-ink">#{tamper.altered_entry}</span> had its{' '}
              <span className="font-mono tabular text-ink">{tamper.field}</span> changed from{' '}
              <span className="font-mono tabular text-ink">{tamper.from}</span> to{' '}
              <span className="font-mono tabular text-bad">{tamper.to}</span> on a copy.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <IntegrityBadge verification={tamper.verification_before} />
              <span className="text-ink-faint">→</span>
              <IntegrityBadge verification={tamper.verification_after} />
            </div>
            <p className="text-ink-faint">{tamper.verification_after.reason}</p>
          </div>
        )}
      </div>

      <div className="rounded-card border border-line bg-surface-1 p-5">
        <h3 className="mb-3 text-title font-semibold text-ink">Chain — newest first</h3>
        {entries.length === 0 ? (
          <p className="text-meta text-ink-faint">
            No actions recorded yet. Generate a playbook on the Response tab to populate the chain.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line text-ink-faint">
                  <th className="text-left font-medium py-1.5">#</th>
                  <th className="text-left font-medium">Action</th>
                  <th className="text-left font-medium">Target</th>
                  <th className="text-left font-medium">Result</th>
                  <th className="text-right font-medium">Blast</th>
                  <th className="text-left font-medium pl-3">Hash</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular">
                {entries.map((e) => (
                  <tr key={e.seq} className="border-b border-line/60">
                    <td className="py-1.5 text-ink-faint">{e.seq}</td>
                    <td className="text-ink-muted">{e.action}</td>
                    <td className="text-ink-faint">{e.target}</td>
                    <td className={e.result === 'executed' ? 'text-good' : 'text-severity-medium'}>
                      {e.result}
                    </td>
                    <td className="text-right text-ink-faint">{e.blast_radius}</td>
                    <td className="flex items-center gap-1 pl-3 text-ink-faint">
                      <Link2 size={10} className="text-line-strong" />
                      {e.hash.slice(0, 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-meta leading-relaxed text-ink-faint">
          {audit.stats.persistence_note || audit.stats.persistence_caveat}
          {audit.stats.durable && ' Stored in SQLite — survives a restart.'}
        </p>
      </div>
    </div>
  )
}
