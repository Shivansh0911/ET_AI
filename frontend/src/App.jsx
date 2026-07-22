import { lazy, Suspense, useState } from 'react'
import { Activity, GitMerge, Share2, Users, Route, Boxes, FlaskConical, ShieldCheck, ClipboardList, ScrollText, BookOpen } from 'lucide-react'
import Overview from './components/Overview'
import Argus from './components/Argus'
import Logo from './components/Logo'
import { Loading } from './components/ui'

// Operations is the landing screen and loads eagerly. The rest arrive on first visit, which
// keeps the initial payload to what a judge sees in the first five seconds.
const Incidents = lazy(() => import('./components/Incidents'))
const AttackGraph = lazy(() => import('./components/AttackGraph'))
const Remediation = lazy(() => import('./components/Remediation'))
const Attribution = lazy(() => import('./components/Attribution'))
const Resilience = lazy(() => import('./components/Resilience'))
const AttackChain = lazy(() => import('./components/AttackChain'))
const Evidence = lazy(() => import('./components/Evidence'))
const ResponsePanel = lazy(() => import('./components/ResponsePanel'))
const AuditLedger = lazy(() => import('./components/AuditLedger'))
const About = lazy(() => import('./components/About'))

const TABS = [
  { id: 'overview', label: 'Operations', icon: Activity, component: Overview },
  { id: 'incidents', label: 'Incidents', icon: GitMerge, component: Incidents },
  { id: 'graph', label: 'Attack graph', icon: Share2, component: AttackGraph },
  { id: 'chain', label: 'Progression', icon: Route, component: AttackChain },
  { id: 'actor', label: 'Attribution', icon: Users, component: Attribution },
  { id: 'remediation', label: 'Remediation', icon: ShieldCheck, component: Remediation },
  { id: 'resilience', label: 'Resilience', icon: Boxes, component: Resilience },
  { id: 'evidence', label: 'Evidence', icon: FlaskConical, component: Evidence },
  { id: 'response', label: 'Response', icon: ClipboardList, component: ResponsePanel },
  { id: 'audit', label: 'Audit trail', icon: ScrollText, component: AuditLedger },
]

// The guide is not one of the six working screens, so it sits apart in the header rather than
// competing for a tab slot with the things an analyst uses every day.
const GUIDE = { id: 'about', label: 'Guide', icon: BookOpen, component: About }

export default function App() {
  const [active, setActive] = useState('overview')
  const current = [...TABS, GUIDE].find((t) => t.id === active)
  const Current = current.component

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-20 border-b border-chrome-line bg-chrome shadow-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-1 px-6">
          <button onClick={() => setActive('overview')} className="py-3.5" aria-label="CyberSentinel home">
            <Logo size={30} dark />
          </button>

          <nav className="-mb-px flex flex-1 gap-0.5 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-4
                  text-body transition-colors ${
                    active === id
                      ? 'border-accent-bright font-medium text-chrome-text'
                      : 'border-transparent text-chrome-faint hover:text-chrome-muted'
                  }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setActive(GUIDE.id)}
            className={`my-2.5 flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5
              text-meta font-medium transition-colors ${
                active === GUIDE.id
                  ? 'border-accent-bright/40 bg-accent-onDark text-accent-bright'
                  : 'border-chrome-line bg-chrome-raised text-chrome-muted hover:text-chrome-text'
              }`}
          >
            <BookOpen size={13} />
            What is this?
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Suspense fallback={<Loading>Opening {current.label}</Loading>}>
          <Current />
        </Suspense>
      </main>

      <Argus />
    </div>
  )
}
