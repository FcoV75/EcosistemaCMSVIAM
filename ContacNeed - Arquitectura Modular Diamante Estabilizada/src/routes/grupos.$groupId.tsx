import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { getServerUserFn } from '../server/auth.functions'
import {
  buscarMiembrosParaInvitarFn,
  enviarMensajeGrupoFn,
  getGrupoDetalleFn,
  getGrupoMensajesFn,
  invitarAGrupoFn,
} from '../server/grupos-proyectos.functions'

export const Route = createFileRoute('/grupos/$groupId')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: GrupoChatPage,
})

function GrupoChatPage() {
  const { groupId } = Route.useParams()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const detalle = useQuery({
    queryKey: ['grupo', groupId],
    queryFn: () => getGrupoDetalleFn({ data: { grupoId: groupId } }),
  })
  const mensajes = useQuery({
    queryKey: ['grupo-msgs', groupId],
    queryFn: () => getGrupoMensajesFn({ data: { grupoId: groupId } }),
    refetchInterval: 5_000,
  })
  const busqueda = useQuery({
    queryKey: ['invitar-busqueda', q],
    queryFn: () => buscarMiembrosParaInvitarFn({ data: { q } }),
    enabled: q.trim().length >= 2,
  })

  const sendMutation = useMutation({
    mutationFn: () => enviarMensajeGrupoFn({ data: { grupoId: groupId, cuerpo: msg } }),
    onSuccess: () => {
      setMsg('')
      queryClient.invalidateQueries({ queryKey: ['grupo-msgs', groupId] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Error'),
  })

  const inviteMutation = useMutation({
    mutationFn: (usuarioId: string) => invitarAGrupoFn({ data: { grupoId: groupId, usuarioId } }),
    onSuccess: () => {
      setQ('')
      queryClient.invalidateQueries({ queryKey: ['grupo', groupId] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Error al invitar'),
  })

  const back =
    detalle.data?.grupo?.tipo === 'proyecto' && detalle.data?.grupo?.proyecto_id
      ? `/mi-proyecto/${detalle.data.grupo.proyecto_id}`
      : '/grupos'

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="cn-glass flex min-h-[70vh] flex-col rounded-2xl border border-purple-500/20 p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link to={back as any} className="text-xs text-amber-300 hover:underline">
              ← Volver
            </Link>
            <h1 className="text-xl font-black text-white">{detalle.data?.grupo?.nombre || 'Grupo'}</h1>
            {detalle.data?.grupo?.rol_etiqueta && (
              <p className="text-xs text-purple-200/70">{detalle.data.grupo.rol_etiqueta}</p>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300/70">Invitar miembro</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre u oficio…"
            className="mb-2 w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
          />
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {(busqueda.data?.items || []).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm text-purple-100">
                <span>
                  {p.nombre}
                  {p.habilidad_empirica ? ` · ${p.habilidad_empirica}` : ''}
                </span>
                <button
                  type="button"
                  className="text-xs font-bold text-amber-300 hover:underline"
                  onClick={() => inviteMutation.mutate(p.id)}
                >
                  Invitar
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3">
          {(mensajes.data?.items || []).map((m: any) => (
            <div key={m.id} className="rounded-lg bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-200/90">
                {m.perfiles?.nombre || 'Miembro'}
              </p>
              <p className="text-sm text-purple-50">{m.cuerpo}</p>
            </div>
          ))}
          {!mensajes.isLoading && !(mensajes.data?.items || []).length && (
            <p className="text-sm text-purple-200/50">Sin mensajes aún. Escribe el primero.</p>
          )}
        </div>

        {err && <p className="mb-2 text-sm text-red-300">{err}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            sendMutation.mutate()
          }}
        >
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            className="flex-1 rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
            placeholder="Escribe un mensaje…"
          />
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950"
          >
            Enviar
          </button>
        </form>
      </div>
    </AppShell>
  )
}
