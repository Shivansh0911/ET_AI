import { useEffect, useState } from 'react'
import { GitMerge, Network, MonitorCheck } from 'lucide-react'
import { api } from '../utils/api'
import SeverityBadge from './SeverityBadge'
import ProvenanceTag from './Provenance'

export default function Incidents() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    api.getIncidents().then(setData).catch(() => setError('Unable to load incidents.'))
  }, [])

  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>
  if (!data) return <div className="text-gray-500 p-8 text-center">Correlating planes...</div>

  const { incidents, summary, measured } = data
  const fusionOnly = incidents.filter((i) => i.fusion_only)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-200">Compound Incidents</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">{data.method}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Incidents this window', summary.incidents],
          ['Fusion-only', summary.fusion_only_incidents],
          ['Attacks recovered', summary.true_attacks_recovered],
          ['Host captures', data.host_plane.captures],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-gray-800 rounded-xl p-3">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
            <div className="text-lg font-bold mono text-gray-100">{value}</div>
          </div>
        ))}
      </div>

      {measured?.available && (
        <div className="bg-card border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-300">Measured across {measured.windows} windows</h3>
            <ProvenanceTag kind="measured" />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Over {measured.flows_evaluated.toLocaleString()} flows the detector alone missed{' '}
            <span className="mono text-gray-200">{measured.detector_alone.attacks_missed}</span> genuine attacks.
            Fusion recovered <span className="mono text-emerald-400">{measured.with_fusion.true_attacks_recovered}</span>{' '}
            of them and wrongly promoted{' '}
            <span className="mono text-orange-400">{measured.with_fusion.benign_flows_promoted}</span> benign flows.
          </p>
        </div>
      )}

      {fusionOnly.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
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
        <h3 className="text-sm font-semibold text-gray-400 mb-2">All incidents</h3>
        <div className="space-y-2">
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} open={open} setOpen={setOpen} />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-600 leading-relaxed">{data.host_plane.placement}</p>
    </div>
  )
}

function IncidentCard({ incident, open, setOpen, highlight }) {
  const expanded = open === incident.id
  return (
    <div className={`bg-card border rounded-xl p-3 ${
      highlight ? 'border-emerald-500/30' : 'border-gray-800'
    }`}>
      <button onClick={() => setOpen(expanded ? null : incident.id)} className="w-full text-left">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {incident.fusion_only && <GitMerge size={14} className="text-emerald-400" />}
            <span className="text-sm font-semibold text-gray-200">{incident.asset}</span>
            <span className="text-xs text-gray-600 mono">{incident.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {incident.techniques.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-md border border-gray-700 text-xs mono text-gray-400">
                {t}
              </span>
            ))}
            <SeverityBadge severity={incident.severity} />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
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
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-2 text-xs">
          <p className="text-gray-400 leading-relaxed">{incident.rationale}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-gray-500 mb-1">Network evidence</div>
              {incident.evidence.network.map((e) => (
                <div key={e.id} className="mono text-gray-400">
                  {e.id} · score {e.score} · {e.family} · {e.source_ip}
                </div>
              ))}
            </div>
            <div>
              <div className="text-gray-500 mb-1">Host evidence</div>
              {incident.evidence.host.map((h) => (
                <div key={h.id} className="mono text-gray-400">
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
