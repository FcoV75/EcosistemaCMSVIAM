import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, FileText, Paperclip, Send, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { uploadFileToCloudinary, classifyUploadFile, cloudinaryPdfDeliveryUrl } from '../lib/cloudinary-upload'
import { chatRoomId, getSupabaseBrowserClient } from '../lib/supabase.browser'
import { getSupabaseBrowserSessionFn } from '../server/auth.functions'
import {
  getConversationFn,
  markMessageReadFn,
  sendMessageFn,
} from '../server/social.functions'
import { uploadChatDocumentFn } from '../server/upload.functions'
import { LinkifiedText } from './LinkifiedText'
import { PostMedia } from './PostMedia'

const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024
const MAX_SERVER_DOC_BYTES = 4 * 1024 * 1024

type ChatAttachment = {
  url: string
  mimeType: string | null
  fileName: string | null
  sizeBytes: number | null
}

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
  url_adjunto?: string | null
  tipo_mime?: string | null
  nombre_archivo?: string | null
  tamanio_bytes?: number | null
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

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentFromRow(row: {
  url_adjunto?: string | null
  tipo_mime?: string | null
  nombre_archivo?: string | null
  tamanio_bytes?: number | null
}): ChatAttachment | null {
  if (!row.url_adjunto) return null
  return {
    url: row.url_adjunto,
    mimeType: row.tipo_mime ?? null,
    fileName: row.nombre_archivo ?? null,
    sizeBytes: row.tamanio_bytes ?? null,
  }
}

