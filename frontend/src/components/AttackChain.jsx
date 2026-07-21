import { useEffect, useState } from 'react'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { api } from '../utils/api'
import SeverityBadge from './SeverityBadge'

export default function AttackChain() {
  const [chain, setChain] = useState([])
  const [prediction, setPrediction] = useState('')
  const [table, setTable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.getKillChain()
      .then((res) => {
        setChain(res.kill_chain || [])
        setPrediction(res.next_move_prediction || '')
        setTable(res.attack_table || null)
      })
      .catch(() => setError('Unable to load kill chain data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 p-8 text-center">Analyzing kill chain...</div>
  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-200">MITRE ATT&amp;CK Kill Chain</h2>
        {table && (
          <p className="text-xs text-gray-500 mt-1">
            {table.technique_count.toLocaleString()} techniques from {table.source} — {table.provenance}.
            Stages are anchored on the earliest detection per tactic, so the progression reads
            forward in time.
          </p>
        )}
      </div>

      {chain.length === 0 ? (
        <div className="bg-card border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          No kill chain progression observed yet.
        </div>
      ) : (
        <div className="bg-card border border-gray-800 rounded-xl p-4 overflow-x-auto mb-4">
          <div className="flex items-stretch gap-2 min-w-max pb-2">
            {chain.map((stage, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(stage)}
                  className={`min-w-[180px] text-left p-3 rounded-lg border transition ${
                    selected?.technique_id === stage.technique_id
                      ? 'border-emerald-500/50 bg-gray-900'
                      : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                  }`}
                >
                  <div className="text-xs text-gray-500 uppercase mono">{stage.tactic}</div>
                  <div className="text-sm font-semibold text-gray-200 mt-1">{stage.technique_name}</div>
                  <div className="text-xs text-gray-500 mono mt-1">{stage.technique_id}</div>
                  <div className="mt-2"><SeverityBadge severity={stage.severity} /></div>
                </button>
                {i < chain.length - 1 && <ChevronRight className="text-gray-700 shrink-0" size={20} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="bg-card border border-gray-800 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-1">Stage Detail</h3>
          <p className="text-sm text-gray-300">{selected.event}</p>
          <p className="text-xs text-gray-500 mt-1 mono">
            Asset: {selected.asset} · {selected.detections} detection(s) · peak score {selected.max_score}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 mono">
            First seen {selected.first_seen} · last seen {selected.last_seen}
          </p>
        </div>
      )}

      <div className="bg-card border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-gray-400">AI Next-Move Prediction</h3>
        </div>
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{prediction}</p>
      </div>
    </div>
  )
}
