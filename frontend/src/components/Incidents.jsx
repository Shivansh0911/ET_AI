import { useEffect, useState } from 'react'
import { GitMerge, Network, MonitorCheck, Cpu } from 'lucide-react'
import { api } from '../utils/api'
import { Card, Empty, Failed, Loading, Mono, Note, Provenance, Severity, Stat, StatStrip } from './ui'
import ThreatMap from './ThreatMap'

// Map and incident list share this screen, side by side at the top: a compound incident is a
// thing that happened somewhere, so the geography belongs next to the list rather than parked
// at the bottom of a different tab.

export default function Incidents() {
  const [data, setData] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    Promise.all([api.getIncidents(), api.getDashboard()])
      .then(([incidents, board]) => { setData(incidents); setDashboard(board) })
      .catch(() => setError('Incidents did not load. Check the backend is running.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Correlating the two sensor planes</Loading>

  const { incidents, summary, measured } = data
  const fusionOnly = incidents.filter((i) => i.fusion_only)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-ink">Incidents</h1>
        <p className="mt-1 max-w-3xl text-meta leading-relaxed text-ink-faint">{data.method}</p>
      </div>

      <StatStrip>
        <Card>
          <Stat label="Incidents this window" value={summary.incidents} />
        </Card>
        <Card>
          <Stat label="Neither sensor alone" value={summary.fusion_only_incidents} tone="accent"
            note="would have raised these" />
        </Card>
        <Card>
          <Stat label="Attacks recovered" value={summary.true_attacks_recovered} tone="good"
            note="below the alerting threshold" />
        </Card>
        <Card>
          <Stat label="IT + OT incidents" value={summary.it_ot_incidents ?? 0} tone="bad"
            note="span network and ICS" />
        </Card>
      </StatStrip>

      {/* Map on the side, at the top, next to the incidents it describes. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          {fusionOnly.length > 0 && (
            <Card
              title="Raised only by correlation"
              hint="Nothing here crossed the threshold on its own. Two quiet signals on the same asset did."
              tint="accent"
            >
              <div className="space-y-2">
                {fusionOnly.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} open={open} setOpen={setOpen} highlight />
                ))}
              </div>
            </Card>
          )}

          <Card title="All incidents" hint={`${incidents.length} in the current window.`}>
            {incidents.length === 0 ? (
              <Empty title="Nothing correlated">
                No asset had activity on both planes in the same window.
              </Empty>
            ) : (
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} open={open} setOpen={setOpen} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          {dashboard && (
            <ThreatMap
              locations={dashboard.location_threats}
              detections={dashboard.recent_anomalies}
            />
          )}

          {measured?.available && (
            <Card title={`Measured across ${measured.windows} windows`} aside={<Provenance kind="measured" />}>
              <p className="text-body leading-relaxed text-ink-muted">
                Over {measured.flows_evaluated.toLocaleString()} flows the detector alone missed{' '}
                <Mono className="text-ink">{measured.detector_alone.attacks_missed}</Mono> genuine
                attacks. Correlation recovered{' '}
                <Mono className="text-good">{measured.with_fusion.true_attacks_recovered}</Mono> of
                them, and wrongly promoted{' '}
                <Mono className="text-bad">{measured.with_fusion.benign_flows_promoted}</Mono> benign
                flows. Both halves of that trade are reported.
              </p>
            </Card>
          )}
        </div>
      </div>

      <Note>{data.host_plane.placement}</Note>
      {data.ot_plane?.note && <Note>{data.ot_plane.note}</Note>}
    </div>
  )
}

function IncidentCard({ incident, open, setOpen, highlight }) {
  const expanded = open === incident.id
  return (
    <div className={`rounded-lg border transition-colors ${
      highlight ? 'border-accent-line bg-surface-2' : 'border-line bg-surface-2 hover:border-line-strong'
    }`}>
      <button onClick={() => setOpen(expanded ? null : incident.id)} className="w-full px-3.5 py-3 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {incident.fusion_only && <GitMerge size={14} className="text-accent" />}
            <span className="text-body font-medium text-ink">{incident.asset}</span>
            <Mono className="text-meta">{incident.id}</Mono>
          </div>
          <div className="flex items-center gap-2">
            {incident.spans_it_ot && (
              <span className="inline-flex items-center gap-1 rounded border border-bad/40
                bg-bad/10 px-1.5 py-px text-[10px] font-medium text-bad">
                <Cpu size={10} /> IT + OT
              </span>
            )}
            {incident.techniques.map((t) => (
              <span key={t} className="font-mono rounded border border-line-strong px-1.5 py-px
                text-[10px] text-ink-faint">{t}</span>
            ))}
            <Severity level={incident.severity} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-meta text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Network size={12} /> {incident.network_signals} network
            {incident.weak_network_signals > 0 && ` (${incident.weak_network_signals} sub-threshold)`}
          </span>
          {incident.host_signals > 0 && (
            <span className="flex items-center gap-1.5">
              <MonitorCheck size={12} /> {incident.host_signals} host
            </span>
          )}
          {incident.ot_signals > 0 && (
            <span className="flex items-center gap-1.5 text-bad">
              <Cpu size={12} /> {incident.ot_signals} OT
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-line px-3.5 py-3 rise">
          {incident.it_ot_rationale && (
            <p className="rounded-lg border border-bad/25 bg-bad/[0.06] px-3 py-2 text-meta
              leading-relaxed text-ink-muted">
              <Cpu size={12} className="mr-1 inline text-bad" />{incident.it_ot_rationale}
            </p>
          )}
          <p className="text-meta leading-relaxed text-ink-muted">{incident.rationale}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-label uppercase text-ink-faint">Network evidence</div>
              {incident.evidence.network.map((e) => (
                <div key={e.id} className="font-mono text-meta text-ink-muted">
                  {e.id} · {e.score} · {e.family}
                </div>
              ))}
            </div>
            {incident.evidence.host.length > 0 && (
              <div>
                <div className="mb-1 text-label uppercase text-ink-faint">Host evidence</div>
                {incident.evidence.host.map((h) => (
                  <div key={h.id} className="font-mono text-meta text-ink-muted">
                    {h.technique} · {h.confidence} · {h.title}
                  </div>
                ))}
              </div>
            )}
            {incident.evidence.ot?.length > 0 && (
              <div>
                <div className="mb-1 text-label uppercase text-bad">OT evidence (simulated)</div>
                {incident.evidence.ot.map((o) => (
                  <div key={o.id} className="font-mono text-meta text-ink-muted">
                    {o.device} · {o.function_code} · {o.kind}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
