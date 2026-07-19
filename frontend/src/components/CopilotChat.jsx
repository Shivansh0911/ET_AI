import { useEffect, useRef, useState } from 'react'
import { Send, Bot, User } from 'lucide-react'
import { api } from '../utils/api'

export default function CopilotChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'CyberSentinel Copilot online. Ask me about active threats, MITRE mappings, or containment recommendations.' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const send = async () => {
    const text = input.trim()
    if (!text || typing) return
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setTyping(true)
    try {
      const res = await api.askCopilot(text, nextMessages)
      setMessages((m) => [...m, { role: 'assistant', content: res.response }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Copilot unavailable — check backend connection and Groq API key.' }])
    } finally {
      setTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="bg-card border border-gray-800 rounded-xl flex flex-col h-[560px]">
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-2">
        <Bot size={16} className="text-emerald-400" />
        <span className="text-sm font-semibold text-gray-200 mono">SOC COPILOT</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          ONLINE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 mono text-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-500/10 text-blue-100' : 'bg-gray-900 text-gray-300'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400">
              <Bot size={14} />
            </div>
            <div className="bg-gray-900 text-gray-500 rounded-lg px-3 py-2">Analyzing...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask about active threats, MITRE techniques, containment steps..."
          className="flex-1 resize-none bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 mono focus:outline-none focus:border-emerald-500/50"
        />
        <button
          onClick={send}
          disabled={typing || !input.trim()}
          className="px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
