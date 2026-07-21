import { lazy, Suspense, useState } from 'react'
import { Activity, GitMerge, Route, FlaskConical, ClipboardList, ScrollText, ShieldCheck } from 'lucide-react'
import Overview from './components/Overview'
import Argus from './components/Argus'
import { Loading } from './components/ui'

// Operations is the landing screen and loads eagerly. The rest arrive on first visit, which
// keeps the initial payload to what a judge sees in the first five seconds.
const Incidents = lazy(() => import('./components/Incidents'))
const AttackChain = lazy(() => import('./components/AttackChain'))
const Evidence = lazy(() => import('./components/Evidence'))
const ResponsePanel = lazy(() => import('./components/ResponsePanel'))
const AuditLedger = lazy(() => import('./components/AuditLedger'))

// Six screens, ordered the way an analyst moves: what is happening, what it adds up to, how far
// it has got, whether to believe any of it, what to do, and what was done. The assistant is not
// among them — it floats, because you ask questions about data without walking away from it.
const TABS = [
  { id: 'overview', label: 'Operations', icon: Activity, component: Overview },
  { id: 'incidents', label: 'Incidents', icon: GitMerge, component: Incidents },
  { id: 'chain', label: 'Progression', icon: Route, component: AttackChain },
  { id: 'evidence', label: 'Evidence', icon: FlaskConical, component: Evidence },
  { id: 'response', label: 'Response', icon: ClipboardList, component: ResponsePanel },
  { id: 'audit', label: 'Audit trail', icon: ScrollText, component: AuditLedger },
]

export default function App() {
  const [active, setActive] = useState('overview')
  const Current = TABS.find((t) => t.id === active).component

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-20 border-b border-line bg-surface-0/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-10 gap-y-1 px-6">
          <div className="flex items-center gap-2.5 py-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border
              border-accent-line bg-accent-soft">
              <ShieldCheck size={15} className="text-accent" />
            </span>
            <div className="leading-tight">
              <div className="text-title font-semibold tracking-tight text-ink">CyberSentinel</div>
              <div className="text-[11px] text-ink-faint">Detection that learns from your analysts</div>
            </div>
          </div>

          <nav className="-mb-px flex gap-0.5 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-4
                  text-body transition-colors ${
                    active === id
                      ? 'border-accent font-medium text-ink'
                      : 'border-transparent text-ink-faint hover:text-ink-muted'
                  }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        <Suspense fallback={<Loading>Opening {TABS.find((t) => t.id === active).label}</Loading>}>
          <Current />
        </Suspense>
      </main>

      <Argus />
    </div>
  )
}
