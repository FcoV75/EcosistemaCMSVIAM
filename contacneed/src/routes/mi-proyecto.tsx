import { Link, Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { useIdentity } from '../lib/identity-context'
import { getServerUserFn } from '../server/auth.functions'
import {
  createProyectoFn,
  deleteProyectoFn,
  listMisProyectosFn,
  updateProyectoFn,
} from '../server/grupos-proyectos.functions'

export const Route = createFileRoute('/mi-proyecto')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: MiProyectoPage,
})

const TIPOS = [
  'edificio',
  'escuela',
  'hospital',
  'salon',
  'residencial',
  'infraestructura',
  'otro',
]

function MiProyectoPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isChildRoute = pathname !== '/mi-proyecto' && pathname.startsWith('/mi-proyecto/')

  const { isPro } = useIdentity()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [tipo, setTipo] = useState('edificio')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTermino, setFechaTermino] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTipo, setEditTipo] = useState('edificio')

  const listQuery = useQuery({
    queryKey: ['mis-proyectos'],
    queryFn: () => listMisProyectosFn(),
    enabled: isPro && !isChildRoute,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createProyectoFn({
        data: {
          nombre,
          descripcion: desc,
          tipo_obra: tipo,
          fecha_inicio: fechaInicio || undefined,
          fecha_probable_termino: fechaTermino || undefined,
        },
      }),
    onSuccess: () => {
      setNombre('')
      setDesc('')
      setFechaInicio('')
      setFechaTermino('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['mis-proyectos'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateProyectoFn({
        data: {
          proyectoId: editingId!,
          nombre: editNombre,
          descripcion: editDesc,
          tipo_obra: editTipo,
        },
      }),
    onSuccess: () => {
      setEditingId(null)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['mis-proyectos'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo editar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (proyectoId: string) => deleteProyectoFn({ data: { proyectoId } }),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['mis-proyectos'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo borrar'),
  })

  // Hooks deben correr siempre: si se hace return antes, React rompe al abrir el proyecto.
  if (isChildRoute) return <Outlet />

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="cn-glass rounded-2xl border border-purple-500/20 p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Building2 className="text-amber-400" size={22} />
          <h1 className="text-2xl font-black text-white">Mi Proyecto</h1>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
            PRO
          </span>
          <SectionHelpHint
            title="¿Cómo usar Mi Proyecto?"
            text="Crea un proyecto serio (edificio, escuela, hospital…). Dentro arma grupos estratégicos, lleva finanzas e imprevistos. Tú lo concluyes y eliges qué grupos quedan para mantenimiento."
          />
        </div>

        {!isPro ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-5 text-sm text-amber-50">
            <p className="font-semibold">Mi Proyecto es ContacNeed PRO</p>
            <p className="mt-2 text-amber-100/80">
              Coordina obras grandes con grupos por oficio, presupuesto y bitácora hasta concluir y
              dejar solo el equipo de mantenimiento.
            </p>
            <button
              type="button"
              onClick={() => setShowStripeModal(true)}
              className="cn-btn-metallic mt-4 rounded-xl px-4 py-2 text-sm font-bold text-slate-950"
            >
              Subir a PRO
            </button>
          </div>
        ) : (
          <>
            <form
              className="mb-6 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate()
              }}
            >
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-purple-200/80">Nombre del proyecto</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Ej. Hospital regional, Torre oficinas…"
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-purple-200/80">Tipo de obra</span>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-purple-200/80">Fecha de inicio</span>
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
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-purple-200/80">Descripción</span>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                />
              </label>
              {error && <p className="text-sm text-red-300 sm:col-span-2">{error}</p>}
              {listQuery.isError && (
                <p className="text-sm text-red-300 sm:col-span-2">
                  No se pudieron cargar proyectos:{' '}
                  {listQuery.error instanceof Error
                    ? listQuery.error.message
                    : 'error desconocido'}
                </p>
              )}
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
              >
                {createMutation.isPending ? 'Creando…' : 'Crear proyecto'}
              </button>
            </form>

            <SectionList
              title="Tus proyectos"
              items={listQuery.data?.propios || []}
              canManage
              editingId={editingId}
              editNombre={editNombre}
              editDesc={editDesc}
              editTipo={editTipo}
              tipos={TIPOS}
              onStartEdit={(p) => {
                setEditingId(p.id)
                setEditNombre(p.nombre || '')
                setEditDesc(p.descripcion || '')
                setEditTipo(p.tipo_obra || 'otro')
              }}
              onCancelEdit={() => setEditingId(null)}
              onChangeEditNombre={setEditNombre}
              onChangeEditDesc={setEditDesc}
              onChangeEditTipo={setEditTipo}
              onSaveEdit={() => updateMutation.mutate()}
              onDelete={(p) => {
                if (
                  !window.confirm(
                    `¿Borrar el proyecto «${p.nombre}» y sus grupos? Esta acción no se puede deshacer.`,
                  )
                )
                  return
                deleteMutation.mutate(p.id)
              }}
            />
            <SectionList title="Colaboras en" items={listQuery.data?.colaborando || []} />
            {!listQuery.isLoading &&
              !(listQuery.data?.propios || []).length &&
              !(listQuery.data?.colaborando || []).length &&
              !listQuery.isError && (
                <p className="text-sm text-purple-200/60">
                  Aún no tienes proyectos. Crea el primero arriba y luego arma grupos estratégicos.
                </p>
              )}
          </>
        )}
      </div>
    </AppShell>
  )
}

