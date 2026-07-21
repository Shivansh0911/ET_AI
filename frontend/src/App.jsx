import { useState } from 'react'
import { Activity, GitMerge, Link2, FlaskConical, ClipboardList, ScrollText } from 'lucide-react'
import Overview from './components/Overview'
import Incidents from './components/Incidents'
import AttackChain from './components/AttackChain'
import Evidence from './components/Evidence'
import ResponsePanel from './components/ResponsePanel'
import AuditLedger from './components/AuditLedger'
import CopilotDock from './components/CopilotDock'

// Six screens, ordered by how often an analyst would open them. The copilot is no longer one
// of them — it floats over all six, because you ask questions about data without leaving it.
const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity, component: Overview },
  { id: 'incidents', label: 'Incidents', icon: GitMerge, component: Incidents },
  { id: 'chain', label: 'Kill chain', icon: Link2, component: AttackChain },
  { id: 'evidence', label: 'Evidence', icon: FlaskConical, component: Evidence },
  { id: 'response', label: 'Response', icon: ClipboardList, component: ResponsePanel },
  { id: 'audit', label: 'Audit', icon: ScrollText, component: AuditLedger },
]

export default function App() {
  const [active, setActive] = useState('overview')
  const Current = TABS.find((t) => t.id === active).component

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-8 px-6">
          <div className="flex items-baseline gap-2 py-4">
            <span className="text-[15px] font-semibold tracking-tight text-content">
              CyberSentinel
            </span>
            <span className="text-[11px] text-content-faint">
              behavioural detection, corrected by analysts
            </span>
          </div>

          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-4
                  text-[13px] transition-colors ${
                    active === id
                      ? 'border-accent text-content'
                      : 'border-transparent text-content-faint hover:text-content-muted'
                  }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <Current />
      </main>

      <CopilotDock />
    </div>
  )
}
