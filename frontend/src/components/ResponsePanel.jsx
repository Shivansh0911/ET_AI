import { useState } from 'react'
import { Play, Check, PauseCircle, Clock } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Button, Stat, Severity, Failed, Empty, DataRow } from './ui'

export default function ResponsePanel() {
  const [playbook, setPlaybook] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      setPlaybook(await api.generatePlaybook('latest'))
    } catch {
      setError('Could not draft a playbook. Check the backend and the Groq key.')
    } finally {
      setBusy(false)
    }
  }

  const coverage = playbook?.execution?.coverage
  const executed = playbook?.execution?.executed || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold text-ink">Response</h1>
          <p className="mt-0.5 max-w-2xl text-meta leading-relaxed text-ink-faint">
            The model drafts a playbook; the executor decides what can actually run, puts
            anything above the blast-radius threshold in front of a human, and seals every
            decision in the audit chain.
          </p>
        </div>
        <Button variant="primary" onClick={generate} disabled={busy}>
          <Play size={13} /> {busy ? 'Drafting…' : 'Draft and execute'}
        </Button>
      </div>

      {error && <Failed>{error}</Failed>}

      {!playbook && !busy && (
        <Empty title="Nothing drafted">Draft a playbook to populate the audit trail.</Empty>
      )}

      {playbook && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card
            title={playbook.playbook_name}
            hint={playbook.note}
            aside={<Severity level={playbook.severity} />}
            className="lg:col-span-2"
          >
            <ol className="space-y-2">
              {(playbook.steps || []).map((step, i) => {
                const ran = executed.find((e) => e.step === step)
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`font-mono mt-px text-[11px] ${
                      ran ? (ran.status === 'executed' ? 'text-good' : 'text-severity-medium')
                          : 'text-ink-faint'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body text-ink-muted">{step}</p>
                      {ran && (
                        <p className="font-mono tabular mt-0.5 text-meta text-ink-faint">
                          {ran.action} · blast {ran.blast_radius} · ledger #{ran.ledger_seq}
                          {ran.status !== 'executed' && (
                            <span className="text-severity-medium"> · held for approval</span>
                          )}
                        </p>
                      )}
                      {!ran && (
                        <p className="mt-0.5 text-meta text-ink-faint">
                          no automated form — analyst work
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>

          <div className="space-y-4">
            {coverage && (
              <Card title="Automation coverage">
                <Stat label="Executed autonomously" value={`${coverage.coverage_pct}%`} size="display" />
                <div className="mt-3">
                  <DataRow label="playbook steps">{coverage.playbook_steps}</DataRow>
                  <DataRow label="ran autonomously">
                    <span className="text-good">{coverage.executed_autonomously}</span>
                  </DataRow>
                  <DataRow label="held for a human">
                    <span className="text-severity-medium">{coverage.held_for_human_approval}</span>
                  </DataRow>
                  <DataRow label="no automated form">{coverage.manual_only}</DataRow>
                </div>
                <p className="mt-2 text-meta leading-relaxed text-ink-faint">
                  {coverage.definition}
                </p>
              </Card>
            )}

            <Card title="Actions taken">
              <div className="space-y-2">
                {executed.map((action) => {
                  const held = action.status !== 'executed'
                  const Icon = held ? PauseCircle : Check
                  return (
                    <div key={action.ledger_seq} className="flex items-start gap-2">
                      <Icon size={13} className={held ? 'mt-0.5 text-severity-medium' : 'mt-0.5 text-good'} />
                      <div className="min-w-0">
                        <div className="font-mono tabular text-[12px] text-ink">{action.action}</div>
                        <div className="text-meta text-ink-faint">{action.description}</div>
                        {held && (
                          <div className="text-[11px] text-severity-medium">{action.gate}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-1.5 border-t border-line/60 pt-2
                text-meta text-ink-faint">
                <Clock size={12} /> estimated containment{' '}
                <span className="font-mono tabular text-ink-muted">{playbook.estimated_containment_time}</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
