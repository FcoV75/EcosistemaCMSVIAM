import { useEffect, useRef, useState, useTransition } from 'react'
import { Bot, Mic, MicOff, Send, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { SOPORTE_EVENT } from '../lib/abrir-soporte'
import { askSupportBotFn } from '../server/support.functions'
import { orientarOrganoFn, proponerEncuentroFn, type CandidatoEncuentro } from '../server/organo.functions'
import { ORGANO_STORAGE_VOZ, parecePedidoEncuentro } from '../lib/organo-contratos'
import type { MexicoState } from '../lib/mexico-states'

type ChatMessage = {
  id: string
  role: 'user' | 'bot'
  text: string
  candidatos?: CandidatoEncuentro[]
}

type SupportBotProps = {
  selectedState?: MexicoState | ''
}

type Reco = {
  lang: string
  interimResults: boolean
  onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function SpeechCtor(): (new () => Reco) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => Reco; webkitSpeechRecognition?: new () => Reco }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function SupportBot({ selectedState = '' }: SupportBotProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [consentVoz, setConsentVoz] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hola. Soy el órgano de encuentro de ContacNeed: oficios, pizarra (fotos, YouTube o material propio), PRO y soporte. El faro se enciende si me hablas. Nunca presento a nadie sin tu veto.',
    },
  ])
  const [isPending, startTransition] = useTransition()
  const [pendingPregunta, setPendingPregunta] = useState<string | null>(null)
  const recRef = useRef<Reco | null>(null)

  useEffect(() => {
    try {
      setConsentVoz(localStorage.getItem(ORGANO_STORAGE_VOZ) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const faroEncendido = open && escuchando

  const sendMessage = (texto?: string) => {
    const question = (texto ?? input).trim()
    if (!question || isPending) return

    setMessages((prev) => [...prev, { id: `${Date.now()}-user`, role: 'user', text: question }])
    setInput('')

    startTransition(async () => {
      try {
        const encuentro = parecePedidoEncuentro(question)
        if (encuentro) {
          const [guia, propuesta] = await Promise.all([
            orientarOrganoFn({ data: { question } }),
            proponerEncuentroFn({ data: { necesidad: question, estado: selectedState || undefined } }),
          ])
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-bot`,
              role: 'bot',
              text: `${guia.answer}\n\n${propuesta.mensaje}`,
              candidatos: propuesta.candidatos,
            },
          ])
          return
        }

        const response = await askSupportBotFn({ data: { question } })
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-bot`, role: 'bot', text: response.answer },
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

  useEffect(() => {
    const onAbrir = (event: Event) => {
      const question = (event as CustomEvent<{ question?: string }>).detail?.question?.trim()
      setOpen(true)
      if (question) setPendingPregunta(question)
    }
    window.addEventListener(SOPORTE_EVENT, onAbrir)
    return () => window.removeEventListener(SOPORTE_EVENT, onAbrir)
  }, [])

  useEffect(() => {
    if (!open || !pendingPregunta || isPending) return
    const pregunta = pendingPregunta
    setPendingPregunta(null)
    sendMessage(pregunta)
  }, [open, pendingPregunta, isPending])

  const toggleVoz = () => {
    if (escuchando) {
      try {
        recRef.current?.stop()
      } catch {
        /* ignore */
      }
      setEscuchando(false)
      return
    }
    if (!consentVoz) {
      alert('Activa el consentimiento de voz. El faro tiene que poder verse.')
      return
    }
    const Ctor = SpeechCtor()
    if (!Ctor) {
      alert('Este navegador no ofrece dictado. Escribe tu necesidad de oficio.')
      return
    }
    const rec = new Ctor()
    rec.lang = 'es-MX'
    rec.interimResults = false
    rec.onresult = (ev) => {
      const texto = ev.results[0][0].transcript
      setInput(texto)
      setEscuchando(false)
      sendMessage(texto)
    }
    rec.onerror = () => setEscuchando(false)
    rec.onend = () => setEscuchando(false)
    recRef.current = rec
    setEscuchando(true)
    rec.start()
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Abrir órgano de encuentro ContacNeed"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-amber-500 text-white shadow-2xl shadow-purple-900/50 transition hover:scale-105 hover:shadow-amber-500/30"
        >
          <Bot size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[60] flex h-[min(78vh,560px)] w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl border border-purple-500/30 bg-slate-950/95 shadow-2xl shadow-purple-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-purple-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                <Bot size={18} className="text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Encuentro ContacNeed</p>
                <p className="text-[11px] text-purple-200/80">Órgano Nexus · oficios, pizarra y veto humano</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat" className="rounded-full p-1 hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          <div
            className={`flex items-center gap-2 px-4 py-2 text-xs ${
              faroEncendido ? 'bg-rose-950/80 text-rose-100' : 'bg-slate-900/80 text-slate-300'
            }`}
            role="status"
            aria-live="polite"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${faroEncendido ? 'animate-pulse bg-rose-400' : 'bg-slate-500'}`}
              aria-hidden
            />
            {faroEncendido ? 'FARO DE VOZ ENCENDIDO — te estoy oyendo' : 'Faro apagado — nadie te oye'}
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
                {message.candidatos && message.candidatos.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {message.candidatos.map((c) => (
                      <li key={c.id}>
                        <Link
                          to="/u/$userId"
                          params={{ userId: c.id }}
                          className="block rounded-lg border border-amber-400/30 bg-slate-950/40 px-2 py-1.5 text-amber-100 hover:bg-amber-500/10"
                        >
                          <span className="font-semibold">{c.nombre}</span>
                          <span className="block text-[11px] text-purple-200/80">
                            {[c.oficio, c.municipio, c.estado].filter(Boolean).join(' · ')}
                            {c.verificado ? ' · verificado' : ''}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wide text-amber-300/80">
                            Abrir perfil — el agente no contacta
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {isPending && <p className="text-xs text-purple-300/60">Sintonizando propuesta...</p>}
          </div>

          <div className="border-t border-purple-500/20 p-3">
            <label className="mb-2 flex items-start gap-2 text-[11px] leading-snug text-purple-200/80">
              <input
                type="checkbox"
                checked={consentVoz}
                onChange={(event) => {
                  const next = event.target.checked
                  setConsentVoz(next)
                  try {
                    localStorage.setItem(ORGANO_STORAGE_VOZ, next ? '1' : '0')
                  } catch {
                    /* ignore */
                  }
                  if (!next && escuchando) toggleVoz()
                }}
              />
              Consentimiento de voz. Sin esto el micrófono no abre. La cámara en ContacNeed permanece apagada.
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleVoz}
                aria-label={escuchando ? 'Apagar micrófono' : 'Hablar'}
                className={`rounded-full p-2.5 ${
                  escuchando ? 'bg-rose-500 text-white' : 'border border-purple-400/40 bg-purple-900/40 text-purple-100'
                }`}
              >
                {escuchando ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendMessage()
                }}
                placeholder="Necesito un… / ¿qué publico hoy de mi oficio?"
                className="flex-1 rounded-full border border-purple-500/30 bg-slate-900/80 px-4 py-2 text-sm text-white placeholder:text-purple-300/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
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
