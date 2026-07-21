import { useState } from 'react'
import { Play, Check, PauseCircle, Clock } from 'lucide-react'
import { api } from '../utils/api'
import { Panel, Button, Figure, Severity, Failed, Empty, Row } from './ui'

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
          <h1 className="text-[15px] font-semibold text-content">Response</h1>
          <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-content-faint">
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
        <Empty>No playbook yet. Draft one to populate the audit chain.</Empty>
      )}

      {playbook && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title={playbook.playbook_name}
            subtitle={playbook.note}
            actions={<Severity level={playbook.severity} />}
            className="lg:col-span-2"
          >
            <ol className="space-y-2">
              {(playbook.steps || []).map((step, i) => {
                const ran = executed.find((e) => e.step === step)
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`mono mt-px text-[11px] ${
                      ran ? (ran.status === 'executed' ? 'text-good' : 'text-severity-medium')
                          : 'text-content-faint'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-content-muted">{step}</p>
                      {ran && (
                        <p className="mono mt-0.5 text-[11px] text-content-faint">
                          {ran.action} · blast {ran.blast_radius} · ledger #{ran.ledger_seq}
                          {ran.status !== 'executed' && (
                            <span className="text-severity-medium"> · held for approval</span>
                          )}
                        </p>
                      )}
                      {!ran && (
                        <p className="mt-0.5 text-[11px] text-content-faint">
                          no automated form — analyst work
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </Panel>

          <div className="space-y-4">
            {coverage && (
              <Panel title="Automation coverage">
                <Figure label="Executed autonomously" value={`${coverage.coverage_pct}%`} size="lg" />
                <div className="mt-3">
                  <Row label="playbook steps">{coverage.playbook_steps}</Row>
                  <Row label="ran autonomously">
                    <span className="text-good">{coverage.executed_autonomously}</span>
                  </Row>
                  <Row label="held for a human">
                    <span className="text-severity-medium">{coverage.held_for_human_approval}</span>
                  </Row>
                  <Row label="no automated form">{coverage.manual_only}</Row>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-content-faint">
                  {coverage.definition}
                </p>
              </Panel>
            )}

            <Panel title="Actions taken">
              <div className="space-y-2">
                {executed.map((action) => {
                  const held = action.status !== 'executed'
                  const Icon = held ? PauseCircle : Check
                  return (
                    <div key={action.ledger_seq} className="flex items-start gap-2">
                      <Icon size={13} className={held ? 'mt-0.5 text-severity-medium' : 'mt-0.5 text-good'} />
                      <div className="min-w-0">
                        <div className="mono text-[12px] text-content">{action.action}</div>
                        <div className="text-[11px] text-content-faint">{action.description}</div>
                        {held && (
                          <div className="text-[11px] text-severity-medium">{action.gate}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-1.5 border-t border-ink-800 pt-2
                text-[12px] text-content-faint">
                <Clock size={12} /> estimated containment{' '}
                <span className="mono text-content-muted">{playbook.estimated_containment_time}</span>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
