import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { MapPin } from 'lucide-react'
import india from '../data/india.topo.json'
import { Card, Severity, Mono, Empty, MAP, severityHex } from './ui'

// State boundaries from a 37 KB TopoJSON bundled with the app — no network call at render time,
// which matters when the demo runs on venue wifi. Sites are placed by real lat/lng and sized by
// how many detections landed there, so the map reads as a workload distribution rather than the
// glowing radar sweep these dashboards usually get.

// Solved rather than eyeballed: this is the largest Mercator scale that keeps the full extent
// (68.0–97.5°E, 7.9–37.2°N) inside a 520×520 viewport with 14px of padding. At scale 1000 the
// far north clipped by 35px.
const PROJECTION = { scale: 875, center: [82.75, 23.35] }

function radius(count, max) {
  if (!count) return 3
  return 4 + Math.sqrt(count / Math.max(max, 1)) * 9
}

export default function ThreatMap({ locations = [], detections = [] }) {
  const [selected, setSelected] = useState(null)

  const sites = useMemo(() => {
    const max = Math.max(...locations.map((l) => l.count), 1)
    return locations.map((l) => ({
      ...l,
      radius: radius(l.count, max),
      tone: l.critical > 0 ? 'critical' : l.count > max * 0.5 ? 'high' : 'low',
    }))
  }, [locations])

  const forSelected = selected
    ? detections.filter((d) => d.location === selected.city).slice(0, 8)
    : []

  return (
    <Card
      title="Monitored sites"
      hint="Detection volume by location. Select a site to see what fired there."
    >
      <div className="space-y-4">
        <div className="relative">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={PROJECTION}
            width={520}
            height={520}
            style={{ width: '100%', height: 'auto' }}
          >
            <Geographies geography={india}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: { fill: MAP.land, stroke: MAP.border, strokeWidth: 0.5, outline: 'none' },
                      hover: { fill: MAP.landHover, stroke: MAP.borderHover, strokeWidth: 0.5, outline: 'none' },
                      pressed: { fill: MAP.landHover, outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {sites.map((site) => {
              const isSelected = selected?.city === site.city
              const colour = site.tone === 'critical' ? severityHex('critical')
                : site.tone === 'high' ? severityHex('high') : MAP.nominal
              return (
                <Marker
                  key={site.city}
                  coordinates={[site.lng, site.lat]}
                  onClick={() => setSelected(isSelected ? null : site)}
                  style={{ default: { cursor: 'pointer' }, hover: { cursor: 'pointer' } }}
                >
                  <circle r={site.radius + 5} fill={colour} opacity={isSelected ? 0.22 : 0.1} />
                  <circle r={site.radius} fill={colour} fillOpacity={0.85}
                    stroke={isSelected ? MAP.label : colour} strokeWidth={isSelected ? 1.5 : 0} />
                  <text
                    textAnchor="middle"
                    y={-site.radius - 7}
                    style={{ fill: isSelected ? MAP.label : MAP.labelMuted, fontSize: 10,
                      fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}
                  >
                    {site.city}
                  </text>
                </Marker>
              )
            })}
          </ComposableMap>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-meta text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-severity-critical" /> critical present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-severity-high" /> elevated volume
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" /> nominal
            </span>
            <span>dot size = detection count</span>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          {!selected ? (
            <div className="space-y-2">
              <div className="text-label uppercase text-ink-faint">All sites</div>
              {sites.length === 0 && <Empty title="Nothing flagged">No site has an active detection in this window.</Empty>}
              {sites.map((site) => (
                <button
                  key={site.city}
                  onClick={() => setSelected(site)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border
                    border-line bg-surface-2 px-3 py-2 text-left transition-colors
                    hover:border-line-strong"
                >
                  <span className="flex items-center gap-2 text-body text-ink">
                    <MapPin size={12} className="text-ink-faint" />
                    {site.city}
                  </span>
                  <span className="flex items-center gap-2">
                    {site.critical > 0 && (
                      <span className="font-mono text-[10px] text-severity-critical">
                        {site.critical} crit
                      </span>
                    )}
                    <Mono className="text-body">{site.count}</Mono>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 rise">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-title font-semibold text-ink">{selected.city}</div>
                  <div className="text-meta text-ink-faint">
                    {selected.count} detection{selected.count === 1 ? '' : 's'}
                    {selected.critical > 0 && `, ${selected.critical} critical`}
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  className="text-meta text-ink-faint hover:text-ink">Back</button>
              </div>

              <div className="space-y-1.5">
                {forSelected.map((d) => (
                  <div key={d.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-body text-ink">{d.asset}</span>
                      <Severity level={d.severity} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-meta text-ink-faint">
                      <Mono className="text-[11px]">{d.anomaly_score}</Mono>
                      {d.mitre_id && <Mono className="text-[11px]">{d.mitre_id}</Mono>}
                    </div>
                  </div>
                ))}
                {forSelected.length === 0 && (
                  <div className="text-meta text-ink-faint">No detections recorded here.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
