import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, X } from 'lucide-react'
import { useState } from 'react'
import { useIdentity } from '../lib/identity-context'
import { publishMyProAdFn } from '../server/ads.functions'

type ProAdModalProps = {
  open: boolean
  onClose: () => void
}

export function ProAdModal({ open, onClose }: ProAdModalProps) {
  const queryClient = useQueryClient()
  const { profile } = useIdentity()
  const [titulo, setTitulo] = useState(profile?.nombre ?? '')
  const [cuerpo, setCuerpo] = useState(profile?.descripcion_profesion ?? profile?.habilidad_empirica ?? '')
  const [enlace, setEnlace] = useState('')

  const publishMutation = useMutation({
    mutationFn: () =>
      publishMyProAdFn({
        data: {
          titulo,
          cuerpo,
          enlace_url: enlace || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pro-panel'] })
      queryClient.invalidateQueries({ queryKey: ['banner-ads'] })
      alert('Tu anuncio PRO ya está visible en el panel lateral.')
      onClose()
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'No se pudo publicar el anuncio')
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="cn-glass w-full max-w-md rounded-2xl border border-amber-500/25 shadow-2xl">
        <div className="flex items-center justify-between border-b border-amber-500/15 px-6 py-4">
          <div className="flex items-center gap-2">
            <Crown className="text-amber-400" size={20} />
            <h3 className="text-lg font-bold text-white">Publicar anuncio PRO</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-purple-200">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-4 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault()
            publishMutation.mutate()
          }}
        >
          <p className="text-sm text-purple-200/80">
            Aparecerás en el Espacio PRO de tu estado. Solo puedes tener un anuncio activo a la vez.
          </p>

          <label className="block text-sm">
            <span className="mb-1 block text-purple-200/80">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-purple-200/80">Descripción</span>
            <textarea
              rows={3}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-purple-200/80">Enlace (WhatsApp, web, etc.)</span>
            <input
              type="url"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
            />
          </label>

          <button
            type="submit"
            disabled={publishMutation.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publicando...' : 'Publicar en Espacio PRO'}
          </button>
        </form>
      </div>
    </div>
  )
}
