import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import { Panel, Severity, Answer, Loading, Failed, Empty, Row, Provenance } from './ui'

export default function AttackChain() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.getKillChain().then(setData).catch(() => setError('Could not load the kill chain.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Assembling the chain…</Loading>

  const chain = data.kill_chain || []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-content">Kill chain</h1>
        <p className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-content-faint">
          {data.attack_table.technique_count.toLocaleString()} techniques from the official
          MITRE STIX bundle. Each stage is anchored on its earliest detection, so the sequence
          reads forward in time rather than by whichever alert happened to arrive last.
        </p>
      </div>

      {chain.length === 0 ? (
        <Empty>Nothing in this window maps to a technique yet.</Empty>
      ) : (
        <Panel title="Observed progression">
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {chain.map((stage, i) => (
              <div key={stage.tactic} className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(selected?.tactic === stage.tactic ? null : stage)}
                  className={`min-w-[168px] rounded-md border p-3 text-left transition-colors ${
                    selected?.tactic === stage.tactic
                      ? 'border-accent-line bg-accent-soft'
                      : 'border-ink-700 bg-ink-800 hover:border-ink-600'
                  }`}
                >
                  <div className="text-label uppercase text-content-faint">{stage.tactic}</div>
                  <div className="mt-1 text-[13px] font-medium text-content">
                    {stage.technique_name}
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-content-faint">
                    {stage.technique_id} · {stage.detections} detection{stage.detections === 1 ? '' : 's'}
                  </div>
                  <div className="mt-2"><Severity level={stage.severity} /></div>
                </button>
                {i < chain.length - 1 && (
                  <ChevronRight className="shrink-0 text-ink-600" size={16} />
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {selected && (
        <Panel title={`${selected.technique_id} · ${selected.technique_name}`}>
          <p className="text-[13px] text-content-muted">{selected.event}</p>
          <div className="mt-2">
            <Row label="asset">{selected.asset}</Row>
            <Row label="detections">{selected.detections}</Row>
            <Row label="peak score">{selected.max_score}</Row>
            <Row label="first seen">{selected.first_seen}</Row>
            <Row label="last seen">{selected.last_seen}</Row>
          </div>
        </Panel>
      )}

      <Panel
        title="Projected next move"
        subtitle="Groq reasoning over the stages above. A projection, not a measurement."
        actions={<Provenance kind="illustrative" />}
      >
        <Answer>{data.next_move_prediction}</Answer>
      </Panel>
    </div>
  )
}
