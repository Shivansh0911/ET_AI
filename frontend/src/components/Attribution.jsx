import { useEffect, useState } from 'react'
import { Users, Sparkles, ShieldCheck } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Stat, StatStrip, Loading, Failed, Empty, Note, Mono, Provenance } from './ui'

// Named-actor attribution over the ATT&CK knowledge graph. Deliberately framed as candidates
// with an overlap %, never a verdict — the caveat is on the page, not buried.

export default function Attribution() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getActor().then(setData).catch(() => setError('Attribution did not load.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Matching observed techniques to known actors</Loading>
  if (!data.available) return <Empty title="Knowledge graph unavailable">Run ml/trim_attack_graph.py.</Empty>

  const top = data.candidates[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Actor attribution</h1>
        <p className="mt-1 max-w-3xl text-meta leading-relaxed text-ink-faint">{data.method}</p>
      </div>

      <StatStrip>
        <Card>
          <Stat label="Top candidate" value={top?.group ?? '—'} size="tabular"
            note={top ? `${(top.coverage_of_observed * 100).toFixed(0)}% of observed TTPs` : undefined} />
        </Card>
        <Card>
          <Stat label="Candidates" value={data.candidates.length} size="tabular"
            note={`from ${data.group_count} known groups`} />
        </Card>
        <Card>
          <Stat label="Predicted next" value={data.predicted_next.length} tone="bad" size="tabular"
            note="techniques not yet seen" />
        </Card>
        <Card>
          <Stat label="Mitigations" value={data.mitigations.length} tone="good" size="tabular"
            note="for what is observed" />
        </Card>
      </StatStrip>

      <Card tint="warn" title="Read this first">
        <Note>{data.caveat}</Note>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Candidate actors"
          aside={<Users size={14} className="text-ink-faint" />}
          hint="Ranked by how much of what we're seeing each group is known to do.">
          <div className="space-y-2">
            {data.candidates.map((c) => (
              <div key={c.id} className="rounded-lg border border-line bg-surface-2 px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-medium text-ink">{c.group}</span>
                    <Mono className="text-[11px]">{c.id}</Mono>
                  </div>
                  <span className="tabular font-mono text-body text-ink">
                    {(c.coverage_of_observed * 100).toFixed(0)}%
                  </span>
                </div>
                {c.aliases.length > 0 && (
                  <div className="mt-0.5 text-[11px] text-ink-faint">aka {c.aliases.join(', ')}</div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.shared_techniques.map((t) => (
                    <span key={t} className="font-mono rounded border border-line-strong px-1.5 py-px
                      text-[10px] text-ink-faint">{t}</span>
                  ))}
                </div>
              </div>
            ))}
            {data.candidates.length === 0 && <Empty title="No overlap">No known group matches this window.</Empty>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Likely next moves"
            aside={<Sparkles size={14} className="text-accent" />}
            hint="Techniques the candidate actors also use, that we have not seen yet.">
            {data.predicted_next.length ? (
              <div className="space-y-1.5">
                {data.predicted_next.map((p) => (
                  <div key={p.technique} className="flex items-center justify-between rounded-lg
                    border border-dashed border-accent-line bg-accent-soft px-3 py-2">
                    <Mono className="text-body text-ink">{p.technique}</Mono>
                    <span className="text-[11px] text-ink-faint">
                      {p.supporting_candidates} of {data.candidates.length} candidates
                    </span>
                  </div>
                ))}
              </div>
            ) : <Empty title="No prediction">Not enough overlap to project.</Empty>}
            <Note>Predicted, not observed — a projection from the candidates' known playbooks.</Note>
          </Card>

          <Card title="Mitigations to apply now"
            aside={<ShieldCheck size={14} className="text-good" />}
            hint="From ATT&CK, for the techniques actually seen this window.">
            <div className="space-y-1.5">
              {data.mitigations.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border
                  border-line bg-surface-2 px-3 py-2">
                  <span className="text-meta text-ink">{m.name}</span>
                  <Mono className="text-[11px]">{m.id} · {m.addresses.length}×</Mono>
                </div>
              ))}
              {data.mitigations.length === 0 && <Empty title="None mapped">No ATT&CK mitigation for these techniques.</Empty>}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Source" aside={<Provenance kind="measured" />}>
        <Note>Graph traversal over {data.source}. Groups, technique→group and
          technique→mitigation edges are real MITRE ATT&CK data.</Note>
      </Card>
    </div>
  )
}