function ChatAttachmentView({
  attachment,
  mine,
}: {
  attachment: ChatAttachment
  mine: boolean
}) {
  const mime = attachment.mimeType ?? ''
  const isPdf =
    mime === 'application/pdf' || /\.pdf(\?|$)/i.test(attachment.url) || /\.pdf$/i.test(attachment.fileName || '')
  const isImage =
    !isPdf &&
    (mime.startsWith('image/') || /\.(gif|jpe?g|png|webp)(\?|$)/i.test(attachment.url))
  const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm)(\?|$)/i.test(attachment.url)
  const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(attachment.url)

  if (isImage || isVideo) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl">
        <PostMedia mediaUrl={attachment.url} mediaType={isVideo ? 'video' : undefined} compact />
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className="mt-2">
        <audio controls src={attachment.url} className="w-full max-w-xs" preload="metadata" />
        {attachment.fileName ? (
          <p className={`mt-1 truncate text-[11px] ${mine ? 'text-slate-700' : 'text-purple-300/70'}`}>
            {attachment.fileName}
          </p>
        ) : null}
      </div>
    )
  }

  const sizeLabel = formatBytes(attachment.sizeBytes)
  const href = isPdf ? cloudinaryPdfDeliveryUrl(attachment.url) : attachment.url
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.fileName || undefined}
      className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        mine
          ? 'border-slate-800/30 bg-black/10 text-slate-900 hover:bg-black/15'
          : 'border-purple-500/30 bg-slate-950/50 text-amber-100 hover:border-amber-400/40'
      }`}
    >
      <FileText size={16} />
      <span className="min-w-0 flex-1 truncate">
        {attachment.fileName || (isPdf ? 'PDF adjunto' : 'Documento adjunto')}
        {sizeLabel ? ` · ${sizeLabel}` : ''}
      </span>
    </a>
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
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)
  const [peerInChat, setPeerInChat] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    getConversationFn({ data: peerId }).then((data) => {
      if (!cancelled) setMessages(data.messages as ChatMessage[])
    })
    return () => {
      cancelled = true
    }
  }, [peerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    }
  }, [pendingPreviewUrl])

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null

    async function connectRealtime() {
      const supabase = getSupabaseBrowserClient()
      const session = await getSupabaseBrowserSessionFn()
      if (session) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
      }

      if (cancelled) return

      const room = chatRoomId(myUserId, peerId)
      channel = supabase
        .channel(`chat:${room}`, { config: { presence: { key: myUserId } } })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensajes' },
          (payload) => {
            const row = payload.new as ChatMessage & {
              remitente_id: string
              destinatario_id: string
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
                  url_adjunto: row.url_adjunto ?? null,
                  tipo_mime: row.tipo_mime ?? null,
                  nombre_archivo: row.nombre_archivo ?? null,
                  tamanio_bytes: row.tamanio_bytes ?? null,
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
          if (!channel) return
          const state = channel.presenceState()
          setPeerInChat(Boolean(state[peerId]?.length))
        })
        .subscribe(async (status) => {
          setLiveConnected(status === 'SUBSCRIBED')
          if (status === 'SUBSCRIBED' && channel) {
            await channel.track({ online_at: new Date().toISOString() })
          }
        })
    }

    connectRealtime().catch(() => setLiveConnected(false))

    return () => {
      cancelled = true
      if (channel) {
        try {
          getSupabaseBrowserClient().removeChannel(channel)
        } catch {
          /* Safari privado / cliente no disponible */
        }
      }
    }
  }, [myUserId, peerId])

  const clearPendingFile = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null)
    setPendingPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handlePickFile = (file: File | null) => {
    if (!file) return
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      alert('El archivo debe pesar máximo 20 MB.')
      return
    }
    const allowed =
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type.startsWith('audio/') ||
      file.type === 'application/pdf' ||
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip)$/i.test(file.name)
    if (!allowed && file.type) {
      // permitir si Cloudinary auto/upload puede manejarlo; avisamos solo tipos raros vacíos
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(file)
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPendingPreviewUrl(URL.createObjectURL(file))
    } else {
      setPendingPreviewUrl(null)
    }
  }

  const sendMutation = useMutation({
    mutationFn: async (payload: { cuerpo: string; file: File | null }) => {
      let adjunto: ChatAttachment | null = null
      if (payload.file) {
        setUploading(true)
        try {
          const kind = classifyUploadFile(payload.file)
          let url: string

          if (kind === 'document') {
            // PDF/Office: preferir subida servidor (raw). Si es muy grande o falla, cliente raw.
            if (payload.file.size <= MAX_SERVER_DOC_BYTES) {
              const buffer = await payload.file.arrayBuffer()
              const bytes = new Uint8Array(buffer)
              let binary = ''
              const chunk = 0x8000
              for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
              }
              const base64 = btoa(binary)
              try {
                const uploaded = await uploadChatDocumentFn({
                  data: {
                    fileName: payload.file.name,
                    mimeType: payload.file.type || 'application/pdf',
                    base64,
                    sizeBytes: payload.file.size,
                  },
                })
                adjunto = {
                  url: uploaded.url,
                  mimeType: uploaded.mimeType,
                  fileName: uploaded.fileName,
                  sizeBytes: uploaded.sizeBytes,
                }
              } catch {
                const url = await uploadFileToCloudinary(payload.file)
                adjunto = {
                  url,
                  mimeType: payload.file.type || 'application/pdf',
                  fileName: payload.file.name || null,
                  sizeBytes: payload.file.size,
                }
              }
            } else {
              const url = await uploadFileToCloudinary(payload.file)
              adjunto = {
                url,
                mimeType: payload.file.type || 'application/pdf',
                fileName: payload.file.name || null,
                sizeBytes: payload.file.size,
              }
            }
          } else {
            const url = await uploadFileToCloudinary(payload.file)
            adjunto = {
              url,
              mimeType: payload.file.type || null,
              fileName: payload.file.name || null,
              sizeBytes: payload.file.size,
            }
          }
        } finally {
          setUploading(false)
        }
      }

      const result = await sendMessageFn({
        data: {
          destinatarioId: peerId,
          cuerpo: payload.cuerpo,
          tipo: 'general',
          adjunto: adjunto
            ? {
                url: adjunto.url,
                mimeType: adjunto.mimeType,
                fileName: adjunto.fileName,
                sizeBytes: adjunto.sizeBytes,
              }
            : null,
        },
      })

      return { result, cuerpo: payload.cuerpo || (adjunto ? '📎' : ''), adjunto }
    },
    onSuccess: ({ result, cuerpo, adjunto }) => {
      setText('')
      clearPendingFile()
      if (!result.id) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.id)) return prev
        const fromServer = result.adjunto
        return [
          ...prev,
          {
            id: result.id,
            remitente_id: myUserId,
            destinatario_id: peerId,
            asunto: null,
            cuerpo,
            tipo: 'general',
            leido: false,
            created_at: new Date().toISOString(),
            mine: true,
            url_adjunto: fromServer?.url ?? adjunto?.url ?? null,
            tipo_mime: fromServer?.mimeType ?? adjunto?.mimeType ?? null,
            nombre_archivo: fromServer?.fileName ?? adjunto?.fileName ?? null,
            tamanio_bytes: fromServer?.sizeBytes ?? adjunto?.sizeBytes ?? null,
          },
        ]
      })
    },
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo enviar'),
  })

  const handleSend = () => {
    const trimmed = text.trim()
    if ((!trimmed && !pendingFile) || sendMutation.isPending || uploading) return
    sendMutation.mutate({ cuerpo: trimmed, file: pendingFile })
  }

  const avatar = peerAvatar?.trim() || `https://i.pravatar.cc/80?u=${peerId}`
  const showLiveBadge = peerInChat || peerOnlineApprox
  const canSend = Boolean(text.trim() || pendingFile) && !sendMutation.isPending && !uploading

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
            Aún no hay mensajes. Escribe o adjunta un archivo para iniciar.
          </p>
        )}
        {messages.map((msg) => {
          const attachment = attachmentFromRow(msg)
          const showText = msg.cuerpo && msg.cuerpo !== '📎'
          return (
            <div key={msg.id} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
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
                {showText ? (
                  <p className="whitespace-pre-wrap break-words">
                    <LinkifiedText text={msg.cuerpo} />
                  </p>
                ) : null}
                {attachment ? <ChatAttachmentView attachment={attachment} mine={msg.mine} /> : null}
                <p className={`mt-1 text-[10px] ${msg.mine ? 'text-slate-700' : 'text-purple-400/70'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-purple-500/20 p-3">
        {pendingFile ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <Paperclip size={14} />
            <span className="min-w-0 flex-1 truncate">
              {pendingFile.name}
              {formatBytes(pendingFile.size) ? ` · ${formatBytes(pendingFile.size)}` : ''}
            </span>
            <button
              type="button"
              onClick={clearPendingFile}
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label="Quitar adjunto"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
        {pendingPreviewUrl ? (
          <div className="mb-2 overflow-hidden rounded-xl border border-purple-500/20">
            {pendingFile?.type.startsWith('video/') ? (
              <video src={pendingPreviewUrl} controls className="max-h-40 w-full object-contain" />
            ) : (
              <img src={pendingPreviewUrl} alt="" className="max-h-40 w-full object-contain" />
            )}
          </div>
        ) : null}

        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sendMutation.isPending || uploading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 text-purple-100 hover:bg-white/5 disabled:opacity-50"
            aria-label="Adjuntar archivo"
            title="Imagen, GIF, video, audio o documento"
          >
            <Paperclip size={18} />
          </button>
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
            placeholder="Escribe un mensaje o adjunta un archivo…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-purple-500/25 bg-slate-900/70 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-purple-400/60">
          {uploading
            ? 'Subiendo archivo…'
            : 'Enter enviar · Shift+Enter nueva línea · Adjuntos hasta 20 MB'}
        </p>
      </div>
    </div>
  )
}
