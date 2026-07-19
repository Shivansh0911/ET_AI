import { useEffect, useState } from 'react'
import { api } from '../utils/api'

// Simplified India outline path (approximate silhouette for a stylized SOC map).
const INDIA_OUTLINE = "M 150 20 L 190 15 L 230 30 L 250 60 L 270 55 L 290 75 L 285 110 L 300 140 L 290 180 L 310 210 L 300 250 L 280 290 L 260 330 L 240 370 L 220 410 L 200 440 L 185 460 L 170 440 L 160 400 L 145 370 L 130 340 L 120 300 L 100 270 L 90 230 L 100 190 L 85 160 L 95 120 L 80 90 L 100 60 L 120 40 Z"

// City coordinates mapped onto the 0-400 x 0-480 viewBox used by the outline above.
const CITY_COORDS = {
  Delhi: { x: 175, y: 110 },
  Lucknow: { x: 210, y: 150 },
  Mumbai: { x: 130, y: 270 },
  Hyderabad: { x: 190, y: 300 },
  Chennai: { x: 190, y: 380 },
}

function sevColor(count, critical) {
  if (critical > 0) return '#ef4444'
  if (count >= 5) return '#f97316'
  if (count >= 2) return '#eab308'
  return '#10b981'
}

export default function ThreatMap() {
  const [threats, setThreats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.getDashboard()
      .then((d) => setThreats(d.location_threats || []))
      .catch(() => setError('Unable to load threat map data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 p-8 text-center">Loading intel...</div>
  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>

  const maxCount = Math.max(1, ...threats.map((t) => t.count))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-card border border-gray-800 rounded-xl p-4 flex items-center justify-center">
        <svg viewBox="0 0 400 480" className="w-full max-w-md">
          <path d={INDIA_OUTLINE} fill="#1a1a24" stroke="#3f3f46" strokeWidth="2" />
          {threats.map((t) => {
            const coord = CITY_COORDS[t.city]
            if (!coord) return null
            const radius = 6 + (t.count / maxCount) * 14
            const color = sevColor(t.count, t.critical)
            return (
              <g
                key={t.city}
                onClick={() => setSelected(t)}
                className="cursor-pointer"
              >
                <circle cx={coord.x} cy={coord.y} r={radius} fill={color} fillOpacity="0.25" className="pulse-ring" style={{ transformOrigin: `${coord.x}px ${coord.y}px` }} />
                <circle cx={coord.x} cy={coord.y} r={Math.max(5, radius * 0.5)} fill={color} stroke="#0a0a0f" strokeWidth="1.5" />
                <text x={coord.x} y={coord.y - radius - 8} textAnchor="middle" fill="#9ca3af" fontSize="11" className="mono">
                  {t.city}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="bg-card border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Threat Locations</h3>
        {threats.length === 0 && <p className="text-sm text-gray-500">No geolocated threats detected.</p>}
        <div className="space-y-2">
          {threats.sort((a, b) => b.count - a.count).map((t) => (
            <button
              key={t.city}
              onClick={() => setSelected(t)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                selected?.city === t.city ? 'border-emerald-500/50 bg-gray-900' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">{t.city}</span>
                <span className="text-xs mono" style={{ color: sevColor(t.count, t.critical) }}>
                  {t.count} threats
                </span>
              </div>
              {t.critical > 0 && (
                <span className="text-xs text-red-400 mono">{t.critical} critical</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
