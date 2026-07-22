import { useEffect, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'

// A one-time overlay that walks a first-time judge through the narrative — failure, fix,
// limit, trust — in four steps. Dismissible, remembered, and it never blocks the app: it is a
// guide to what to look at, not a wall in front of it.

const KEY = 'cybersentinel.tour.done'

const STEPS = [
  {
    title: 'Start with the failure',
    body: 'On Operations, the detector is meeting traffic from days it never trained on — it catches about 60% of malicious flows. We lead with that number because it is the honest one.',
    tab: 'Operations',
  },
  {
    title: 'Fix it live',
    body: 'Work the triage queue — mark alerts Real or False. At twelve verdicts the model refits and the recall figure jumps past 90%. Nothing reloaded; it learned from you.',
    tab: 'Operations',
  },
  {
    title: 'See the limit',
    body: 'Evidence shows the same result measured on held-out data — and the case where feedback transfers zero to a different campaign. We publish what does not work, not just what does.',
    tab: 'Evidence',
  },
  {
    title: 'Then check the trust',
    body: 'Attribution names likely actors, Resilience simulates blast radius, and on Audit trail the tamper test turns the integrity badge red on the exact broken entry. Every automated action is hash-chained.',
    tab: 'Audit trail',
  },
]

export default function GuidedTour() {
  const [step, setStep] = useState(-1)

  useEffect(() => {
    let done = null
    try { done = window.localStorage.getItem(KEY) } catch { done = null }
    if (!done) {
      const t = setTimeout(() => setStep(0), 700)
      return () => clearTimeout(t)
    }
  }, [])

  const close = () => {
    setStep(-1)
    try { window.localStorage.setItem(KEY, '1') } catch { /* private mode */ }
  }

  if (step < 0) return null
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-line bg-surface-1 shadow-float rise">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <div className="text-label uppercase text-accent">
              Step {step + 1} of {STEPS.length} · {s.tab}
            </div>
            <h2 className="mt-1 text-title font-semibold text-ink">{s.title}</h2>
          </div>
          <button onClick={close} aria-label="Skip tour"
            className="text-ink-faint transition-colors hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-body leading-relaxed text-ink-muted">{s.body}</p>
        </div>
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <button onClick={close} className="text-meta text-ink-faint hover:text-ink">
            Skip
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-4 bg-accent' : 'w-1.5 bg-line-strong'}`} />
            ))}
          </div>
          <button onClick={() => (last ? close() : setStep(step + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-line
              bg-accent-soft px-3 py-1.5 text-meta font-medium text-accent transition-colors
              hover:bg-accent/20">
            {last ? 'Explore' : 'Next'} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
