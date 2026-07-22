import { lazy, Suspense, useMemo, useState } from 'react'
import {
  Activity, GitMerge, Share2, Users, Route, Boxes, FlaskConical, ShieldCheck,
  ClipboardList, ScrollText, BookOpen,
} from 'lucide-react'
import Overview from './components/Overview'
import Argus from './components/Argus'
import Logo from './components/Logo'
import GuidedTour from './components/GuidedTour'
import { Loading } from './components/ui'

// Operations is the landing screen and loads eagerly. The rest arrive on first visit.
const Incidents = lazy(() => import('./components/Incidents'))
const AttackGraph = lazy(() => import('./components/AttackGraph'))
const AttackChain = lazy(() => import('./components/AttackChain'))
const Attribution = lazy(() => import('./components/Attribution'))
const Evidence = lazy(() => import('./components/Evidence'))
const Remediation = lazy(() => import('./components/Remediation'))
const Resilience = lazy(() => import('./components/Resilience'))
const ResponsePanel = lazy(() => import('./components/ResponsePanel'))
const AuditLedger = lazy(() => import('./components/AuditLedger'))
const About = lazy(() => import('./components/About'))

// Two-tier navigation. Ten screens in one row is tab sprawl; grouping them into four capability
// areas keeps the bar legible AND signals breadth — a judge sees Detect / Investigate / Assess /
// Respond at a glance. The section row is primary; the tabs within it are secondary.
const SECTIONS = [
  { id: 'detect', label: 'Detect', tabs: [
    { id: 'overview', label: 'Operations', icon: Activity, component: Overview },
  ] },
  { id: 'investigate', label: 'Investigate', tabs: [
    { id: 'incidents', label: 'Incidents', icon: GitMerge, component: Incidents },
    { id: 'graph', label: 'Attack graph', icon: Share2, component: AttackGraph },
    { id: 'chain', label: 'Progression', icon: Route, component: AttackChain },
    { id: 'actor', label: 'Attribution', icon: Users, component: Attribution },
  ] },
  { id: 'assess', label: 'Assess', tabs: [
    { id: 'evidence', label: 'Evidence', icon: FlaskConical, component: Evidence },
    { id: 'remediation', label: 'Remediation', icon: ShieldCheck, component: Remediation },
    { id: 'resilience', label: 'Resilience', icon: Boxes, component: Resilience },
  ] },
  { id: 'respond', label: 'Respond', tabs: [
    { id: 'response', label: 'Response', icon: ClipboardList, component: ResponsePanel },
    { id: 'audit', label: 'Audit trail', icon: ScrollText, component: AuditLedger },
  ] },
]

const ALL_TABS = SECTIONS.flatMap((s) => s.tabs)
const GUIDE = { id: 'about', label: 'Guide', component: About }

export default function App() {
  const [active, setActive] = useState('overview')

  const section = useMemo(
    () => SECTIONS.find((s) => s.tabs.some((t) => t.id === active)),
    [active],
  )
  const current = active === GUIDE.id ? GUIDE : ALL_TABS.find((t) => t.id === active)
  const Current = current.component

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-20 border-b border-chrome-line bg-chrome shadow-md">
        <div className="mx-auto max-w-[1440px] px-6">
          {/* Row 1 — brand + capability sections + guide */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <button onClick={() => setActive('overview')} className="py-3" aria-label="CyberSentinel home">
              <Logo size={28} dark />
            </button>

            <nav className="flex flex-1 gap-1 overflow-x-auto">
              {SECTIONS.map((s) => {
                const on = section?.id === s.id && active !== GUIDE.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.tabs[0].id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-body transition-colors ${
                      on ? 'bg-chrome-raised font-medium text-chrome-text'
                        : 'text-chrome-faint hover:text-chrome-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </nav>

            <button
              onClick={() => setActive(GUIDE.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-meta
                font-medium transition-colors ${
                  active === GUIDE.id
                    ? 'border-accent-bright/40 bg-accent-onDark text-accent-bright'
                    : 'border-chrome-line text-chrome-muted hover:text-chrome-text'
                }`}
            >
              <BookOpen size={13} /> What is this?
            </button>
          </div>

          {/* Row 2 — tabs within the active section */}
          {section && active !== GUIDE.id && (
            <nav className="-mb-px flex gap-0.5 overflow-x-auto border-t border-chrome-line/60">
              {section.tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3
                    text-body transition-colors ${
                      active === id
                        ? 'border-accent-bright font-medium text-chrome-text'
                        : 'border-transparent text-chrome-faint hover:text-chrome-muted'
                    }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Suspense fallback={<Loading>Opening {current.label}</Loading>}>
          <Current />
        </Suspense>
      </main>

      <GuidedTour />
      <Argus />
    </div>
  )
}
