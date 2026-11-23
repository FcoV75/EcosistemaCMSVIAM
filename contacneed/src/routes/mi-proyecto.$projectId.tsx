import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { MemberInvitePicker } from '../components/MemberInvitePicker'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { useIdentity } from '../lib/identity-context'
import { getServerUserFn } from '../server/auth.functions'
import {
  addProyectoImprevistoFn,
  addProyectoMovimientoFn,
  concluirProyectoFn,
  createGrupoProyectoFn,
  deleteGrupoFn,
  deleteProyectoFn,
  getProyectoDetalleFn,
  updateGrupoFn,
  updateGrupoPresupuestoFn,
  updateProyectoFechasFn,
  updateProyectoFn,
} from '../server/grupos-proyectos.functions'

export const Route = createFileRoute('/mi-proyecto/$projectId')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: ProyectoDetallePage,
})

type Tab = 'resumen' | 'grupos' | 'finanzas' | 'imprevistos' | 'conclusion'

type Persona = {
  id: string
  nombre?: string | null
  habilidad_empirica?: string | null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'imprevistos', label: 'Imprevistos' },
  { id: 'conclusion', label: 'Conclusión' },
]

function money(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function ProyectoDetallePage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useIdentity()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [tab, setTab] = useState<Tab>('resumen')
  const [error, setError] = useState<string | null>(null)
  const [editingProyecto, setEditingProyecto] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTipo, setEditTipo] = useState('otro')
  const [editingGrupoId, setEditingGrupoId] = useState<string | null>(null)
  const [editGrupoNombre, setEditGrupoNombre] = useState('')
  const [editGrupoRol, setEditGrupoRol] = useState('')

  // Grupos form
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('arquitectos')
  const [presupuesto, setPresupuesto] = useState('')
  const [invitados, setInvitados] = useState<Persona[]>([])

  // Fechas
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTermino, setFechaTermino] = useState('')

  // Finanzas
  const [movTipo, setMovTipo] = useState<'ingreso' | 'egreso'>('egreso')
  const [movCat, setMovCat] = useState('materiales')
  const [movMonto, setMovMonto] = useState('')
  const [movConcepto, setMovConcepto] = useState('')
  const [movFecha, setMovFecha] = useState('')
  const [movGrupo, setMovGrupo] = useState('')

  // Imprevistos
  const [impTitulo, setImpTitulo] = useState('')
  const [impDesc, setImpDesc] = useState('')
  const [impImpacto, setImpImpacto] = useState('otro')
  const [impMonto, setImpMonto] = useState('')
  const [impFecha, setImpFecha] = useState('')

  const [keep, setKeep] = useState<Record<string, boolean>>({})

  const detalle = useQuery({
    queryKey: ['proyecto', projectId],
    queryFn: () => getProyectoDetalleFn({ data: { proyectoId: projectId } }),
  })

  useEffect(() => {
    const p = detalle.data?.proyecto
    if (!p) return
    setFechaInicio(p.fecha_inicio || '')
    setFechaTermino(p.fecha_probable_termino || '')
  }, [detalle.data?.proyecto?.id, detalle.data?.proyecto?.fecha_inicio, detalle.data?.proyecto?.fecha_probable_termino])

  const grupos = detalle.data?.grupos || []
  const esOwner = Boolean(detalle.data?.esOwner)
  const concluido = detalle.data?.proyecto?.estatus === 'concluido'
  const finanzas = detalle.data?.finanzas
  const tiempo = detalle.data?.tiempo

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['proyecto', projectId] })
    queryClient.invalidateQueries({ queryKey: ['mis-proyectos'] })
  }

  const createGrupoMutation = useMutation({
    mutationFn: () =>
      createGrupoProyectoFn({
        data: {
          proyectoId: projectId,
          nombre,
          rol_etiqueta: rol,
          presupuesto_asignado: Number(presupuesto) || 0,
          miembroIds: invitados.map((p) => p.id),
        },
      }),
    onSuccess: () => {
      setNombre('')
      setPresupuesto('')
      setInvitados([])
      setError(null)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const fechasMutation = useMutation({
    mutationFn: () =>
      updateProyectoFechasFn({
        data: {
          proyectoId: projectId,
          fecha_inicio: fechaInicio || undefined,
          fecha_probable_termino: fechaTermino || undefined,
        },
      }),
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const updateProyectoMutation = useMutation({
    mutationFn: () =>
      updateProyectoFn({
        data: {
          proyectoId: projectId,
          nombre: editNombre,
          descripcion: editDesc,
          tipo_obra: editTipo,
        },
      }),
    onSuccess: () => {
      setEditingProyecto(false)
      setError(null)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo editar'),
  })

  const deleteProyectoMutation = useMutation({
    mutationFn: () => deleteProyectoFn({ data: { proyectoId: projectId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-proyectos'] })
      navigate({ to: '/mi-proyecto' })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo borrar'),
  })

  const updateGrupoMutation = useMutation({
    mutationFn: () =>
      updateGrupoFn({
        data: {
          grupoId: editingGrupoId!,
          nombre: editGrupoNombre,
          rol_etiqueta: editGrupoRol,
        },
      }),
    onSuccess: () => {
      setEditingGrupoId(null)
      setError(null)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo editar el grupo'),
  })

  const deleteGrupoMutation = useMutation({
    mutationFn: (grupoId: string) => deleteGrupoFn({ data: { grupoId } }),
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo borrar el grupo'),
  })

  const presupuestoMutation = useMutation({
    mutationFn: (payload: { grupoId: string; presupuesto_asignado: number }) =>
      updateGrupoPresupuestoFn({ data: payload }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const movMutation = useMutation({
    mutationFn: () =>
      addProyectoMovimientoFn({
        data: {
          proyectoId: projectId,
          tipo: movTipo,
          categoria: movCat,
          monto: Number(movMonto),
          concepto: movConcepto,
          fecha: movFecha || undefined,
          grupoId: movGrupo || undefined,
        },
      }),
    onSuccess: () => {
      setMovMonto('')
      setMovConcepto('')
      setError(null)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const impMutation = useMutation({
    mutationFn: () =>
      addProyectoImprevistoFn({
        data: {
          proyectoId: projectId,
          titulo: impTitulo,
          descripcion: impDesc,
          impacto: impImpacto,
          monto: impMonto ? Number(impMonto) : undefined,
          fecha: impFecha || undefined,
        },
      }),
    onSuccess: () => {
      setImpTitulo('')
      setImpDesc('')
      setImpMonto('')
      setError(null)
      invalidate()
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
    onSuccess: () => {
      setError(null)
      invalidate()
    },
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
        <div className="mt-2 mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-white">
            {detalle.data?.proyecto?.nombre || 'Proyecto'}
          </h1>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase text-purple-200">
            {detalle.data?.proyecto?.estatus}
          </span>
          <SectionHelpHint
            title="Panel del proyecto"
            text="Resumen de tiempo y dinero, grupos estratégicos con presupuesto, finanzas, imprevistos y conclusión con grupos de mantenimiento. Puedes editar o borrar si eres el dueño."
          />
          {esOwner && !concluido && (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                title="Editar proyecto"
                className="rounded-lg border border-white/15 p-2 text-purple-100 hover:bg-white/10"
                onClick={() => {
                  setEditNombre(detalle.data?.proyecto?.nombre || '')
                  setEditDesc(detalle.data?.proyecto?.descripcion || '')
                  setEditTipo(detalle.data?.proyecto?.tipo_obra || 'otro')
                  setEditingProyecto(true)
                  setTab('resumen')
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                title="Borrar proyecto"
                className="rounded-lg border border-red-400/30 p-2 text-red-200 hover:bg-red-950/40"
                onClick={() => {
                  if (
                    !window.confirm(
                      `¿Borrar «${detalle.data?.proyecto?.nombre}» y todos sus grupos? No se puede deshacer.`,
                    )
                  )
                    return
                  deleteProyectoMutation.mutate()
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
        <p className="mb-4 text-sm text-purple-200/70">
          {detalle.data?.proyecto?.descripcion || 'Sin descripción'} ·{' '}
          {detalle.data?.proyecto?.tipo_obra}
        </p>

        {detalle.isError && (
          <p className="mb-4 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm text-red-100">
            No se pudo cargar el proyecto:{' '}
            {detalle.error instanceof Error ? detalle.error.message : 'error desconocido'}
          </p>
        )}

        {editingProyecto && esOwner && (
          <form
            className="mb-4 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              updateProyectoMutation.mutate()
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300/70 sm:col-span-2">
              Editar proyecto
            </p>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-purple-200/80">Nombre</span>
              <input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-purple-200/80">Tipo</span>
              <input
                value={editTipo}
                onChange={(e) => setEditTipo(e.target.value)}
                className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-purple-200/80">Descripción</span>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-purple-100"
                onClick={() => setEditingProyecto(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <nav className="mb-5 flex flex-wrap gap-1 border-b border-white/10 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setError(null)
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === t.id
                  ? 'bg-amber-500/20 text-amber-100'
                  : 'text-purple-200/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        {tab === 'resumen' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Ingresos"
                value={money(finanzas?.ingresos || 0)}
                tone="emerald"
              />
              <StatCard label="Egresos" value={money(finanzas?.egresos || 0)} tone="rose" />
              <StatCard
                label="Balance"
                value={money(finanzas?.balance || 0)}
                tone={(finanzas?.balance || 0) >= 0 ? 'amber' : 'rose'}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300/70">
                Avance de tiempo
              </p>
              {tiempo?.pctTiempo != null ? (
                <>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-amber-400/80"
                      style={{ width: `${Math.min(100, tiempo.pctTiempo)}%` }}
                    />
                  </div>
                  <p className="text-sm text-purple-100">
                    {tiempo.diasTranscurridos} / {tiempo.diasTotales} días ({tiempo.pctTiempo}%)
                  </p>
                </>
              ) : (
                <p className="text-sm text-purple-200/55">
                  Define fecha de inicio y término probable para ver el avance.
                </p>
              )}
            </div>

            {esOwner && !concluido && (
              <form
                className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  fechasMutation.mutate()
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300/70 sm:col-span-2">
                  Fechas del proyecto
                </p>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Inicio</span>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Término probable</span>
                  <input
                    type="date"
                    value={fechaTermino}
                    onChange={(e) => setFechaTermino(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={fechasMutation.isPending}
                  className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
                >
                  {fechasMutation.isPending ? 'Guardando…' : 'Guardar fechas'}
                </button>
              </form>
            )}

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300/70">
                Presupuesto vs gasto por grupo
              </p>
              {grupos.length === 0 ? (
                <p className="text-sm text-purple-200/55">Aún no hay grupos estratégicos.</p>
              ) : (
                <ul className="space-y-2">
                  {grupos.map((g: any) => {
                    const gastado = finanzas?.gastoPorGrupo?.[g.id] || 0
                    const asig = Number(g.presupuesto_asignado || 0)
                    const pct = asig > 0 ? Math.min(100, Math.round((gastado / asig) * 100)) : 0
                    return (
                      <li key={g.id} className="text-sm">
                        <div className="mb-1 flex justify-between text-purple-100">
                          <span>{g.nombre}</span>
                          <span className="text-xs text-purple-200/60">
                            {money(gastado)} / {money(asig)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${pct > 90 ? 'bg-rose-400/80' : 'bg-emerald-400/70'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'grupos' && (
          <div className="space-y-4">
            {esOwner && !concluido && (
              <form
                className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  createGrupoMutation.mutate()
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
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-purple-200/80">Presupuesto asignado (MXN)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={presupuesto}
                    onChange={(e) => setPresupuesto(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="0"
                  />
                </label>
                <MemberInvitePicker
                  selected={invitados}
                  onChange={setInvitados}
                  excludeIds={user?.id ? [user.id] : []}
                  label="Invitar al grupo (opcional)"
                />
                <button
                  type="submit"
                  disabled={createGrupoMutation.isPending}
                  className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
                >
                  {createGrupoMutation.isPending ? 'Creando…' : 'Crear grupo del proyecto'}
                </button>
              </form>
            )}

            <ul className="space-y-2">
              {grupos.map((g: any) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  {editingGrupoId === g.id ? (
                    <form
                      className="grid gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        updateGrupoMutation.mutate()
                      }}
                    >
                      <input
                        value={editGrupoNombre}
                        onChange={(e) => setEditGrupoNombre(e.target.value)}
                        className="w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
                        required
                      />
                      <input
                        value={editGrupoRol}
                        onChange={(e) => setEditGrupoRol(e.target.value)}
                        placeholder="Rol / etiqueta"
                        className="w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-purple-100"
                          onClick={() => setEditingGrupoId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">{g.nombre}</p>
                          <p className="text-xs text-purple-200/60">
                            {g.rol_etiqueta || 'grupo'}
                            {g.mantenimiento ? ' · mantenimiento' : ''}
                            {' · '}
                            presupuesto {money(Number(g.presupuesto_asignado || 0))}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {esOwner && !concluido && (
                            <>
                              <button
                                type="button"
                                className="rounded-lg border border-white/15 px-2 py-1 text-[11px] font-bold text-purple-100"
                                onClick={() => {
                                  setEditingGrupoId(g.id)
                                  setEditGrupoNombre(g.nombre || '')
                                  setEditGrupoRol(g.rol_etiqueta || '')
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-red-400/30 px-2 py-1 text-[11px] font-bold text-red-200"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `¿Borrar el grupo «${g.nombre}» de este proyecto?`,
                                    )
                                  )
                                    return
                                  deleteGrupoMutation.mutate(g.id)
                                }}
                              >
                                Borrar
                              </button>
                            </>
                          )}
                          <Link
                            to="/grupos/$groupId"
                            params={{ groupId: g.id }}
                            className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-200"
                          >
                            Abrir chat
                          </Link>
                        </div>
                      </div>
                      {esOwner && !concluido && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            defaultValue={Number(g.presupuesto_asignado || 0)}
                            id={`presu-${g.id}`}
                            className="w-36 rounded-lg border border-purple-500/25 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            className="text-xs font-bold text-amber-300 hover:underline"
                            onClick={() => {
                              const el = document.getElementById(
                                `presu-${g.id}`,
                              ) as HTMLInputElement | null
                              presupuestoMutation.mutate({
                                grupoId: g.id,
                                presupuesto_asignado: Number(el?.value || 0),
                              })
                            }}
                          >
                            Actualizar presupuesto
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
              {!grupos.length && (
                <p className="text-sm text-purple-200/60">
                  Aún no hay grupos estratégicos en este proyecto.
                </p>
              )}
            </ul>
          </div>
        )}

        {tab === 'finanzas' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Ingresos" value={money(finanzas?.ingresos || 0)} tone="emerald" />
              <StatCard label="Egresos" value={money(finanzas?.egresos || 0)} tone="rose" />
              <StatCard label="Balance" value={money(finanzas?.balance || 0)} tone="amber" />
            </div>

            {esOwner && !concluido && (
              <form
                className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  movMutation.mutate()
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300/70 sm:col-span-2">
                  Registrar movimiento
                </p>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Tipo</span>
                  <select
                    value={movTipo}
                    onChange={(e) => setMovTipo(e.target.value as 'ingreso' | 'egreso')}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Categoría</span>
                  <select
                    value={movCat}
                    onChange={(e) => setMovCat(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  >
                    <option value="materiales">Materiales</option>
                    <option value="mano_obra">Mano de obra</option>
                    <option value="equipo">Equipo</option>
                    <option value="permisos">Permisos</option>
                    <option value="anticipo">Anticipo / cliente</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Monto (MXN)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={movMonto}
                    onChange={(e) => setMovMonto(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Fecha</span>
                  <input
                    type="date"
                    value={movFecha}
                    onChange={(e) => setMovFecha(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-purple-200/80">Concepto</span>
                  <input
                    required
                    value={movConcepto}
                    onChange={(e) => setMovConcepto(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Ej. Compra de cemento, Anticipo cliente…"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-purple-200/80">
                    Grupo (opcional, para egresos)
                  </span>
                  <select
                    value={movGrupo}
                    onChange={(e) => setMovGrupo(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  >
                    <option value="">— Sin grupo —</option>
                    {grupos.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={movMutation.isPending}
                  className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
                >
                  {movMutation.isPending ? 'Guardando…' : 'Registrar'}
                </button>
              </form>
            )}

            <ul className="space-y-2">
              {(detalle.data?.movimientos || []).map((m: any) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-white">{m.concepto}</p>
                    <p className="text-xs text-purple-200/55">
                      {m.fecha} · {m.categoria}
                      {m.grupo_id
                        ? ` · ${grupos.find((g: any) => g.id === m.grupo_id)?.nombre || 'grupo'}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`font-bold ${m.tipo === 'ingreso' ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {m.tipo === 'ingreso' ? '+' : '−'}
                    {money(Number(m.monto))}
                  </span>
                </li>
              ))}
              {!(detalle.data?.movimientos || []).length && (
                <p className="text-sm text-purple-200/60">Sin movimientos aún.</p>
              )}
            </ul>
          </div>
        )}

        {tab === 'imprevistos' && (
          <div className="space-y-4">
            {esOwner && !concluido && (
              <form
                className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  impMutation.mutate()
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300/70 sm:col-span-2">
                  Registrar imprevisto (bitácora)
                </p>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-purple-200/80">Título</span>
                  <input
                    required
                    value={impTitulo}
                    onChange={(e) => setImpTitulo(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Ej. Lluvia retrasó colado"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Impacto</span>
                  <select
                    value={impImpacto}
                    onChange={(e) => setImpImpacto(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  >
                    <option value="tiempo">Tiempo</option>
                    <option value="dinero">Dinero</option>
                    <option value="ambos">Ambos</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Monto (si aplica)</span>
                  <input
                    type="number"
                    min="0"
                    value={impMonto}
                    onChange={(e) => setImpMonto(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-purple-200/80">Fecha</span>
                  <input
                    type="date"
                    value={impFecha}
                    onChange={(e) => setImpFecha(e.target.value)}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-purple-200/80">Descripción</span>
                  <textarea
                    value={impDesc}
                    onChange={(e) => setImpDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={impMutation.isPending}
                  className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
                >
                  {impMutation.isPending ? 'Guardando…' : 'Añadir a bitácora'}
                </button>
              </form>
            )}

            <ul className="space-y-2">
              {(detalle.data?.imprevistos || []).map((i: any) => (
                <li
                  key={i.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <p className="font-semibold text-white">{i.titulo}</p>
                  <p className="text-xs text-purple-200/55">
                    {i.fecha} · impacto: {i.impacto}
                    {i.monto != null ? ` · ${money(Number(i.monto))}` : ''}
                  </p>
                  {i.descripcion && (
                    <p className="mt-1 text-sm text-purple-100/80">{i.descripcion}</p>
                  )}
                </li>
              ))}
              {!(detalle.data?.imprevistos || []).length && (
                <p className="text-sm text-purple-200/60">Sin imprevistos registrados.</p>
              )}
            </ul>
          </div>
        )}

        {tab === 'conclusion' && (
          <div className="space-y-4">
            {concluido ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-4 text-sm text-emerald-50">
                <p className="font-semibold">Obra marcada como concluida</p>
                <p className="mt-1 text-emerald-100/75">
                  Los grupos de mantenimiento siguen activos; el resto quedó archivado.
                </p>
                <ul className="mt-3 space-y-1">
                  {grupos
                    .filter((g: any) => g.mantenimiento)
                    .map((g: any) => (
                      <li key={g.id} className="text-emerald-100">
                        · {g.nombre}
                      </li>
                    ))}
                </ul>
              </div>
            ) : !esOwner ? (
              <p className="text-sm text-purple-200/70">
                Solo el dueño del proyecto puede concluir la obra.
              </p>
            ) : grupos.length === 0 ? (
              <p className="text-sm text-purple-200/70">
                Crea al menos un grupo estratégico antes de concluir.
              </p>
            ) : (
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
                          onChange={(e) =>
                            setKeep((prev) => ({ ...prev, [g.id]: e.target.checked }))
                          }
                        />
                        Mantener «{g.nombre}»
                      </label>
                    </li>
                  ))}
                </ul>
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
        )}
      </div>
    </AppShell>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'emerald' | 'rose' | 'amber'
}) {
  const tones = {
    emerald: 'border-emerald-400/25 text-emerald-100',
    rose: 'border-rose-400/25 text-rose-100',
    amber: 'border-amber-400/25 text-amber-100',
  }
  return (
    <div className={`rounded-xl border bg-black/25 px-4 py-3 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}
