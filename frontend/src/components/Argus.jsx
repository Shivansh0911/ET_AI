import { useEffect, useRef, useState } from 'react'
import { X, ArrowUp, ShieldAlert, Wrench, BookOpen, MessageSquare } from 'lucide-react'
import { api } from '../utils/api'
import { Answer } from './ui'
import { Mark } from './Logo'

/* Naming the assistant. Three candidates were considered:
 *
 *   VIGIL   — accurate but flat; reads as a status label rather than a name.
 *   AEGIS   — the shield of Athena. Strong, but defensive-only, and already the name of
 *             several security products.
 *   ARGUS   — Argus Panoptes, the giant with a hundred eyes who never slept with all of them
 *             at once. Chosen: this system's whole job is watching continuously and telling
 *             you which of the hundred eyes saw something. It also survives being said out
 *             loud in a demo, which VIGIL does not.
 */

export const ASSISTANT = 'Argus'
const SEEN_KEY = 'cybersentinel.argus.seen'

const OPENERS = [
  'What is CyberSentinel and what problem does it solve?',
  'How do I use this — walk me through it',
  'What is the detector missing right now?',
  'Explain T1046 and how to catch it',
]

/* The guide is app copy, shown in its own panel and visually distinct from the conversation.
   It is deliberately NOT injected as a fake assistant message — presenting our own text as
   model output would be the one thing this project exists to avoid. */
const GUIDE = [
  {
    heading: 'What this is',
    body: 'A threat detector for critical infrastructure that improves as analysts correct it. It scores network flows, correlates them with host activity, maps what it finds onto MITRE ATT&CK, and drafts containment.',
  },
  {
    heading: 'Why it is different',
    body: 'Most detectors are frozen the day they ship. This one treats every "real" or "false" verdict you give as a training label and refits on the spot — so the alerts you see tomorrow reflect the corrections you made today.',
  },
  {
    heading: 'How to drive it',
    body: '1. Operations — check "Caught this window". 2. Work the triage queue: Real or False. 3. At twelve verdicts the model refits and the number moves. 4. Evidence shows the same result measured properly. 5. Audit trail — run the tamper test.',
  },
  {
    heading: 'What I can do',
    body: 'Read the live detections, look up any ATT&CK technique, report what the learning loop has done, and verify the audit chain. Ask me about any of it. Anything outside security work here, I will decline — and the refusal is logged.',
  },
]