function SectionList({
  title,
  items,
  canManage = false,
  editingId,
  editNombre = '',
  editDesc = '',
  editTipo = 'otro',
  tipos = [],
  onStartEdit,
  onCancelEdit,
  onChangeEditNombre,
  onChangeEditDesc,
  onChangeEditTipo,
  onSaveEdit,
  onDelete,
}: {
  title: string
  items: any[]
  canManage?: boolean
  editingId?: string | null
  editNombre?: string
  editDesc?: string
  editTipo?: string
  tipos?: string[]
  onStartEdit?: (p: any) => void
  onCancelEdit?: () => void
  onChangeEditNombre?: (v: string) => void
  onChangeEditDesc?: (v: string) => void
  onChangeEditTipo?: (v: string) => void
  onSaveEdit?: () => void
  onDelete?: (p: any) => void
}) {
  if (!items.length) return null
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-300/70">{title}</h2>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            {canManage && editingId === p.id ? (
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  onSaveEdit?.()
                }}
              >
                <input
                  value={editNombre}
                  onChange={(e) => onChangeEditNombre?.(e.target.value)}
                  className="w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
                  required
                />
                <select
                  value={editTipo}
                  onChange={(e) => onChangeEditTipo?.(e.target.value)}
                  className="w-full rounded-lg border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
                >
                  {tipos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <textarea
                  value={editDesc}
                  onChange={(e) => onChangeEditDesc?.(e.target.value)}
                  rows={2}
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
                    onClick={() => onCancelEdit?.()}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/mi-proyecto/$projectId"
                  params={{ projectId: p.id }}
                  className="min-w-0 flex-1 transition hover:opacity-90"
                >
                  <p className="font-semibold text-white">{p.nombre}</p>
                  <p className="text-xs text-purple-200/60">
                    {p.tipo_obra} · {p.estatus}
                    {p.fecha_inicio ? ` · inicio ${p.fecha_inicio}` : ''}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  {canManage && p.estatus !== 'concluido' && (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border border-white/15 px-2 py-1 text-[11px] font-bold text-purple-100 hover:bg-white/10"
                        onClick={() => onStartEdit?.(p)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-400/30 px-2 py-1 text-[11px] font-bold text-red-200 hover:bg-red-950/40"
                        onClick={() => onDelete?.(p)}
                      >
                        Borrar
                      </button>
                    </>
                  )}
                  <Link
                    to="/mi-proyecto/$projectId"
                    params={{ projectId: p.id }}
                    className="text-xs font-bold text-amber-300"
                  >
                    Abrir →
                  </Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
