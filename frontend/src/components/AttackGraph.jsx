import { useEffect, useMemo, useState } from 'react'
import { Crosshair, Route as RouteIcon } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Loading, Failed, Empty, Note, Stat, StatStrip, Mono, INK, severityHex } from './ui'

// A layered (Sankey-ish) layout rather than force-directed: the graph is inherently three
// columns — sources on the left, assets in the middle, techniques on the right — so a
// deterministic column layout reads far more clearly than a physics simulation that would
// jitter on every render and never settle into that structure anyway.

const COLUMN = { source: 0, asset: 1, technique: 2 }
const WIDTH = 720
const HEIGHT = 460
const PAD_Y = 28

function layout(nodes) {
  const columns = { source: [], asset: [], technique: [] }
  for (const n of nodes) columns[n.kind]?.push(n)
  const x = { source: 90, asset: WIDTH / 2, technique: WIDTH - 90 }
  const placed = {}
  for (const kind of Object.keys(columns)) {
    const col = columns[kind].sort((a, b) => b.weight - a.weight)
    const gap = (HEIGHT - PAD_Y * 2) / Math.max(col.length, 1)
    col.forEach((n, i) => {
      placed[n.id] = { ...n, x: x[kind], y: PAD_Y + gap * (i + 0.5), col: COLUMN[kind] }
    })
  }
  return placed
}

export default function AttackGraph() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    api.getGraph().then(setData).catch(() => setError('The attack graph did not load.'))
  }, [])

  const placed = useMemo(() => (data ? layout(data.nodes) : {}), [data])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Assembling the attack graph</Loading>
  if (!data.nodes.length) return <Empty title="Nothing to graph">No detections in this window.</Empty>

  const pathIds = new Set(data.longest_path.map((n) => n.id))
  const activeId = hover
  const neighbours = new Set()
  if (activeId) {
    for (const e of data.edges) {
      if (e.source === activeId) neighbours.add(e.target)
      if (e.target === activeId) neighbours.add(e.source)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Attack graph</h1>
        <p className="mt-1 max-w-3xl text-meta leading-relaxed text-ink-faint">{data.method}</p>
      </div>

      <StatStrip>
        <Card>
          <Stat label="Threat sources" value={data.counts.sources} size="tabular" note="external" />
        </Card>
        <Card>
          <Stat label="Assets targeted" value={data.counts.assets} size="tabular" />
        </Card>
        <Card>
          <Stat label="Convergence pivots" value={data.pivots.length} tone="bad" size="tabular"
            note="sources meet techniques" />
        </Card>
        <Card>
          <Stat label="Longest path" value={`${Math.max(data.longest_path.length - 1, 0)} hops`}
            size="tabular" note="source → asset → technique" />
        </Card>
      </StatStrip>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Observed topology"
          hint="Sources on the left, assets in the middle, techniques on the right. Hover a node to isolate its edges."
          className="xl:col-span-2">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ minWidth: 560 }}>
              {/* column labels */}
              {[['Threat sources', 90], ['Targeted assets', WIDTH / 2], ['Techniques', WIDTH - 90]].map(
                ([label, x]) => (
                  <text key={label} x={x} y={14} textAnchor="middle"
                    style={{ fill: INK.faint, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                    {label}
                  </text>
                )
              )}

              {/* edges */}
              {data.edges.map((e, i) => {
                const a = placed[e.source]
                const b = placed[e.target]
                if (!a || !b) return null
                const onPath = pathIds.has(e.source) && pathIds.has(e.target)
                const dimmed = activeId && e.source !== activeId && e.target !== activeId
                const midX = (a.x + b.x) / 2
                return (
                  <path key={i}
                    d={`M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`}
                    fill="none"
                    stroke={onPath ? severityHex('critical') : severityHex(e.severity)}
                    strokeWidth={onPath ? 2.4 : Math.min(0.6 + e.count * 0.25, 3)}
                    strokeOpacity={dimmed ? 0.06 : onPath ? 0.9 : 0.28} />
                )
              })}

              {/* nodes */}
              {Object.values(placed).map((n) => {
                const r = n.kind === 'asset' ? 9 : 6
                const dimmed = activeId && n.id !== activeId && !neighbours.has(n.id)
                const onPath = pathIds.has(n.id)
                return (
                  <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                    style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}>
                    <circle cx={n.x} cy={n.y} r={r + (onPath ? 3 : 0)}
                      fill={severityHex(n.severity)}
                      stroke={onPath ? INK.primary : INK.onFill} strokeWidth={onPath ? 1.5 : 1} />
                    <text x={n.col === 2 ? n.x + r + 4 : n.col === 0 ? n.x - r - 4 : n.x}
                      y={n.col === 1 ? n.y - r - 4 : n.y + 3}
                      textAnchor={n.col === 2 ? 'start' : n.col === 0 ? 'end' : 'middle'}
                      style={{ fill: INK.muted, fontSize: 10, fontFamily: n.kind === 'technique'
                        ? 'JetBrains Mono, monospace' : 'Inter, sans-serif' }}>
                      {n.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <Note>{data.caveat}</Note>
        </Card>

        <div className="space-y-4">
          <Card title="Longest attack path" aside={<RouteIcon size={14} className="text-ink-faint" />}>
            {data.longest_path.length ? (
              <ol className="space-y-1.5">
                {data.longest_path.map((n, i) => (
                  <li key={n.id} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-faint">{i + 1}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: severityHex('high') }} />
                    <span className={n.kind === 'technique' ? 'font-mono text-meta text-ink' : 'text-meta text-ink'}>
                      {n.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-ink-faint">{n.kind}</span>
                  </li>
                ))}
              </ol>
            ) : <Empty title="No multi-hop path">Single-hop detections only.</Empty>}
          </Card>

          <Card title="Convergence pivots"
            aside={<Crosshair size={14} className="text-bad" />}
            hint="Assets where several sources meet host-level technique activity.">
            {data.pivots.length ? (
              <div className="space-y-2">
                {data.pivots.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border
                    border-line bg-surface-2 px-3 py-2">
                    <span className="text-body text-ink">{p.label}</span>
                    <Mono className="text-[11px]">
                      {p.converging_sources} sources · {p.techniques} techniques
                    </Mono>
                  </div>
                ))}
              </div>
            ) : <Empty title="No pivots">No asset has multiple sources converging on it.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  )
}
