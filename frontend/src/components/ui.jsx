import ReactMarkdown from 'react-markdown'
import { FlaskConical, BookOpen, ArrowUpRight, ArrowDownRight } from 'lucide-react'

/* Every visual decision lives here. Components compose these rather than inventing their own
   colours, so the system stays consistent and changes in one place. */

export function Answer({ children }) {
  return <div className="answer"><ReactMarkdown>{children || ''}</ReactMarkdown></div>
}

/** `tint` gives a card a coloured header band — used sparingly, to group a section. */
export function Card({ title, hint, aside, children, className = '', bare = false, tint }) {
  const tints = {
    accent: 'border-b-accent-line bg-accent-soft',
    neutral: 'border-b-line bg-surface-2',
    warn: 'border-b-severity-medium/25 bg-severity-medium/[0.06]',
  }
  const banded = Boolean(tint && (title || aside))

  return (
    <section className={`overflow-hidden rounded-card border border-line bg-surface-1 shadow-card ${className}`}>
      {(title || aside) && (
        <header className={`flex items-start justify-between gap-4 px-5 ${
          banded ? `border-b py-3.5 ${tints[tint]}` : 'pt-4'
        }`}>
          <div className="min-w-0">
            {title && <h2 className="text-title font-semibold text-ink">{title}</h2>}
            {hint && <p className="mt-1 max-w-2xl text-meta text-ink-faint">{hint}</p>}
          </div>
          {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
        </header>
      )}
      <div className={bare ? '' : 'px-5 pb-5 pt-4'}>{children}</div>
    </section>
  )
}

/** Headline KPI. `delta` appears only when there is a genuine before/after to compare. */
export function Stat({ label, value, unit, delta, deltaLabel, note, tone = 'default', size = 'figure' }) {
  const tones = {
    default: 'text-ink', good: 'text-good', bad: 'text-bad',
    accent: 'text-accent', muted: 'text-ink-muted',
  }
  const sizes = { figure: 'text-figure', display: 'text-display', tabular: 'text-tabular' }
  const rising = typeof delta === 'number' && delta > 0
  const DeltaIcon = rising ? ArrowUpRight : ArrowDownRight

  return (
    <div className="min-w-0">
      <div className="text-label uppercase text-ink-faint">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`tabular font-semibold ${sizes[size] || sizes.figure} ${tones[tone]}`}>
          {value}
        </span>
        {unit && <span className="text-meta text-ink-faint">{unit}</span>}
      </div>
      {typeof delta === 'number' && delta !== 0 && (
        <div className={`mt-1 flex items-center gap-1 text-meta ${rising ? 'text-good' : 'text-bad'}`}>
          <DeltaIcon size={12} />
          <span className="tabular">{rising ? '+' : ''}{delta}</span>
          {deltaLabel && <span className="text-ink-faint">{deltaLabel}</span>}
        </div>
      )}
      {note && <div className="mt-1 text-meta leading-snug text-ink-faint">{note}</div>}
    </div>
  )
}

/** A row of KPIs. Screens lead with this so the headline numbers are above the fold. */
export function StatStrip({ children, columns = 4 }) {
  const cols = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }
  return (
    <div className={`grid grid-cols-2 gap-3 ${cols[columns] || cols[4]}`}>{children}</div>
  )
}

