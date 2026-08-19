import { useState, useTransition } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { askSupportBotFn } from '../server/support.functions'

type ChatMessage = {
  id: string
  role: 'user' | 'bot'
  text: string
}

export function SupportBot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hola, soy el bot de apoyo de ContacNeed. Pregúntame sobre oficios, qué publicar en la pizarra (fotos, YouTube o material propio), PRO o soporte técnico.',
    },
  ])
  const [isPending, startTransition] = useTransition()

  const sendMessage = () => {
    const question = input.trim()
    if (!question || isPending) return

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: question,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

    startTransition(async () => {
      try {
        const response = await askSupportBotFn({ data: { question } })
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-bot`,
            role: 'bot',
            text: response.answer,
          },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-bot-error`,
            role: 'bot',
            text: 'No pude responder ahora mismo. Intenta de nuevo o contacta soporte.',
          },
        ])
      }
    })
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Abrir bot de soporte"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-amber-500 text-white shadow-2xl shadow-purple-900/50 transition hover:scale-105 hover:shadow-amber-500/30"
        >
          <Bot size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[60] flex h-[min(70vh,480px)] w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-purple-500/30 bg-slate-950/95 shadow-2xl shadow-purple-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-purple-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                <Bot size={18} className="text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Apoyo ContacNeed</p>
                <p className="text-[11px] text-purple-200/80">IA de oficios, pizarra y soporte</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-slate-950'
                    : 'bg-purple-900/50 text-purple-50'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            ))}
            {isPending && <p className="text-xs text-purple-300/60">Escribiendo respuesta...</p>}
          </div>

          <div className="border-t border-purple-500/20 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendMessage()
                }}
                placeholder="Ej: ¿qué publico hoy de mi oficio?"
                className="flex-1 rounded-full border border-purple-500/30 bg-slate-900/80 px-4 py-2 text-sm text-white placeholder:text-purple-300/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isPending}
                className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 p-2.5 text-slate-950 hover:brightness-110 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
