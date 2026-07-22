import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Stat, StatStrip, Loading, Failed, Empty, Note, Severity, Mono, DataRow } from './ui'

// Real CVEs and CVSS from NVD, ranked by a formula shown in full on the page. The ranking is
// dynamic — the activity term comes from live detections — so re-pulling the window re-orders
// the queue, which is the "cannot patch everything at once" story the statement asks for.

function priorityTone(p) {
  if (p >= 150) return 'bad'
  if (p >= 100) return 'default'
  return 'muted'
}

export default function Remediation() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    api.getRemediation().then(setData).catch(() => setError('The remediation queue did not load.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Ranking vulnerabilities</Loading>
  if (!data.available) return <Empty title="No CVE data">{data.reason}</Empty>

  const queue = data.queue
  const critical = queue.filter((q) => q.severity === 'CRITICAL').length
  const top = queue[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Remediation queue</h1>
        <p className="mt-1 max-w-3xl text-meta leading-relaxed text-ink-faint">
          Government teams cannot patch everything at once. This ranks real CVEs by severity,
          how exposed each asset is, and how much attack activity it is seeing right now.
        </p>
      </div>

      <StatStrip>
        <Card>
          <Stat label="Patch first" value={top?.cve} size="tabular" tone="bad"
            note={`${top?.asset} · priority ${top?.priority}`} />
        </Card>
        <Card>
          <Stat label="Critical CVEs" value={critical} tone="bad" size="tabular"
            note={`of ${queue.length} tracked exposures`} />
        </Card>
        <Card>
          <Stat label="CVEs tracked" value={data.counts.cves_tracked} size="tabular"
            note="real NVD entries" />
        </Card>
        <Card>
          <Stat label="Assets" value={data.counts.assets} size="tabular" note="mapped to software" />
        </Card>
      </StatStrip>

      <Card title="How the queue is ranked" tint="neutral">
        <div className="rounded-lg border border-line bg-surface-0 px-4 py-3">
          <Mono className="text-body text-ink">{data.formula}</Mono>
        </div>
        <div className="mt-3">
          {Object.entries(data.formula_explained).map(([term, meaning]) => (
            <DataRow key={term} label={term}>{meaning}</DataRow>
          ))}
        </div>
      </Card>

      <Card title="Ranked exposures" hint="Highest priority first. Click a row for the CVE detail and the score breakdown.">
        <div className="space-y-1.5">
          {queue.map((item) => {
            const isOpen = open === `${item.cve}-${item.asset}`
            return (
              <div key={`${item.cve}-${item.asset}`}
                className={`rounded-lg border transition-colors ${
                  isOpen ? 'border-line-strong bg-surface-2' : 'border-line bg-surface-2 hover:border-line-strong'}`}>
                <button onClick={() => setOpen(isOpen ? null : `${item.cve}-${item.asset}`)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-meta text-ink-faint">#{item.rank}</span>
                    <Mono className="text-body text-ink">{item.cve}</Mono>
                    <Severity level={(item.severity || 'info').toLowerCase()} />
                    <span className="truncate text-meta text-ink-muted">{item.asset} · {item.service}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.observed_detections > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-bad">
                        <ShieldAlert size={11} /> {item.observed_detections} active
                      </span>
                    )}
                    <span className={`tabular font-mono text-body ${
                      priorityTone(item.priority) === 'bad' ? 'text-bad' : 'text-ink'}`}>
                      {item.priority}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-line px-3.5 py-3 rise">
                    <p className="text-meta leading-relaxed text-ink-muted">{item.description}</p>
                    <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                      <DataRow label="CVSS base">{item.cvss} ({item.severity})</DataRow>
                      <DataRow label="published">{item.published}</DataRow>
                      <DataRow label="CVSS ÷ 10">{item.components.cvss_normalised}</DataRow>
                      <DataRow label="× exposure">{item.components.exposure}</DataRow>
                      <DataRow label="× activity">{item.components.activity_multiplier}</DataRow>
                      <DataRow label="= priority" tone="bad">{item.priority}</DataRow>
                    </div>
                    {item.vector && <Mono className="block text-[11px] text-ink-faint">{item.vector}</Mono>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="What is real, what is illustrative">
        <DataRow label="real">{data.provenance.real}</DataRow>
        <div className="mt-2"><Note>{data.provenance.illustrative}</Note></div>
        <div className="mt-2"><Note>Source: {data.source} · retrieved {data.retrieved}</Note></div>
      </Card>
    </div>
  )
}
