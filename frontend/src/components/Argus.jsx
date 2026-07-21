import { useEffect, useRef, useState } from 'react'
import { X, ArrowUp, ShieldAlert, Wrench, Eye } from 'lucide-react'
import { api } from '../utils/api'
import { Answer } from './ui'

/* Naming the assistant. Three candidates were considered:
 *
 *   VIGIL   — accurate but flat; reads as a status label rather than a name.
 *   AEGIS   — the shield of Athena. Strong, but defensive-only, and it is already the name of
 *             several security products.
 *   ARGUS   — Argus Panoptes, the giant with a hundred eyes who never slept with all of them
 *             at once. Chosen: this system's whole job is watching everything continuously and
 *             telling you which of the hundred eyes saw something. It also survives being said
 *             out loud in a demo, which VIGIL does not.
 *
 * ARGUS it is.
 */

export const ASSISTANT = 'Argus'

const OPENERS = [
  'What is the detector missing right now?',
  'Explain T1046 and how to catch it',
  'Has analyst feedback changed anything?',
]

export default function Argus() {
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={`Open ${ASSISTANT}`}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2.5 rounded-full border
          border-accent-line bg-surface-2/95 py-3 pl-3.5 pr-4 text-body font-medium text-ink
          shadow-lg backdrop-blur transition-colors hover:border-accent hover:bg-surface-3"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft">
          <Eye size={13} className="text-accent" />
        </span>
        Ask {ASSISTANT}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex h-[560px] w-[min(430px,calc(100vw-3rem))]
      flex-col overflow-hidden rounded-card border border-line-strong bg-surface-1 shadow-2xl rise">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft">
            <Eye size={14} className="text-accent" />
          </span>
          <div>
            <div className="text-body font-semibold text-ink">{ASSISTANT}</div>
            <div className="text-meta text-ink-faint">Reads this deployment. Refusals are logged.</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close"
          className="text-ink-faint transition-colors hover:text-ink">
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-body text-ink-muted">
              I can read the live detections, look up ATT&CK techniques, tell you what the
              learning loop has done, and check the audit chain. Anything outside security work
              here, I will turn down.
            </p>
            <div className="space-y-1.5">
              {OPENERS.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="block w-full rounded-lg border border-line bg-surface-2 px-3 py-2
                    text-left text-meta text-ink-muted transition-colors
                    hover:border-line-strong hover:text-ink">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent-soft px-3 py-2
                text-body text-ink">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {m.refused && (
                <div className="flex items-center gap-1.5 text-meta text-severity-medium">
                  <ShieldAlert size={11} /> Declined, and written to the audit ledger
                </div>
              )}
              {m.injection && (
                <div className="flex items-center gap-1.5 text-meta text-severity-medium">
                  <ShieldAlert size={11} /> Instruction-like text in the telemetry was neutralised
                </div>
              )}
              <Answer>{m.content}</Answer>
              {m.tools?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <Wrench size={10} className="text-ink-faint" />
                  {m.tools.map((t) => (
                    <span key={t} className="font-mono rounded border border-line px-1.5 py-px
                      text-[10px] text-ink-faint">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-meta text-ink-faint">
            <span className="breathe h-1.5 w-1.5 rounded-full bg-accent" /> Thinking
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            placeholder={`Ask ${ASSISTANT} about a detection or a technique`}
            className="flex-1 resize-none rounded-lg border border-line bg-surface-0 px-3 py-2
              text-body text-ink placeholder:text-ink-faint focus:border-accent-line focus:outline-none"
          />
          <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send"
            className="rounded-lg border border-accent-line bg-accent-soft p-2.5 text-accent
              transition-colors hover:bg-accent/20 disabled:opacity-40">
            <ArrowUp size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
