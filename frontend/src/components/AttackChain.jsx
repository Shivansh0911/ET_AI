import { useEffect, useMemo, useState } from 'react'
import { Check, Circle, Sparkles, ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Severity, Answer, Loading, Failed, Mono, DataRow, SectionTitle, Provenance, severityHex } from './ui'

// The full ATT&CK progression is always drawn, not just the stages that fired. A chain with four
// boxes tells you what was seen; a chain with fourteen positions tells you where in the attack
// you are and how much runway is left — which is the question an analyst is actually asking.
const TACTIC_ORDER = [
  'Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 'Persistence',
  'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery',
  'Lateral Movement', 'Collection', 'Command And Control', 'Exfiltration', 'Impact',
]

const SHORT = {
  'Reconnaissance': 'Recon', 'Resource Development': 'Resource Dev', 'Initial Access': 'Initial Access',
  'Privilege Escalation': 'Priv Esc', 'Defense Evasion': 'Evasion', 'Credential Access': 'Cred Access',
  'Lateral Movement': 'Lateral', 'Command And Control': 'C2', 'Exfiltration': 'Exfil',
}

export default function AttackChain() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    api.getKillChain().then(setData).catch(() => setError('The kill chain did not load.'))
  }, [])

  const stages = useMemo(() => {
    if (!data) return []
    const observed = new Map((data.kill_chain || []).map((s) => [s.tactic, s]))
    const lastSeen = TACTIC_ORDER.reduce((acc, t, i) => (observed.has(t) ? i : acc), -1)

    return TACTIC_ORDER.map((tactic, index) => {
      const stage = observed.get(tactic)
      return {
        tactic,
        short: SHORT[tactic] || tactic,
        stage,
        state: stage
          ? (index === lastSeen ? 'active' : 'observed')
          : (index > lastSeen ? 'ahead' : 'skipped'),
      }
    })
  }, [data])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Reconstructing the chain</Loading>

  const observedCount = (data.kill_chain || []).length
  const furthest = stages.filter((s) => s.stage).pop()

  return (
    <div className="space-y-4">
      <SectionTitle hint={`Every stage of the ATT&CK progression, drawn whether or not it fired. ${data.attack_table.technique_count.toLocaleString()} techniques from the official MITRE bundle; each stage anchors on its earliest detection so the sequence reads forward in time.`}>
        Attack progression
      </SectionTitle>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-label uppercase text-ink-faint">Stages reached</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-figure font-semibold text-ink">{observedCount}</span>
            <span className="text-meta text-ink-faint">of {TACTIC_ORDER.length}</span>
          </div>
        </Card>
        <Card>
          <div className="text-label uppercase text-ink-faint">Furthest stage</div>
          <div className="mt-1 text-title font-semibold text-ink">
            {furthest ? furthest.tactic : 'None observed'}
          </div>
        </Card>
        <Card>
          <div className="text-label uppercase text-ink-faint">Techniques seen</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(data.kill_chain || []).map((s) => (
              <Mono key={s.technique_id} className="rounded border border-line px-1.5 py-px text-[11px]">
                {s.technique_id}
              </Mono>
            ))}
            {observedCount === 0 && <span className="text-meta text-ink-faint">—</span>}
          </div>
        </Card>
      </div>

      <Card bare>
        <div className="overflow-x-auto px-5 py-5">
          <div className="flex min-w-max items-start gap-1">
            {stages.map((s, i) => {
              const isOpen = open === s.tactic
              const clickable = Boolean(s.stage)
              const colour = s.stage ? severityHex(s.stage.severity) : '#2f3a4c'

              return (
                <div key={s.tactic} className="flex items-start">
                  <button
                    disabled={!clickable}
                    onClick={() => setOpen(isOpen ? null : s.tactic)}
                    className={`w-[124px] rounded-lg border px-3 py-3 text-left transition-colors ${
                      isOpen ? 'border-accent-line bg-accent-soft'
                        : s.state === 'active' ? 'border-line-strong bg-surface-2'
                        : s.stage ? 'border-line bg-surface-2 hover:border-line-strong'
                        : 'border-dashed border-line bg-transparent'
                    } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {s.stage ? (
                        s.state === 'active'
                          ? <span className="breathe h-2 w-2 rounded-full" style={{ background: colour }} />
                          : <Check size={11} style={{ color: colour }} />
                      ) : (
                        <Circle size={9} className="text-line-strong" />
                      )}
                      <span className={`text-[11px] font-medium tracking-wide ${
                        s.stage ? 'text-ink' : 'text-ink-faint'}`}>
                        {s.short}
                      </span>
                    </div>

                    {s.stage ? (
                      <>
                        <div className="mt-1.5 line-clamp-2 text-meta leading-snug text-ink-muted">
                          {s.stage.technique_name}
                        </div>
                        <Mono className="mt-1 block text-[10px]">{s.stage.technique_id}</Mono>
                        <div className="mt-1.5">
                          <Severity level={s.stage.severity} dot />
                        </div>
                      </>
                    ) : (
                      <div className="mt-1.5 text-meta text-ink-faint">
                        {s.state === 'ahead' ? 'not yet observed' : 'not observed'}
                      </div>
                    )}
                  </button>

                  {i < stages.length - 1 && (
                    <ChevronRight size={14} className="mt-6 shrink-0 text-line-strong" />
                  )}
                </div>
              )
            })}

            <div className="ml-2 flex items-start">
              <div className="w-[150px] rounded-lg border border-dashed border-accent-line
                bg-accent-soft px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-accent" />
                  <span className="text-[11px] font-medium tracking-wide text-accent">Predicted</span>
                </div>
                <div className="mt-1.5 text-meta leading-snug text-ink-muted">
                  Model projection of the next move — not an observation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {open && (
        <Card title={stages.find((s) => s.tactic === open)?.stage?.technique_name} className="rise"
          aside={<Severity level={stages.find((s) => s.tactic === open)?.stage?.severity} />}>
          {(() => {
            const stage = stages.find((s) => s.tactic === open)?.stage
            return (
              <>
                <p className="text-body text-ink-muted">{stage.event}</p>
                <div className="mt-3">
                  <DataRow label="tactic">{stage.tactic}</DataRow>
                  <DataRow label="technique">{stage.technique_id}</DataRow>
                  <DataRow label="asset">{stage.asset}</DataRow>
                  <DataRow label="detections">{stage.detections}</DataRow>
                  <DataRow label="peak score">{stage.max_score}</DataRow>
                  <DataRow label="first seen">{stage.first_seen}</DataRow>
                  <DataRow label="last seen">{stage.last_seen}</DataRow>
                </div>
              </>
            )
          })()}
        </Card>
      )}

      <Card
        title="Where this is heading"
        hint="Generated by the language model from the stages above. A projection, not a measurement."
        aside={<Provenance kind="illustrative" />}
      >
        <Answer>{data.next_move_prediction}</Answer>
      </Card>
    </div>
  )
}
