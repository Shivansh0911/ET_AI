import { useCallback, useEffect, useState } from 'react'
import { Crosshair, ShieldCheck, Undo2 } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Stat, StatStrip, Button, Loading, Failed, Note, Mono, Provenance } from './ui'

// The digital twin. Pick where an attacker lands, see how far they spread, then harden the
// chokepoint and watch the blast radius collapse — the "impact of a security investment,
// without touching production" story, made interactive.

export default function Resilience() {
  const [entry, setEntry] = useState('CBSE-Digital')
  const [hardened, setHardened] = useState([])
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await api.getTwin(entry, hardened))
      setError(null)
    } catch {
      setError('The twin did not load.')
    }
  }, [entry, hardened])

  useEffect(() => { load() }, [load])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Simulating attack paths</Loading>

  const toggleHarden = (asset) => {
    setHardened((h) => (h.includes(asset) ? h.filter((a) => a !== asset) : [...h, asset]))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Resilience twin</h1>
        <p className="mt-1 max-w-3xl text-meta leading-relaxed text-ink-faint">{data.method}</p>
      </div>

      <StatStrip>
        <Card>
          <Stat label="Blast radius" value={data.blast_radius}
            tone={data.blast_radius > 3 ? 'bad' : data.blast_radius > 0 ? 'default' : 'good'}
            size="display" note={`of ${data.entry_points.length} assets reachable`} />
        </Card>
        <Card>
          <Stat label="Before hardening" value={data.baseline_blast_radius} tone="muted"
            size="tabular" note="from this entry point" />
        </Card>
        <Card>
          <Stat label="Reduction so far" value={data.reduction_from_hardening} tone="good"
            size="tabular" note={`${hardened.length} asset(s) hardened`} />
        </Card>
        <Card>
          <Stat label="Top chokepoint" value={data.chokepoint?.asset ?? '—'} size="tabular"
            tone="bad" note={data.chokepoint ? `-${data.chokepoint.reduction} if hardened` : undefined} />
        </Card>
      </StatStrip>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Where does the attacker land?"
          hint="Pick an entry point; the reachable assets update below."
          className="lg:col-span-1">
          <div className="space-y-1.5">
            {data.entry_points.map((asset) => (
              <button key={asset} onClick={() => { setEntry(asset); setHardened([]) }}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2
                  text-left text-body transition-colors ${
                    entry === asset ? 'border-accent-line bg-accent-soft text-accent'
                      : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink'}`}>
                {asset}
                {entry === asset && <Crosshair size={13} />}
              </button>
            ))}
          </div>
          {hardened.length > 0 && (
            <div className="mt-3">
              <Button size="sm" onClick={() => setHardened([])}>
                <Undo2 size={12} /> Reset hardening
              </Button>
            </div>
          )}
        </Card>

        <Card title={`Reachable from ${entry}`}
          hint="Harden an asset to segment it — watch the blast radius shrink."
          className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.entry_points.filter((a) => a !== entry).map((asset) => {
              const reached = data.reachable.find((r) => r.asset === asset)
              const isHardened = hardened.includes(asset)
              const isChoke = data.chokepoint?.asset === asset
              return (
                <button key={asset} onClick={() => toggleHarden(asset)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5
                    text-left transition-colors ${
                      isHardened ? 'border-good/40 bg-good/[0.07]'
                        : reached ? 'border-bad/30 bg-bad/[0.05] hover:border-bad/50'
                        : 'border-line bg-surface-2 hover:border-line-strong'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-body text-ink">{asset}</span>
                      {isChoke && !isHardened && (
                        <span className="rounded border border-bad/40 px-1 text-[9px] uppercase text-bad">choke</span>
                      )}
                    </div>
                    {reached && !isHardened && (
                      <Mono className="text-[10px] text-ink-faint">
                        reach {(reached.reach_probability * 100).toFixed(0)}% · {reached.hops} hop{reached.hops === 1 ? '' : 's'}
                      </Mono>
                    )}
                  </div>
                  {isHardened
                    ? <ShieldCheck size={15} className="shrink-0 text-good" />
                    : reached
                      ? <span className="shrink-0 text-[10px] font-medium uppercase text-bad">reachable</span>
                      : <span className="shrink-0 text-[10px] text-ink-faint">isolated</span>}
                </button>
              )
            })}
          </div>
          {data.chokepoint && data.chokepoint.reduction > 0 && !hardened.includes(data.chokepoint.asset) && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-accent-line
              bg-accent-soft px-3 py-2">
              <span className="text-meta text-ink">
                Hardening <span className="font-medium">{data.chokepoint.asset}</span> alone cuts the
                blast radius to {data.chokepoint.blast_after}.
              </span>
              <Button size="sm" variant="primary" onClick={() => toggleHarden(data.chokepoint.asset)}>
                Harden it
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card title="What is real, what is simulated" aside={<Provenance kind="measured" />}>
        <Note><span className="text-ink-muted">Real: </span>{data.provenance.real}</Note>
        <div className="mt-1.5"><Note><span className="text-ink-muted">Simulated: </span>{data.provenance.simulated}</Note></div>
      </Card>
    </div>
  )
}
