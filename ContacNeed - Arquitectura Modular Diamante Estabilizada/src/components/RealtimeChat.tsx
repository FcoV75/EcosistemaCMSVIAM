import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Send, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { chatRoomId, getSupabaseBrowserClient } from '../lib/supabase.browser'
import {
  getConversationFn,
  markMessageReadFn,
  sendMessageFn,
} from '../server/social.functions'

type ChatMessage = {
  id: string
  remitente_id: string
  destinatario_id: string
  asunto: string | null
  cuerpo: string
  tipo: string
  leido: boolean
  created_at: string
  mine: boolean
}

type RealtimeChatProps = {
  peerId: string
  myUserId: string
  peerName: string
  peerAvatar: string | null
  peerOnlineApprox?: boolean
}

function isConversationMessage(
  row: { remitente_id: string; destinatario_id: string },
  myUserId: string,
  peerId: string,
) {
  return (
    (row.remitente_id === myUserId && row.destinatario_id === peerId) ||
    (row.remitente_id === peerId && row.destinatario_id === myUserId)
  )
}

export function RealtimeChat({
  peerId,
  myUserId,
  peerName,
  peerAvatar,
  peerOnlineApprox,
}: RealtimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [liveConnected, setLiveConnected] = useState(false)
  const [peerInChat, setPeerInChat] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getConversationFn({ data: peerId }).then((data) => {
      if (!cancelled) setMessages(data.messages)
    })
    return () => {
      cancelled = true
    }
  }, [peerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const room = chatRoomId(myUserId, peerId)

    const channel = supabase
      .channel(`chat:${room}`, { config: { presence: { key: myUserId } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const row = payload.new as {
            id: string
            remitente_id: string
            destinatario_id: string
            asunto: string | null
            cuerpo: string
            tipo: string
            leido: boolean
            created_at: string
          }

          if (!isConversationMessage(row, myUserId, peerId)) return

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                remitente_id: row.remitente_id,
                destinatario_id: row.destinatario_id,
                asunto: row.asunto,
                cuerpo: row.cuerpo,
                tipo: row.tipo,
                leido: row.leido,
                created_at: row.created_at,
                mine: row.remitente_id === myUserId,
              },
            ]
          })

          if (row.destinatario_id === myUserId) {
            markMessageReadFn({ data: { id: row.id } }).catch(() => {})
          }
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setPeerInChat(Boolean(state[peerId]?.length))
      })
      .subscribe(async (status) => {
        setLiveConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [myUserId, peerId])

  const sendMutation = useMutation({
    mutationFn: (cuerpo: string) =>
      sendMessageFn({ data: { destinatarioId: peerId, cuerpo, tipo: 'general' } }),
    onSuccess: () => setText(''),
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo enviar'),
  })

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }

  const avatar = peerAvatar?.trim() || `https://i.pravatar.cc/80?u=${peerId}`
  const showLiveBadge = peerInChat || peerOnlineApprox

  return (
    <div className="flex h-[min(72vh,640px)] flex-col overflow-hidden rounded-2xl border border-purple-500/25 bg-slate-950/50">
      <div className="flex items-center gap-3 border-b border-purple-500/20 px-4 py-3">
        <Link
          to="/mensajes"
          className="rounded-lg p-2 text-purple-200 transition hover:bg-purple-500/10 hover:text-white"
          aria-label="Volver a mensajes"
        >
          <ArrowLeft size={18} />
        </Link>
        <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <Link to="/u/$userId" params={{ userId: peerId }} className="truncate font-bold text-white hover:text-amber-200">
            {peerName}
          </Link>
          <p className="flex items-center gap-2 text-xs text-purple-300/70">
            {liveConnected ? (
              <>
                <Wifi size={12} className="text-emerald-400" />
                Chat en vivo activo
              </>
            ) : (
              <>
                <WifiOff size={12} />
                Conectando...
              </>
            )}
            {showLiveBadge && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                {peerInChat ? 'En el chat' : 'En línea'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-purple-200/50">
            Aún no hay mensajes. Escribe abajo para iniciar la conversación.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.mine
                  ? 'rounded-br-md bg-amber-500 text-slate-950'
                  : 'rounded-bl-md border border-purple-500/20 bg-slate-900/80 text-purple-50'
              }`}
            >
              {msg.asunto && (
                <p className={`mb-1 text-xs font-bold ${msg.mine ? 'text-slate-800' : 'text-amber-200/90'}`}>
                  {msg.asunto}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">{msg.cuerpo}</p>
              <p
                className={`mt-1 text-[10px] ${
                  msg.mine ? 'text-slate-700' : 'text-purple-400/70'
                }`}
              >
                {new Date(msg.created_at).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-purple-500/20 p-3">
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Escribe un mensaje..."
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-purple-500/25 bg-slate-900/70 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-purple-400/60">Enter para enviar · Shift+Enter nueva línea</p>
      </div>
    </div>
  )
}
