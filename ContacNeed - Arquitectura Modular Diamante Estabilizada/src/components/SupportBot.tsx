import { useState, useTransition } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
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
      text: 'Hola, soy el bot de apoyo de ContacNeed. Pregúntame sobre oficios, publicaciones, PRO o soporte técnico.',
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
      <button
        type="button"
        aria-label="Abrir bot de soporte"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-purple-700 text-white shadow-lg hover:bg-purple-800"
      >
        <MessageCircle size={22} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[420px] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-purple-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">Apoyo ContacNeed</p>
              <p className="text-xs text-purple-100">FAQ de oficios y soporte</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-amber-100 text-slate-900'
                    : 'bg-gray-100 text-slate-800'
                }`}
              >
                {message.text}
              </div>
            ))}
            {isPending && <p className="text-xs text-gray-500">Escribiendo respuesta...</p>}
          </div>

          <div className="border-t border-gray-100 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendMessage()
                }}
                placeholder="Escribe tu pregunta..."
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isPending}
                className="rounded-full bg-purple-700 p-2 text-white hover:bg-purple-800 disabled:opacity-50"
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
