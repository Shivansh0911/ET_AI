import ReactMarkdown from 'react-markdown'
import { FlaskConical, BookOpen, Layers } from 'lucide-react'

/* Shared primitives. Everything visual goes through these so the app has one voice
   instead of fourteen accent colours. */

export function Answer({ children }) {
  // The model writes markdown. Rendering it as plain text put literal ** on the screen,
  // which was the single most damaging detail in the old UI.
  return <div className="prose-answer text-[13px]"><ReactMarkdown>{children || ''}</ReactMarkdown></div>
}

export function Panel({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`bg-ink-900 border border-ink-700 rounded-panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[13px] font-semibold text-content">{title}</h2>}
            {subtitle && (
              <p className="text-[12px] text-content-faint mt-0.5 max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

export function Figure({ label, value, note, tone = 'default', size = 'md' }) {
  const tones = {
    default: 'text-content',
    good: 'text-good',
    bad: 'text-bad',
    accent: 'text-accent',
    muted: 'text-content-muted',
  }
  const sizes = { sm: 'text-[15px]', md: 'text-[19px]', lg: 'text-[26px]' }
  return (
    <div>
      <div className="text-label uppercase text-content-faint">{label}</div>
      <div className={`figure font-semibold mt-0.5 ${sizes[size]} ${tones[tone]}`}>{value}</div>
      {note && <div className="text-[11px] text-content-faint mt-0.5 leading-snug">{note}</div>}
    </div>
  )
}

export function Button({ children, onClick, disabled, variant = 'ghost', size = 'md', title }) {
  const variants = {
    primary: 'bg-accent-soft border-accent-line text-accent hover:bg-accent/20',
    ghost: 'bg-ink-800 border-ink-700 text-content-muted hover:text-content hover:border-ink-600',
    good: 'bg-good/10 border-good/30 text-good hover:bg-good/20',
    bad: 'bg-bad/10 border-bad/30 text-bad hover:bg-bad/20',
  }
  const sizes = { sm: 'px-2.5 py-1 text-[12px]', md: 'px-3 py-1.5 text-[13px]' }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </button>
  )
}

const SEVERITY = {
  critical: 'text-severity-critical border-severity-critical/30 bg-severity-critical/10',
  high: 'text-severity-high border-severity-high/30 bg-severity-high/10',
  medium: 'text-severity-medium border-severity-medium/30 bg-severity-medium/10',
  low: 'text-severity-low border-severity-low/30 bg-severity-low/10',
  info: 'text-severity-info border-ink-600 bg-ink-800',
}

export function Severity({ level = 'info' }) {
  return (
    <span className={`mono inline-block rounded border px-1.5 py-px text-[10px] uppercase
      tracking-wider ${SEVERITY[level] || SEVERITY.info}`}>
      {level}
    </span>
  )
}

export function severityHex(level) {
  return {
    critical: '#e5484d', high: '#ef8034', medium: '#d4a72c',
    low: '#5b8def', info: '#6b7482',
  }[level] || '#6b7482'
}

const PROVENANCE = {
  measured: { icon: FlaskConical, label: 'measured', className: 'text-good border-good/30',
    hint: 'Produced by an evaluation script in this repository, or timed at request time' },
  cited: { icon: BookOpen, label: 'cited', className: 'text-accent border-accent-line',
    hint: 'Published research, attributed. Not our measurement.' },
  illustrative: { icon: Layers, label: 'illustrative', className: 'text-severity-medium border-severity-medium/30',
    hint: 'A presentation layer over real data, not itself a measurement' },
}

export function Provenance({ kind = 'measured' }) {
  const { icon: Icon, label, className, hint } = PROVENANCE[kind] || PROVENANCE.measured
  return (
    <span title={hint}
      className={`mono inline-flex items-center gap-1 rounded border px-1.5 py-px
        text-[10px] uppercase tracking-wider ${className}`}>
      <Icon size={9} />{label}
    </span>
  )
}

export function Empty({ children }) {
  return (
    <div className="border border-dashed border-ink-700 rounded-panel px-5 py-8 text-center
      text-[13px] text-content-faint">
      {children}
    </div>
  )
}

export function Loading({ children = 'Loading' }) {
  return <div className="px-5 py-10 text-center text-[13px] text-content-faint">{children}</div>
}

export function Failed({ children }) {
  return (
    <div className="border border-bad/30 bg-bad/5 rounded-panel px-5 py-4 text-[13px] text-bad">
      {children}
    </div>
  )
}

export function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-ink-800 last:border-0">
      <span className="text-[12px] text-content-faint">{label}</span>
      <span className="mono text-[12px] text-content-muted text-right">{children}</span>
    </div>
  )
}
