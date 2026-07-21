import { useState } from 'react'
import { Shield, LayoutDashboard, Map, Link2, ClipboardList, MessageSquare, GitMerge, FlaskConical, ScrollText } from 'lucide-react'
import Dashboard from './components/Dashboard'
import ThreatMap from './components/ThreatMap'
import AttackChain from './components/AttackChain'
import Incidents from './components/Incidents'
import Evidence from './components/Evidence'
import AuditLedger from './components/AuditLedger'
import ResponsePanel from './components/ResponsePanel'
import CopilotChat from './components/CopilotChat'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Threat Map', icon: Map },
  { id: 'incidents', label: 'Incidents', icon: GitMerge },
  { id: 'killchain', label: 'Kill Chain', icon: Link2 },
  { id: 'evidence', label: 'Evidence', icon: FlaskConical },
  { id: 'response', label: 'Response', icon: ClipboardList },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'copilot', label: 'Copilot', icon: MessageSquare },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-base text-gray-100">
      <header className="border-b border-gray-800 bg-card/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Shield className="text-emerald-400" size={22} />
          <span className="text-lg font-bold tracking-wider mono">CYBERSENTINEL</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          SYSTEM ACTIVE
        </div>
      </header>

      <nav className="border-b border-gray-800 px-6 flex gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition whitespace-nowrap ${
              tab === id
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'map' && <ThreatMap />}
        {tab === 'incidents' && <Incidents />}
        {tab === 'killchain' && <AttackChain />}
        {tab === 'evidence' && <Evidence />}
        {tab === 'response' && <ResponsePanel />}
        {tab === 'audit' && <AuditLedger />}
        {tab === 'copilot' && <CopilotChat />}
      </main>
    </div>
  )
}