export function Button({ children, onClick, disabled, variant = 'quiet', size = 'md', title, active }) {
  const variants = {
    primary: 'bg-accent-soft border-accent-line text-accent hover:bg-accent/20',
    quiet: 'bg-surface-1 border-line-strong text-ink-muted shadow-card hover:text-ink hover:bg-surface-2',
    good: 'bg-good/10 border-good/30 text-good hover:bg-good/20',
    bad: 'bg-bad/10 border-bad/30 text-bad hover:bg-bad/20',
  }
  const sizes = { sm: 'px-2.5 py-1 text-meta', md: 'px-3.5 py-2 text-body' }
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-40
        ${active ? variants.primary : variants[variant]} ${sizes[size]}`}>
      {children}
    </button>
  )
}

const SEVERITY_STYLE = {
  critical: 'text-severity-critical border-severity-critical/30 bg-severity-critical/[0.07]',
  high: 'text-severity-high border-severity-high/30 bg-severity-high/[0.07]',
  medium: 'text-severity-medium border-severity-medium/30 bg-severity-medium/[0.07]',
  low: 'text-severity-low border-severity-low/30 bg-severity-low/[0.07]',
  info: 'text-severity-info border-line-strong bg-surface-2',
}

export function Severity({ level = 'info', dot = false }) {
  if (dot) {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: severityHex(level) }} />
        {level}
      </span>
    )
  }
  return (
    <span className={`font-mono inline-block rounded border px-1.5 py-px text-[10px] uppercase
      tracking-wider ${SEVERITY_STYLE[level] || SEVERITY_STYLE.info}`}>{level}</span>
  )
}

export function severityHex(level) {
  return {
    critical: '#c62828', high: '#b45309', medium: '#946200',
    low: '#1d4ed8', info: '#67707e',
  }[level] || '#67707e'
}

export const VIZ = ['#2f56d9', '#0f766e', '#6d28d9', '#0369a1', '#526074']

/* SVG needs literal values, so the map's palette is exported here rather than written inline
   in the component — same rule as everything else: one place to change it. */
export const MAP = {
  land: '#eaeef3',
  landHover: '#dfe5ed',
  border: '#cfd6e0',
  borderHover: '#aab5c4',
  nominal: '#2f56d9',
  label: '#10151c',
  labelMuted: '#54606f',
}
/* Chart stroke colours. SVG cannot read Tailwind classes, so anything drawn into a chart
   pulls its colour from here rather than hard-coding one at the call site. */
export const SERIES = {
  good: '#15803d',
  bad: '#c62828',
  muted: '#67707e',
  inactive: '#cfd6e0',
}
export const GRID = '#edf0f4'
export const AXIS = { fill: '#67707e', fontSize: 11 }

/* Recharts renders tooltip labels and item names using its own defaults, which come out near
   black on our dark surface — the values were unreadable. contentStyle alone does not fix it:
   labelStyle and itemStyle have to be set explicitly too. Spread TOOLTIP onto every <Tooltip>
   so no chart can drift back. */
export const TOOLTIP = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #cfd6e0',
    borderRadius: 10,
    padding: '8px 11px',
    boxShadow: '0 12px 28px -10px rgba(16, 24, 40, 0.18)',
  },
  labelStyle: { color: '#10151c', fontSize: 12, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#54606f', fontSize: 12, padding: 0 },
  cursor: { stroke: '#cfd6e0', strokeWidth: 1 },
}

/** Bar and pie charts want a filled cursor rather than a line. */
export const TOOLTIP_FILL = { ...TOOLTIP, cursor: { fill: 'rgba(47, 86, 217, 0.06)' } }

const PROVENANCE = {
  measured: { icon: FlaskConical, label: 'measured', className: 'text-good border-good/30',
    hint: 'Produced by an evaluation script in this repository, or timed at request time' },
  cited: { icon: BookOpen, label: 'cited', className: 'text-accent border-accent-line',
    hint: 'Published research, attributed. Not our own measurement.' },
}

/** Only measured and cited exist. An "illustrative" badge on half the screens read as a
    warning label; that caveat now lives in body copy where it is needed. */
export function Provenance({ kind = 'measured' }) {
  const entry = PROVENANCE[kind]
  if (!entry) return null
  const { icon: Icon, label, className, hint } = entry
  return (
    <span title={hint} className={`font-mono inline-flex items-center gap-1 rounded border
      px-1.5 py-px text-[10px] uppercase tracking-wider ${className}`}>
      <Icon size={9} />{label}
    </span>
  )
}

export function Mono({ children, className = '' }) {
  return <span className={`font-mono tabular text-ink-muted ${className}`}>{children}</span>
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-0 px-5 py-10 text-center">
      {title && <div className="text-body font-medium text-ink-muted">{title}</div>}
      {children && <div className="mt-1 text-meta text-ink-faint">{children}</div>}
    </div>
  )
}

export function Loading({ children = 'Working' }) {
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-16 text-body text-ink-faint">
      <span className="breathe h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </div>
  )
}

export function Failed({ children }) {
  return (
    <div className="rounded-card border border-bad/30 bg-bad/5 px-5 py-4 text-body text-bad">
      {children}
    </div>
  )
}

export function DataRow({ label, children, tone }) {
  const tones = { good: 'text-good', bad: 'text-bad', default: 'text-ink-muted' }
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-1.5 last:border-0">
      <span className="text-meta text-ink-faint">{label}</span>
      <span className={`font-mono tabular text-meta ${tones[tone] || tones.default}`}>{children}</span>
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3">
      <h2 className="text-title font-semibold text-ink">{children}</h2>
      {hint && <p className="mt-1 max-w-3xl text-meta text-ink-faint">{hint}</p>}
    </div>
  )
}

/** Quiet inline caveat. Replaces the illustrative badge — same information, no alarm. */
export function Note({ children }) {
  return (
    <p className="text-meta leading-relaxed text-ink-faint">{children}</p>
  )
}
