import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { getServerUserFn } from '../server/auth.functions'
import {
  buscarMiembrosParaInvitarFn,
  deleteGrupoFn,
  enviarMensajeGrupoFn,
  getGrupoDetalleFn,
  getGrupoMensajesFn,
  invitarAGrupoFn,
  updateGrupoFn,
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc, setEditDesc] = useState('')

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
      setErr(null)
      queryClient.invalidateQueries({ queryKey: ['grupo-msgs', groupId] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Error'),
  })

  const inviteMutation = useMutation({
    mutationFn: (usuarioId: string) => invitarAGrupoFn({ data: { grupoId: groupId, usuarioId } }),
    onSuccess: () => {
      setQ('')
      setErr(null)
      queryClient.invalidateQueries({ queryKey: ['grupo', groupId] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Error al invitar'),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateGrupoFn({
        data: { grupoId: groupId, nombre: editNombre, descripcion: editDesc },
      }),
    onSuccess: () => {
      setEditing(false)
      setErr(null)
      queryClient.invalidateQueries({ queryKey: ['grupo', groupId] })
      queryClient.invalidateQueries({ queryKey: ['grupos-comunes'] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo editar'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteGrupoFn({ data: { grupoId: groupId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-comunes'] })
      const proyectoId = detalle.data?.grupo?.proyecto_id
      if (proyectoId) {
        navigate({ to: '/mi-proyecto/$projectId', params: { projectId: proyectoId } })
      } else {
        navigate({ to: '/grupos' })
      }
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo borrar'),
  })

  const back =
    detalle.data?.grupo?.tipo === 'proyecto' && detalle.data?.grupo?.proyecto_id
      ? `/mi-proyecto/${detalle.data.grupo.proyecto_id}`
      : '/grupos'
  const esOwner = Boolean(detalle.data?.esOwner)

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="cn-glass flex min-h-[70vh] flex-col rounded-2xl border border-purple-500/20 p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link to={back as any} className="text-xs text-amber-300 hover:underline">
              ← Volver
            </Link>
            <h1 className="text-xl font-black text-white">
              {detalle.data?.grupo?.nombre || 'Grupo'}
            </h1>
            {detalle.data?.grupo?.rol_etiqueta && (
              <p className="text-xs text-purple-200/70">{detalle.data.grupo.rol_etiqueta}</p>
            )}
            {detalle.data?.grupo?.descripcion && (
              <p className="mt-1 text-xs text-purple-200/55">{detalle.data.grupo.descripcion}</p>
            )}
          </div>
          {esOwner && !editing && (
            <div className="flex gap-2">
              <button
                type="button"
                title="Editar grupo"
                className="rounded-lg border border-white/15 p-2 text-purple-100 hover:bg-white/10"
                onClick={() => {
                  setEditNombre(detalle.data?.grupo?.nombre || '')
                  setEditDesc(detalle.data?.grupo?.descripcion || '')
                  setEditing(true)
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                title="Borrar grupo"
                className="rounded-lg border border-red-400/30 p-2 text-red-200 hover:bg-red-950/40"
                onClick={() => {
                  if (
                    !window.confirm(
                      `¿Borrar «${detalle.data?.grupo?.nombre}»? Dejará de aparecer para todos.`,
                    )
                  )
                    return
                  deleteMutation.mutate()
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {detalle.isError && (
          <p className="mb-3 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm text-red-100">
            No se pudo abrir el grupo:{' '}
            {detalle.error instanceof Error ? detalle.error.message : 'error desconocido'}
          </p>
        )}
        {mensajes.isError && (
          <p className="mb-3 text-sm text-red-300">
            No se pudieron cargar mensajes:{' '}
            {mensajes.error instanceof Error ? mensajes.error.message : 'error'}
          </p>
        )}

        {editing && (
          <form
            className="mb-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              updateMutation.mutate()
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300/70">
              Editar grupo
            </p>
            <input
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              className="w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
              required
            />
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descripción"
              className="w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-bold text-white"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-purple-100"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {esOwner && (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300/70">
              Invitar miembro
            </p>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre u oficio…"
              className="mb-2 w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
            />
            <ul className="max-h-28 space-y-1 overflow-y-auto">
              {(busqueda.data?.items || []).map((p: any) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-sm text-purple-100"
                >
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
            {(detalle.data?.miembros || []).length > 0 && (
              <p className="mt-2 text-[11px] text-purple-200/50">
                Miembros: {(detalle.data?.miembros || []).length}
              </p>
            )}
          </div>
        )}

        <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3">
          {(mensajes.data?.items || []).map((m: any) => (
            <div key={m.id} className="rounded-lg bg-white/5 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-200/90">
                {m.perfiles?.nombre || 'Miembro'}
              </p>
              <p className="text-sm text-purple-50">{m.cuerpo}</p>
            </div>
          ))}
          {!mensajes.isLoading && !(mensajes.data?.items || []).length && !mensajes.isError && (
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
            disabled={sendMutation.isPending || detalle.isError}
            className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950"
          >
            Enviar
          </button>
        </form>
      </div>
    </AppShell>
  )
}
