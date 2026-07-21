import { useEffect, useState } from 'react'
import { GitMerge, Network, MonitorCheck } from 'lucide-react'
import { api } from '../utils/api'
import { Severity, Provenance, Loading, Failed } from './ui'

export default function Incidents() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    api.getIncidents().then(setData).catch(() => setError('Unable to load incidents.'))
  }, [])

  if (error) return <Failed>{error}</Failed>
  if (!data) return <Loading>Correlating planes…</Loading>

  const { incidents, summary, measured } = data
  const fusionOnly = incidents.filter((i) => i.fusion_only)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-content">Incidents</h1>
        <p className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-content-faint">{data.method}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Incidents this window', summary.incidents],
          ['Fusion-only', summary.fusion_only_incidents],
          ['Attacks recovered', summary.true_attacks_recovered],
          ['Host captures', data.host_plane.captures],
        ].map(([label, value]) => (
          <div key={label} className="rounded-panel border border-ink-700 bg-ink-900 p-4">
            <div className="text-label uppercase text-content-faint">{label}</div>
            <div className="figure mt-0.5 text-[19px] font-semibold text-content">{value}</div>
          </div>
        ))}
      </div>

      {measured?.available && (
        <div className="rounded-panel border border-ink-700 bg-ink-900 p-5">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[13px] font-semibold text-content">Measured across {measured.windows} windows</h3>
            <Provenance kind="measured" />
          </div>
          <p className="text-[12px] leading-relaxed text-content-muted">
            Over {measured.flows_evaluated.toLocaleString()} flows the detector alone missed{' '}
            <span className="mono text-content">{measured.detector_alone.attacks_missed}</span> genuine attacks.
            Fusion recovered <span className="mono text-good">{measured.with_fusion.true_attacks_recovered}</span>{' '}
            of them and wrongly promoted{' '}
            <span className="mono text-bad">{measured.with_fusion.benign_flows_promoted}</span> benign flows.
          </p>
        </div>
      )}

      {fusionOnly.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-content">
            Raised only by fusion — no single sensor would have alerted
          </h3>
          <div className="space-y-2">
            {fusionOnly.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} open={open} setOpen={setOpen} highlight />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-content">All incidents</h3>
        <div className="space-y-2">
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} open={open} setOpen={setOpen} />
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-content-faint">{data.host_plane.placement}</p>
    </div>
  )
}

function IncidentCard({ incident, open, setOpen, highlight }) {
  const expanded = open === incident.id
  return (
    <div className={`rounded-panel border bg-ink-900 p-4 ${
      highlight ? 'border-accent-line' : 'border-ink-700'
    }`}>
      <button onClick={() => setOpen(expanded ? null : incident.id)} className="w-full text-left">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {incident.fusion_only && <GitMerge size={14} className="text-accent" />}
            <span className="text-[13px] font-medium text-content">{incident.asset}</span>
            <span className="mono text-[11px] text-content-faint">{incident.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {incident.techniques.map((t) => (
              <span key={t} className="mono rounded border border-ink-600 px-1.5 py-px text-[10px] text-content-faint">
                {t}
              </span>
            ))}
            <Severity level={incident.severity} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-content-faint">
          <span className="flex items-center gap-1">
            <Network size={12} /> {incident.network_signals} network
            {incident.weak_network_signals > 0 && ` (${incident.weak_network_signals} sub-threshold)`}
          </span>
          <span className="flex items-center gap-1">
            <MonitorCheck size={12} /> {incident.host_signals} host
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-ink-800 pt-3 text-[12px]">
          <p className="leading-relaxed text-content-muted">{incident.rationale}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-content-faint">Network evidence</div>
              {incident.evidence.network.map((e) => (
                <div key={e.id} className="mono text-content-muted">
                  {e.id} · score {e.score} · {e.family} · {e.source_ip}
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-content-faint">Host evidence</div>
              {incident.evidence.host.map((h) => (
                <div key={h.id} className="mono text-content-muted">
                  {h.technique} · conf {h.confidence} · {h.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