export default function Argus() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('chat')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [nudge, setNudge] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // First visit gets the panel opened on the guide, so nobody has to discover the assistant.
  // Afterwards it stays shut and a one-time nudge is all you get.
  useEffect(() => {
    let seen = null
    try { seen = window.localStorage.getItem(SEEN_KEY) } catch { seen = null }
    const timer = setTimeout(() => {
      if (seen) return
      setView('guide')
      setOpen(true)
      try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
    }, 1200)
    if (seen) {
      const nudgeTimer = setTimeout(() => setNudge(true), 2500)
      const hide = setTimeout(() => setNudge(false), 11000)
      return () => { clearTimeout(timer); clearTimeout(nudgeTimer); clearTimeout(hide) }
    }
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  useEffect(() => { if (open && view === 'chat') inputRef.current?.focus() }, [open, view])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || busy) return
    setView('chat')
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await api.askCopilot(question, next)
      setMessages((m) => [...m, {
        role: 'assistant', content: res.response, refused: res.refused,
        tools: res.tools_used || [], injection: res.injection_neutralised,
      }])
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'I lost the backend connection. Check that the API is up and a Groq key is set.',
      }])
    } finally {
      setBusy(false)
    }
  }

  const launch = () => { setNudge(false); setOpen(true) }

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2.5">
        {nudge && (
          <button onClick={launch}
            className="max-w-[240px] rounded-xl rounded-br-sm border border-chrome-line
              bg-chrome px-3.5 py-2.5 text-left text-meta text-chrome-muted shadow-float rise
              transition-colors hover:border-accent-bright/40 hover:text-chrome-text">
            New here? I can explain what this is and how to drive the demo.
          </button>
        )}
        <button onClick={launch} aria-label={`Open ${ASSISTANT}`}
          className="flex items-center gap-2.5 rounded-full border border-chrome-line
            bg-chrome py-3 pl-3.5 pr-4 text-body font-medium text-chrome-text shadow-float
            transition-colors hover:border-accent-bright/50">
          <span className="flex h-6 w-6 items-center justify-center rounded-full
            bg-accent-onDark text-accent-bright">
            <Mark size={14} />
          </span>
          Ask {ASSISTANT}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex h-[580px] w-[min(430px,calc(100vw-3rem))]
      flex-col overflow-hidden rounded-card border border-chrome-line bg-chrome shadow-float rise">
      <header className="border-b border-chrome-line bg-chrome-raised px-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg
              border border-accent-bright/30 bg-accent-onDark text-accent-bright">
              <Mark size={15} />
            </span>
            <div>
              <div className="text-body font-semibold text-chrome-text">{ASSISTANT}</div>
              <div className="text-meta text-chrome-faint">Scoped to this deployment</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close"
            className="text-chrome-faint transition-colors hover:text-chrome-text">
            <X size={16} />
          </button>
        </div>

        <div className="-mb-px mt-2.5 flex gap-1">
          {[['chat', 'Chat', MessageSquare], ['guide', 'Guide', BookOpen]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-meta transition-colors ${
                view === id ? 'border-accent-bright font-medium text-chrome-text'
                  : 'border-transparent text-chrome-faint hover:text-chrome-muted'}`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </header>

      {view === 'guide' ? (
        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
          <p className="text-meta leading-relaxed text-chrome-faint">
            Written by the team, not generated — so you can trust it is not a model improvising.
          </p>
          {GUIDE.map(({ heading, body }) => (
            <div key={heading} className="rounded-lg border border-chrome-line bg-chrome-raised px-3.5 py-3">
              <div className="text-body font-medium text-chrome-text">{heading}</div>
              <p className="mt-1 text-meta leading-relaxed text-chrome-muted">{body}</p>
            </div>
          ))}
          <button onClick={() => setView('chat')}
            className="w-full rounded-lg border border-accent-bright/30 bg-accent-onDark px-3 py-2.5
              text-meta font-medium text-accent-bright transition-colors hover:bg-accent-bright/20">
            Ask me something
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-body text-chrome-muted">
                I read the live state of this deployment. Start with one of these, or ask your own.
              </p>
              <div className="space-y-1.5">
                {OPENERS.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="block w-full rounded-lg border border-chrome-line bg-chrome-raised px-3 py-2
                      text-left text-meta text-chrome-muted transition-colors
                      hover:border-accent-bright/40 hover:text-chrome-text">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent-onDark px-3 py-2
                  text-body text-chrome-text">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="space-y-1.5">
                {m.refused && (
                  <div className="flex items-center gap-1.5 text-meta text-chrome-warn">
                    <ShieldAlert size={11} /> Declined, and written to the audit trail
                  </div>
                )}
                {m.injection && (
                  <div className="flex items-center gap-1.5 text-meta text-chrome-warn">
                    <ShieldAlert size={11} /> Instruction-like text in the telemetry was neutralised
                  </div>
                )}
                <Answer dark>{m.content}</Answer>
                {m.tools?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Wrench size={10} className="text-chrome-faint" />
                    {m.tools.map((t) => (
                      <span key={t} className="font-mono rounded border border-chrome-line px-1.5 py-px
                        text-[10px] text-chrome-faint">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-meta text-chrome-faint">
              <span className="breathe h-1.5 w-1.5 rounded-full bg-accent-bright" /> Thinking
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="border-t border-chrome-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            placeholder={`Ask ${ASSISTANT} about a detection or a technique`}
            className="flex-1 resize-none rounded-lg border border-chrome-line bg-chrome-raised px-3 py-2
              text-body text-chrome-text placeholder:text-chrome-faint focus:border-accent-bright/50 focus:outline-none"
          />
          <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send"
            className="rounded-lg border border-accent-bright/30 bg-accent-onDark p-2.5 text-accent-bright
              transition-colors hover:bg-accent-bright/20 disabled:opacity-40">
            <ArrowUp size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
