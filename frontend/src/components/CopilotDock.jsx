import { useEffect, useRef, useState } from 'react'
import { MessageSquare, X, ArrowUp, ShieldAlert, Wrench } from 'lucide-react'
import { api } from '../utils/api'
import { Answer } from './ui'

// The copilot used to be a tab, which meant leaving your data to ask a question about it.
// It now sits over every screen and closes with Escape.

const OPENERS = [
  'What is the model missing right now?',
  'Explain T1046 and how to detect it',
  'Has feedback changed the detector?',
]

export default function CopilotDock() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || busy) return
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await api.askCopilot(question, next)
      setMessages((m) => [...m, {
        role: 'assistant',
        content: res.response,
        refused: res.refused,
        tools: res.tools_used || [],
        injection: res.injection_neutralised,
      }])
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'I could not reach the backend. Check that it is running and that a Groq key is set.',
      }])
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full
          border border-accent-line bg-accent-soft px-4 py-3 text-[13px] text-accent
          backdrop-blur transition-colors hover:bg-accent/20"
      >
        <MessageSquare size={15} />
        Ask the copilot
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 flex h-[540px] w-[min(420px,calc(100vw-2.5rem))]
      flex-col rounded-panel border border-ink-700 bg-ink-900 shadow-2xl rise">
      <header className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold text-content">Copilot</div>
          <div className="text-[11px] text-content-faint">
            Scoped to this deployment. Refusals are logged.
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-content-faint hover:text-content">
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-[13px] text-content-muted">
              I can read the current detections, look up ATT&CK techniques, report what the
              learning loop has done, and check the audit chain. I will not help with anything
              outside security operations here.
            </p>
            <div className="space-y-1.5">
              {OPENERS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2
                    text-left text-[12px] text-content-muted transition-colors
                    hover:border-ink-600 hover:text-content"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-soft px-3 py-2
                text-[13px] text-content">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {m.refused && (
                <div className="flex items-center gap-1.5 text-[11px] text-severity-medium">
                  <ShieldAlert size={11} /> Refused and written to the audit ledger
                </div>
              )}
              {m.injection && (
                <div className="flex items-center gap-1.5 text-[11px] text-severity-medium">
                  <ShieldAlert size={11} /> Instruction-like text in the telemetry was neutralised
                </div>
              )}
              <Answer>{m.content}</Answer>
              {m.tools?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <Wrench size={10} className="text-content-faint" />
                  {m.tools.map((t) => (
                    <span key={t} className="mono rounded border border-ink-700 px-1.5 py-px
                      text-[10px] text-content-faint">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )
        ))}

        {busy && <div className="text-[12px] text-content-faint">Working…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink-700 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            rows={1}
            placeholder="Ask about a detection, a technique, or the model"
            className="flex-1 resize-none rounded-md border border-ink-700 bg-ink-950 px-3 py-2
              text-[13px] text-content placeholder:text-content-faint focus:border-accent-line
              focus:outline-none"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="rounded-md border border-accent-line bg-accent-soft p-2 text-accent
              transition-colors hover:bg-accent/20 disabled:opacity-40"
          >
            <ArrowUp size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
