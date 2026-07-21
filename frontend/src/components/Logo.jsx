/* CyberSentinel identity.
 *
 * The mark is a shield whose interior is an aperture — a sentinel is a thing that watches, and
 * a shield alone says "blocks" rather than "sees". The aperture blades are cut at 60° so the
 * negative space reads as a pupil at small sizes, which is what a favicon and a chat launcher
 * need. Everything is stroke geometry on a 24-unit grid, no fills to muddy it, so it stays
 * crisp from 16px to 64px.
 *
 * The wordmark splits weight rather than colour first: "Cyber" at 500 in muted ink, "Sentinel"
 * at 600 in full ink, with tight tracking. The accent appears only on the mark, so the lockup
 * has one focal point instead of competing for attention with itself.
 */

export function Mark({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
      aria-hidden="true">
      {/* Shield */}
      <path
        d="M12 2.5 20 5.6v6.1c0 4.6-3.2 8.7-8 10.3-4.8-1.6-8-5.7-8-10.3V5.6L12 2.5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Aperture blades */}
      <path
        d="M12 8.2 15.3 10.1 15.3 13.9 12 15.8 8.7 13.9 8.7 10.1 12 8.2Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.55"
      />
      {/* Pupil */}
      <circle cx="12" cy="12" r="1.55" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ className = '' }) {
  return (
    <span className={`select-none font-semibold tracking-[-0.02em] ${className}`}>
      <span className="font-medium text-ink-muted">Cyber</span>
      <span className="text-ink">Sentinel</span>
    </span>
  )
}

export default function Logo({ size = 28, stacked = false }) {
  return (
    <div className={`flex items-center gap-2.5 ${stacked ? 'flex-col gap-1.5' : ''}`}>
      <span
        className="flex items-center justify-center rounded-lg border border-accent-line
          bg-accent-soft text-accent"
        style={{ width: size, height: size }}
      >
        <Mark size={Math.round(size * 0.62)} />
      </span>
      <span className="leading-tight">
        <Wordmark className="text-title" />
        <span className="block text-[11px] text-ink-faint">
          Detection that learns from your analysts
        </span>
      </span>
    </div>
  )
}
