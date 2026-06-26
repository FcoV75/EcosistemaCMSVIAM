import { Copy, Share2, X } from 'lucide-react'
import { useState } from 'react'
import { buildSharePayload, SHARE_CHANNELS } from '../lib/share-post'

type SharePostModalProps = {
  open: boolean
  onClose: () => void
  postId: string
  excerpt: string
}

export function SharePostModal({ open, onClose, postId, excerpt }: SharePostModalProps) {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const { url, text, full } = buildSharePayload(postId, excerpt)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('No se pudo copiar el enlace')
    }
  }

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ContacNeed', text, url })
        onClose()
        return
      } catch {
        /* user cancelled */
      }
    }
    await copyLink()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="cn-glass w-full max-w-md rounded-2xl border border-purple-500/25 shadow-2xl">
        <div className="flex items-center justify-between border-b border-purple-500/15 px-5 py-4">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-amber-400" />
            <h3 className="font-bold text-white">Compartir publicación</h3>
          </div>
          <button type="button" onClick={onClose} className="text-purple-200">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-purple-200/80">
            Elige dónde compartir. Se abrirá la red seleccionada con el enlace listo para publicar.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {SHARE_CHANNELS.map((channel) => (
              <a
                key={channel.id}
                href={channel.buildUrl(url, text)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={`rounded-xl ${channel.color} px-3 py-3 text-center text-sm font-bold text-white transition hover:opacity-90`}
              >
                {channel.label}
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-slate-900/60 py-3 text-sm font-semibold text-purple-100"
          >
            <Copy size={16} />
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>

          {'share' in navigator && (
            <button
              type="button"
              onClick={nativeShare}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-slate-950"
            >
              Compartir con apps del dispositivo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
