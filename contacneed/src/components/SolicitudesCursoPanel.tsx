import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquarePlus, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  crearSolicitudCursoFn,
  listSolicitudesCursosFn,
} from '../server/cursos-educativos.functions'

type Props = {
  loggedIn: boolean
}

export function SolicitudesCursoPanel({ loggedIn }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [tema, setTema] = useState('')
  const [paraQue, setParaQue] = useState('')
  const [nombrePublico, setNombrePublico] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['escuela-solicitudes'],
    queryFn: () => listSolicitudesCursosFn(),
  })

  const mutation = useMutation({
    mutationFn: () =>
      crearSolicitudCursoFn({
        data: {
          tema: tema.trim(),
          paraQue: paraQue.trim() || undefined,
          nombrePublico: nombrePublico.trim() || undefined,
        },
      }),
    onSuccess: (result) => {
      setMsg(result.nota || '¡Gracias! Tu solicitud ya está en el muro.')
      setTema('')
      setParaQue('')
      queryClient.invalidateQueries({ queryKey: ['escuela-solicitudes'] })
      setTimeout(() => setOpen(false), 1200)
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo enviar')
    },
  })

  useEffect(() => {
    if (!open) setMsg(null)
  }, [open])

  const solicitudes = listQuery.data?.solicitudes ?? []

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-950/40 via-slate-950/70 to-amber-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
            <Sparkles size={14} />
            Escuela viva
          </p>
          <h2 className="mt-1 text-xl font-black text-sky-50 sm:text-2xl">
            ¿Qué curso necesitas que generemos?
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Este muro se llena con lo que ustedes piden. Cuando haya suficientes voces claras,
            convertiremos esas solicitudes en cursos de principios — mismo método, de menor a mayor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950"
        >
          <MessageSquarePlus size={16} />
          Opinar / solicitar
        </button>
      </div>

      {solicitudes.length > 0 ? (
        <ul className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
          {solicitudes.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-slate-200"
            >
              <p className="font-semibold text-sky-100">{item.tema}</p>
              {item.paraQue ? <p className="mt-1 text-xs text-slate-400">{item.paraQue}</p> : null}
              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                {item.nombrePublico || 'Alguien de ContacNeed'}
                {item.created_at
                  ? ` · ${new Date(item.created_at).toLocaleDateString('es-MX')}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-white/10 px-5 py-4 text-sm text-slate-400">
          Aún no hay solicitudes públicas. Sé el primero en pedir el curso que te ayudaría de verdad.
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Solicitar curso"
            className="w-full max-w-lg rounded-2xl border border-sky-400/30 bg-slate-950 p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-sky-100">Ventana de solicitudes</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Cuéntanos qué tema te ayudaría. Mientras más concreto, mejor lo convertimos en curso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/15 p-1.5 text-slate-300 hover:bg-white/5"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {!loggedIn && (
              <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
                Inicia sesión en ContacNeed para dejar tu solicitud firmada en el muro.
              </p>
            )}

            <label className="block text-sm text-slate-300">
              Tema del curso que necesitas
              <input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                maxLength={160}
                placeholder="Ej. Cómo sanar la relación con el padre sin reabrir la herida"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-sky-400/50"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              ¿Para qué te ayudaría? (opcional)
              <textarea
                value={paraQue}
                onChange={(e) => setParaQue(e.target.value)}
                maxLength={400}
                rows={3}
                placeholder="Ej. Para no repetir el mismo patrón con mis hijos y dormir en paz."
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-sky-400/50"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Cómo quieres aparecer (opcional)
              <input
                value={nombrePublico}
                onChange={(e) => setNombrePublico(e.target.value)}
                maxLength={40}
                placeholder="Nombre o apodo público"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-sky-400/50"
              />
            </label>

            {msg && <p className="mt-3 text-sm text-emerald-200">{msg}</p>}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={mutation.isPending || !tema.trim() || !loggedIn}
                onClick={() => mutation.mutate()}
                className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {mutation.isPending ? 'Enviando…' : 'Publicar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
