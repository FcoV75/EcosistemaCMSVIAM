import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { getServerUserFn } from '../server/auth.functions'
import {
  concluirProyectoFn,
  createGrupoProyectoFn,
  getProyectoDetalleFn,
} from '../server/grupos-proyectos.functions'

export const Route = createFileRoute('/mi-proyecto/$projectId')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: ProyectoDetallePage,
})

function ProyectoDetallePage() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('arquitectos')
  const [error, setError] = useState<string | null>(null)
  const [keep, setKeep] = useState<Record<string, boolean>>({})

  const detalle = useQuery({
    queryKey: ['proyecto', projectId],
    queryFn: () => getProyectoDetalleFn({ data: { proyectoId: projectId } }),
  })

  const grupos = detalle.data?.grupos || []
  const esOwner = Boolean(detalle.data?.esOwner)
  const concluido = detalle.data?.proyecto?.estatus === 'concluido'

  const createMutation = useMutation({
    mutationFn: () =>
      createGrupoProyectoFn({
        data: { proyectoId: projectId, nombre, rol_etiqueta: rol },
      }),
    onSuccess: () => {
      setNombre('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['proyecto', projectId] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const concluirMutation = useMutation({
    mutationFn: () =>
      concluirProyectoFn({
        data: {
          proyectoId: projectId,
          gruposMantenimientoIds: Object.entries(keep)
            .filter(([, v]) => v)
            .map(([id]) => id),
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proyecto', projectId] }),
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const keepCount = useMemo(() => Object.values(keep).filter(Boolean).length, [keep])

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="cn-glass rounded-2xl border border-purple-500/20 p-4 md:p-6">
        <Link to="/mi-proyecto" className="text-xs text-amber-300 hover:underline">
          ← Mis proyectos
        </Link>
        <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-white">
            {detalle.data?.proyecto?.nombre || 'Proyecto'}
          </h1>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase text-purple-200">
            {detalle.data?.proyecto?.estatus}
          </span>
          <SectionHelpHint
            title="Grupos del proyecto"
            text="Aquí solo ves grupos estratégicos de esta obra. Invita a cada rol, comunícate hasta concluir y marca qué grupos quedan para mantenimiento."
          />
        </div>
        <p className="mb-6 text-sm text-purple-200/70">
          {detalle.data?.proyecto?.descripcion || 'Sin descripción'} ·{' '}
          {detalle.data?.proyecto?.tipo_obra}
        </p>

        {esOwner && !concluido && (
          <form
            className="mb-6 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300/70 sm:col-span-2">
              Nuevo grupo estratégico
            </p>
            <label className="text-sm">
              <span className="mb-1 block text-purple-200/80">Nombre</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                placeholder="Ej. Arquitectura, Albañilería…"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-purple-200/80">Rol / etiqueta</span>
              <input
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                placeholder="arquitectos, proveedores…"
              />
            </label>
            <button
              type="submit"
              className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
            >
              Crear grupo del proyecto
            </button>
          </form>
        )}

        <ul className="mb-8 space-y-2">
          {grupos.map((g: any) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-white">{g.nombre}</p>
                <p className="text-xs text-purple-200/60">
                  {g.rol_etiqueta || 'grupo'}
                  {g.mantenimiento ? ' · mantenimiento' : ''}
                </p>
              </div>
              <Link
                to="/grupos/$groupId"
                params={{ groupId: g.id }}
                className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-200"
              >
                Abrir
              </Link>
            </li>
          ))}
          {!grupos.length && (
            <p className="text-sm text-purple-200/60">Aún no hay grupos estratégicos en este proyecto.</p>
          )}
        </ul>

        {esOwner && !concluido && grupos.length > 0 && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-950/20 p-4">
            <h2 className="mb-2 text-sm font-bold text-amber-100">Concluir proyecto</h2>
            <p className="mb-3 text-xs text-amber-100/75">
              Marca qué grupos quedan para mantenimiento común. Los demás se archivan.
            </p>
            <ul className="mb-4 space-y-2">
              {grupos.map((g: any) => (
                <li key={g.id}>
                  <label className="flex items-center gap-2 text-sm text-purple-100">
                    <input
                      type="checkbox"
                      checked={Boolean(keep[g.id])}
                      onChange={(e) => setKeep((prev) => ({ ...prev, [g.id]: e.target.checked }))}
                    />
                    Mantener «{g.nombre}»
                  </label>
                </li>
              ))}
            </ul>
            {error && <p className="mb-2 text-sm text-red-300">{error}</p>}
            <button
              type="button"
              disabled={concluirMutation.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Concluir la obra? Quedarán ${keepCount} grupo(s) de mantenimiento.`,
                  )
                )
                  return
                concluirMutation.mutate()
              }}
              className="rounded-xl border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-100"
            >
              {concluirMutation.isPending ? 'Guardando…' : 'Marcar obra concluida'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
