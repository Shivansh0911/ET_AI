import { FlaskConical, BookOpen, Layers } from 'lucide-react'

// Shared vocabulary for where a number came from. Used everywhere a figure is shown so a
// judge never has to guess whether something was measured here or quoted from elsewhere.
const KINDS = {
  measured: {
    icon: FlaskConical,
    label: 'measured',
    style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    hint: 'Produced by an evaluation script in this repository, or timed at request time',
  },
  cited: {
    icon: BookOpen,
    label: 'cited',
    style: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    hint: 'Published research, attributed — not our own measurement',
  },
  illustrative: {
    icon: Layers,
    label: 'illustrative',
    style: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    hint: 'A presentation layer over real data, not itself a measurement',
  },
}

export default function ProvenanceTag({ kind = 'measured' }) {
  const { icon: Icon, label, style, hint } = KINDS[kind] || KINDS.measured
  return (
    <span
      title={hint}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide mono ${style}`}
    >
      <Icon size={10} />
      {label}
    </span>
  )
}

export function ProvenanceBanner({ provenance, source }) {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/80 leading-relaxed">
      <div className="flex items-center gap-2 mb-1">
        <ProvenanceTag kind="illustrative" />
        <span className="font-semibold text-amber-200">What is real and what is not</span>
      </div>
      {source && <div className="mono text-[11px] text-amber-200/60 mb-1">Stream: {source}</div>}
      {provenance}
    </div>
  )
}
