import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Ban,
  BookOpen,
  CheckCircle2,
  Diamond,
  GraduationCap,
  Library,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import { buildCursoPromotoresUrl } from '../lib/curso-promotores-url'
import { MembershipAdminPanel } from '../components/admin/MembershipAdminPanel'
import { CursosEducativosAdminPanel } from '../components/admin/CursosEducativosAdminPanel'
import { PRODUCTO_NEXUS, PRODUCTO_VIDEO_DIAMANTE } from '../lib/membresias-viam'
import { requireAdminUserFn } from '../server/auth.functions'
import {
  approveProRequestFn,
  askAdminBotFn,
  banUserAdminFn,
  blockUserAdminFn,
  deletePostAdminFn,
  deleteUsersBulkFn,
  getAdminDashboardFn,
  moderatePostFn,
  rejectProRequestFn,
  updateUserAdminFn,
} from '../server/admin.functions'
import { getRankingPerfilesFn } from '../server/gamificacion.functions'
import { deleteAdFn, getAdminAdsFn, saveAdFn } from '../server/ads.functions'
import {
  bajaPromotorAdminFn,
  getPanelFundadorResumenFn,
  listPromotoresAdminFn,
  matricularPromotorAdminFn,
} from '../server/promotores.functions'

type AdminTab = 'contacneed' | 'fundador' | 'curso' | 'nexus' | 'video' | 'cursos'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const admin = await requireAdminUserFn()
    if (!admin) throw redirect({ to: '/' })
    return { admin }
  },
  component: AdminDashboard,
})

function AdminDashboard() {
  const queryClient = useQueryClient()
  const [adminTab, setAdminTab] = useState<AdminTab>('contacneed')
  const [botQuestion, setBotQuestion] = useState('')
  const [botAnswer, setBotAnswer] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [promotorEmail, setPromotorEmail] = useState('')
  const [promotorNombre, setPromotorNombre] = useState('')
  const [promotorMsg, setPromotorMsg] = useState<string | null>(null)
  const [cursoIframeUrl, setCursoIframeUrl] = useState<string | null>(null)
  const [cursoLoading, setCursoLoading] = useState(false)
  const [adForm, setAdForm] = useState({
    titulo: '',
    cuerpo: '',
    imagen_url: '',
    enlace_url: '',
    estado: '',
    tipo: 'banner',
    activo: true,
    prioridad: 0,
  })

  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => getAdminDashboardFn(),
    refetchInterval: false,
    enabled: adminTab === 'contacneed',
  })

  const adsQuery = useQuery({
    queryKey: ['admin-ads'],
    queryFn: () => getAdminAdsFn(),
    enabled: adminTab === 'contacneed',
  })

  const rankingQuery = useQuery({
    queryKey: ['admin-ranking'],
    queryFn: () => getRankingPerfilesFn(),
    enabled: adminTab === 'contacneed',
  })

  const fundadorQuery = useQuery({
    queryKey: ['panel-fundador'],
    queryFn: () => getPanelFundadorResumenFn(),
    enabled: adminTab === 'fundador',
  })

  const promotoresQuery = useQuery({
    queryKey: ['admin-promotores'],
    queryFn: () => listPromotoresAdminFn(),
    enabled: adminTab === 'fundador',
  })

  useEffect(() => {
    if (adminTab !== 'curso') return
    let cancelled = false
    setCursoLoading(true)
    buildCursoPromotoresUrl()
      .then((url) => {
        if (!cancelled) setCursoIframeUrl(url)
      })
      .catch(() => {
        if (!cancelled) setCursoIframeUrl('https://centromultidisciplinarioags.com/curso-promotores')
      })
      .finally(() => {
        if (!cancelled) setCursoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [adminTab])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['admin-ads'] })
    queryClient.invalidateQueries({ queryKey: ['posts'] })
    queryClient.invalidateQueries({ queryKey: ['banner-ads'] })
    queryClient.invalidateQueries({ queryKey: ['pro-panel'] })
    queryClient.invalidateQueries({ queryKey: ['panel-fundador'] })
    queryClient.invalidateQueries({ queryKey: ['admin-promotores'] })
  }

  const notifyError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback
    console.error(fallback, error)
    if (typeof window !== 'undefined') alert(message)
  }

  const notifyOk = (message: string) => {
    if (typeof window !== 'undefined') alert(message)
  }

  const moderateMutation = useMutation({
    mutationFn: (payload: { id: string; estatus: 'aprobado' | 'baneado' | 'pendiente' }) =>
      moderatePostFn({ data: payload }),
    onSuccess: () => {
      invalidateAll()
      notifyOk('Publicación actualizada')
    },
    onError: (error) => notifyError(error, 'No se pudo moderar la publicación'),
  })

  const deleteMutation = useMutation({
    mutationFn: (payload: { id: string }) => deletePostAdminFn({ data: payload }),
    onSuccess: invalidateAll,
    onError: (error) => notifyError(error, 'No se pudo eliminar la publicación'),
  })

  const userMutation = useMutation({
    mutationFn: (payload: { id: string; es_pro?: boolean; is_admin?: boolean }) =>
      updateUserAdminFn({ data: payload }),
    onSuccess: (result) => {
      invalidateAll()
      if (result && 'legacyCode' in result && result.legacyCode) {
        if (result.emailed) {
          notifyOk(`PRO activado. Código ${result.legacyCode} enviado por correo.`)
        } else {
          notifyOk(
            `PRO activado. Código ${result.legacyCode}.${result.emailWarning ? ` ${result.emailWarning}` : ''}`,
          )
        }
        return
      }
      notifyOk('Usuario actualizado')
    },
    onError: (error) => notifyError(error, 'No se pudo actualizar el usuario'),
  })

  const banUserMutation = useMutation({
    mutationFn: (payload: { id: string }) => banUserAdminFn({ data: payload }),
    onSuccess: () => {
      invalidateAll()
      notifyOk('Publicaciones del usuario baneadas')
    },
    onError: (error) => notifyError(error, 'No se pudieron banear las publicaciones'),
  })

  const blockUserMutation = useMutation({
    mutationFn: (payload: { id: string; bloqueado: boolean }) => blockUserAdminFn({ data: payload }),
    onSuccess: () => {
      invalidateAll()
      notifyOk('Estado de cuenta actualizado')
    },
    onError: (error) => notifyError(error, 'No se pudo suspender/reactivar al usuario'),
  })

  const approveProMutation = useMutation({
    mutationFn: (payload: { id: string }) => approveProRequestFn({ data: payload }),
    onSuccess: (result) => {
      invalidateAll()
      if (result && 'legacyCode' in result && result.legacyCode) {
        if (result.emailed) {
          notifyOk(`Solicitud PRO aprobada. Código ${result.legacyCode} enviado por correo.`)
        } else {
          notifyOk(
            `Solicitud PRO aprobada. Código ${result.legacyCode}.${result.emailWarning ? ` ${result.emailWarning}` : ''}`,
          )
        }
        return
      }
      notifyOk('Solicitud PRO aprobada')
    },
    onError: (error) => notifyError(error, 'No se pudo aprobar la solicitud PRO'),
  })

  const rejectProMutation = useMutation({
    mutationFn: (payload: { id: string }) => rejectProRequestFn({ data: payload }),
    onSuccess: invalidateAll,
    onError: (error) => notifyError(error, 'No se pudo rechazar la solicitud'),
  })

  const saveAdMutation = useMutation({
    mutationFn: (payload: typeof adForm) => saveAdFn({ data: payload }),
    onSuccess: () => {
      invalidateAll()
      setAdForm({
        titulo: '',
        cuerpo: '',
        imagen_url: '',
        enlace_url: '',
        estado: '',
        tipo: 'banner',
        activo: true,
        prioridad: 0,
      })
    },
  })

  const deleteAdMutation = useMutation({
    mutationFn: (payload: { id: string }) => deleteAdFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const adminBotMutation = useMutation({
    mutationFn: (question: string) => askAdminBotFn({ data: { question } }),
    onSuccess: (result) => setBotAnswer(result.answer),
  })

  const deleteUsersMutation = useMutation({
    mutationFn: (ids: string[]) => deleteUsersBulkFn({ data: { ids } }),
    onSuccess: () => {
      setSelectedUserIds(new Set())
      invalidateAll()
    },
  })

  const matricularMutation = useMutation({
    mutationFn: (payload: { email: string; nombre?: string }) =>
      matricularPromotorAdminFn({ data: payload }),
    onSuccess: (result) => {
      setPromotorMsg(result.nota || 'Promotor matriculado.')
      setPromotorEmail('')
      setPromotorNombre('')
      queryClient.invalidateQueries({ queryKey: ['admin-promotores'] })
      queryClient.invalidateQueries({ queryKey: ['panel-fundador'] })
    },
    onError: (error) => {
      setPromotorMsg(error instanceof Error ? error.message : 'No se pudo matricular')
    },
  })

  const bajaPromotorMutation = useMutation({
    mutationFn: (id: string) => bajaPromotorAdminFn({ data: { id } }),
    onSuccess: () => {
      setPromotorMsg('Matrícula revocada.')
      queryClient.invalidateQueries({ queryKey: ['admin-promotores'] })
      queryClient.invalidateQueries({ queryKey: ['panel-fundador'] })
    },
    onError: (error) => {
      setPromotorMsg(error instanceof Error ? error.message : 'No se pudo dar de baja')
    },
  })

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const data = dashboardQuery.data
  const promotoresActivos = (promotoresQuery.data?.promotores ?? []).filter((p) => p.status === 'active')
  const tabBtn = (id: AdminTab, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setAdminTab(id)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        adminTab === id
          ? 'bg-amber-500 text-slate-950'
          : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Plataforma de Administración</p>
            <h1 className="text-3xl font-black">ContacNeed Admin</h1>
            <p className="mt-2 text-sm text-slate-300">
              ContacNeed, Panel Fundador, Cursos Educativos, Curso Promotores, Sincronía Nexus y Video Diamante.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            <ArrowLeft size={16} />
            Volver a la pizarra
          </Link>
          {adminTab === 'contacneed' && (
            <button
              type="button"
              onClick={() => dashboardQuery.refetch()}
              disabled={dashboardQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw size={16} className={dashboardQuery.isFetching ? 'animate-spin' : ''} />
              {dashboardQuery.isFetching ? 'Actualizando...' : 'Actualizar datos'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {tabBtn('contacneed', 'ContacNeed', <LayoutDashboard size={16} />)}
          {tabBtn('fundador', 'Panel Fundador', <GraduationCap size={16} />)}
          {tabBtn('nexus', 'Sincronía Nexus', <Sparkles size={16} />)}
          {tabBtn('video', 'Video Diamante', <Diamond size={16} />)}
          {tabBtn('cursos', 'Cursos Educativos', <Library size={16} />)}
          {tabBtn('curso', 'Curso Promotores', <BookOpen size={16} />)}
        </div>

        {adminTab === 'cursos' && <CursosEducativosAdminPanel />}

        {adminTab === 'nexus' && (
          <MembershipAdminPanel
            producto={PRODUCTO_NEXUS}
            accentClass="text-violet-300 border-violet-500/30"
          />
        )}

        {adminTab === 'video' && (
          <MembershipAdminPanel
            producto={PRODUCTO_VIDEO_DIAMANTE}
            accentClass="text-amber-300 border-amber-500/30"
          />
        )}

        {adminTab === 'fundador' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-amber-500/25 bg-slate-900/80 p-4">
              <h2 className="text-lg font-bold text-amber-300">Panel Fundador — Ecosistema VIAM</h2>
              <p className="mt-1 text-sm text-slate-300">
                Matricula promotores para que vean el Curso Promotores desde su perfil ContacNeed.
              </p>
              {fundadorQuery.isError && (
                <p className="mt-3 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {fundadorQuery.error instanceof Error
                    ? fundadorQuery.error.message
                    : 'No se pudo cargar el panel'}
                </p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Entitlements" value={fundadorQuery.data?.resumen.total ?? 0} />
                <MetricCard label="Activos" value={fundadorQuery.data?.resumen.activos ?? 0} />
                <MetricCard
                  label="Usuarios con cuenta"
                  value={fundadorQuery.data?.resumen.usuariosConCuenta ?? 0}
                />
                <MetricCard label="Promotores activos" value={promotoresActivos.length} />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <h3 className="mb-2 text-sm font-bold text-sky-300">Productos</h3>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {Object.entries(fundadorQuery.data?.resumen.porProducto || {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2 border-b border-slate-800/60 pb-1">
                        <span>{fundadorQuery.data?.etiquetas[k] || k}</span>
                        <span className="font-bold text-amber-400">{v}</span>
                      </li>
                    ))}
                    {!fundadorQuery.data && (
                      <li className="text-slate-500">
                        {fundadorQuery.isLoading ? 'Cargando...' : 'Sin datos'}
                      </li>
                    )}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <h3 className="mb-2 text-sm font-bold text-sky-300">Últimos accesos</h3>
                  <div className="max-h-48 overflow-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="px-2 py-1">Producto</th>
                          <th className="px-2 py-1">Plan</th>
                          <th className="px-2 py-1">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(fundadorQuery.data?.entitlements ?? []).slice(0, 20).map((row) => (
                          <tr key={row.id} className="border-t border-slate-800/70">
                            <td className="px-2 py-1">
                              {fundadorQuery.data?.etiquetas[row.producto || ''] || row.producto}
                            </td>
                            <td className="px-2 py-1">{row.plan || '—'}</td>
                            <td className="px-2 py-1">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-sky-500/25 bg-slate-900/80 p-4">
              <h2 className="text-lg font-bold text-sky-300">Matrícula de promotores</h2>
              <p className="mt-1 text-sm text-slate-300">
                Quienes matricules aquí verán el acceso al Curso Promotores en su perfil activo.
              </p>
              <form
                className="mt-4 grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const email = promotorEmail.trim()
                  if (!email) return
                  setPromotorMsg(null)
                  matricularMutation.mutate({
                    email,
                    nombre: promotorNombre.trim() || undefined,
                  })
                }}
              >
                <input
                  type="email"
                  required
                  value={promotorEmail}
                  onChange={(e) => setPromotorEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={promotorNombre}
                  onChange={(e) => setPromotorNombre(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={matricularMutation.isPending}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 md:col-span-2 disabled:opacity-50"
                >
                  {matricularMutation.isPending ? 'Matriculando...' : 'Matricular promotor'}
                </button>
              </form>
              {promotorMsg && (
                <p className="mt-3 text-sm text-sky-200">{promotorMsg}</p>
              )}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Correo</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotoresActivos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-slate-500">
                          {promotoresQuery.isLoading
                            ? 'Cargando promotores...'
                            : 'Aún no hay promotores matriculados.'}
                        </td>
                      </tr>
                    )}
                    {promotoresActivos.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/80">
                        <td className="px-3 py-3">{p.email || '—'}</td>
                        <td className="px-3 py-3">{p.nombre || '—'}</td>
                        <td className="px-3 py-3 text-emerald-300">{p.status}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(`¿Dar de baja a ${p.email || 'este promotor'}?`)) return
                              bajaPromotorMutation.mutate(p.id)
                            }}
                            className="rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
                          >
                            Dar de baja
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setAdminTab('curso')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/10"
              >
                <BookOpen size={16} />
                Abrir Curso Promotores
              </button>
            </section>
          </div>
        )}

        {adminTab === 'curso' && (
          <section className="overflow-hidden rounded-2xl border border-sky-500/25 bg-slate-900/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div>
                <h2 className="text-lg font-bold text-sky-300">Curso intensivo de promotores</h2>
                <p className="text-xs text-slate-400">
                  Se abre con tu sesión ContacNeed (sin volver a iniciar sesión).
                </p>
              </div>
              <a
                href={cursoIframeUrl || 'https://centromultidisciplinarioags.com/curso-promotores'}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Abrir en pestaña nueva
              </a>
            </div>
            {cursoLoading || !cursoIframeUrl ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">Cargando curso...</p>
            ) : (
              <iframe
                title="Curso Promotores VIAM"
                src={cursoIframeUrl}
                className="h-[78vh] w-full border-0 bg-black"
                allow="fullscreen"
              />
            )}
          </section>
        )}

        {adminTab === 'contacneed' && (
          <>
        {dashboardQuery.isError && (
          <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            No se pudo cargar el panel:{' '}
            {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'Error desconocido'}
          </p>
        )}

        {(data?.warnings?.length ?? 0) > 0 && (
          <p className="rounded-xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            Avisos: {data?.warnings?.join(' · ')}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Publicaciones totales" value={data?.totals.posts ?? 0} />
          <MetricCard label="Usuarios registrados" value={data?.totals.users ?? 0} />
          <MetricCard label="Correos confirmados" value={data?.totals.verifiedUsers ?? 0} />
          <MetricCard label="Usuarios PRO" value={data?.totals.proUsers ?? 0} />
          <MetricCard label="Pendientes moderación" value={data?.totals.pendingPosts ?? 0} />
          <MetricCard label="Pagos PayPal pendientes" value={data?.totals.pendingPro ?? 0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <StatsPanel title="Usuarios por estado" items={data?.statsByState ?? []} />
          <StatsPanel title="Usuarios por oficio/profesión" items={data?.statsByProfession ?? []} />
          <StatsPanel title="Usuarios por tipo de miembro" items={data?.statsByMemberType ?? []} />
        </div>

        <section className="rounded-2xl border border-amber-500/25 bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <h2 className="text-lg font-bold">Ranking IA — perfiles más reconocidos</h2>
            <span className="text-xs text-slate-400">(likes ×2 + comentarios)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Oficio</th>
                  <th className="px-3 py-2">Likes</th>
                  <th className="px-3 py-2">Comentarios</th>
                  <th className="px-3 py-2">Puntaje</th>
                  <th className="px-3 py-2">★</th>
                </tr>
              </thead>
              <tbody>
                {(rankingQuery.data?.ranking ?? []).map((row: any, idx: number) => (
                  <tr key={row.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-2 font-bold text-amber-400">{idx + 1}</td>
                    <td className="px-3 py-3">{row.nombre || '—'}</td>
                    <td className="px-3 py-3">{row.habilidad_empirica || '—'}</td>
                    <td className="px-3 py-3">{row.total_likes}</td>
                    <td className="px-3 py-3">{row.total_comentarios}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-300">{row.puntaje_engagement}</td>
                    <td className="px-3 py-3">{row.calificacion_promedio ? `${row.calificacion_promedio}★` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-purple-500/25 bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare size={18} className="text-amber-400" />
            <h2 className="text-lg font-bold">Asistente IA Admin</h2>
          </div>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              const q = botQuestion.trim()
              if (!q) return
              adminBotMutation.mutate(q)
            }}
          >
            <input
              value={botQuestion}
              onChange={(event) => setBotQuestion(event.target.value)}
              placeholder="Ej: ¿Qué estados tienen más usuarios? ¿Cómo reactivar publicaciones baneadas?"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-amber-400/50"
            />
            <button
              type="submit"
              disabled={adminBotMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-500 disabled:opacity-50"
            >
              <Send size={16} />
              {adminBotMutation.isPending ? 'Consultando...' : 'Preguntar'}
            </button>
          </form>
          {botAnswer && (
            <p className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
              {botAnswer}
            </p>
          )}
        </section>

        {(data?.pendingPosts?.length ?? 0) > 0 && (
          <ModerationTable
            title="Publicaciones reportadas / pendientes"
            posts={data?.pendingPosts ?? []}
            moderateMutation={moderateMutation}
            deleteMutation={deleteMutation}
          />
        )}

        {(data?.pendingProRequests?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-slate-900 p-4">
            <h2 className="mb-4 text-lg font-bold">Solicitudes PRO (PayPal)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Notas</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.pendingProRequests?.map((req: any) => (
                    <tr key={req.id} className="border-b border-slate-800/80">
                      <td className="px-3 py-3">
                        {req.perfiles?.nombre || req.usuario_id}
                        {req.perfiles?.correo ? (
                          <span className="block text-xs text-slate-400">{req.perfiles.correo}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">${req.monto ?? '—'} MXN</td>
                      <td className="px-3 py-3">{req.notas || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => approveProMutation.mutate({ id: req.id })}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold"
                          >
                            Aprobar PRO
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectProMutation.mutate({ id: req.id })}
                            className="rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
                          >
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-purple-500/25 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-amber-400" />
            <h2 className="text-lg font-bold">Anuncios y banners</h2>
          </div>

          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!adForm.titulo.trim()) return
              saveAdMutation.mutate(adForm)
            }}
          >
            <input
              value={adForm.titulo}
              onChange={(e) => setAdForm({ ...adForm, titulo: e.target.value })}
              placeholder="Título del anuncio"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              value={adForm.estado}
              onChange={(e) => setAdForm({ ...adForm, estado: e.target.value })}
              placeholder="Estado (vacío = nacional)"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              value={adForm.cuerpo}
              onChange={(e) => setAdForm({ ...adForm, cuerpo: e.target.value })}
              placeholder="Texto / descripción"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              value={adForm.enlace_url}
              onChange={(e) => setAdForm({ ...adForm, enlace_url: e.target.value })}
              placeholder="URL de enlace (opcional)"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={adForm.tipo}
              onChange={(e) => setAdForm({ ...adForm, tipo: e.target.value })}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="banner">Banner superior</option>
              <option value="pro">Panel PRO</option>
            </select>
            <button
              type="submit"
              disabled={saveAdMutation.isPending}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 md:col-span-2"
            >
              {saveAdMutation.isPending ? 'Guardando...' : 'Publicar anuncio'}
            </button>
          </form>

          <ul className="space-y-2 text-sm">
            {(adsQuery.data ?? []).map((ad: any) => (
              <li
                key={ad.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div>
                  <span className="font-semibold text-amber-300">{ad.titulo}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {ad.tipo} · {ad.estado || 'Nacional'} · {ad.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteAdMutation.mutate({ id: ad.id })}
                  className="rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </section>

        <ModerationTable
          title="Publicaciones recientes"
          posts={data?.posts ?? []}
          moderateMutation={moderateMutation}
          deleteMutation={deleteMutation}
        />

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users size={18} />
              <h2 className="text-lg font-bold">Usuarios</h2>
              <span className="text-xs text-slate-400">(últimos 200 registrados)</span>
            </div>
            <button
              type="button"
              onClick={() => dashboardQuery.refetch()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw size={14} />
              Refrescar lista
            </button>
            {selectedUserIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`¿Eliminar ${selectedUserIds.size} usuario(s) seleccionados? Esta acción no se puede deshacer.`)) return
                  deleteUsersMutation.mutate([...selectedUserIds])
                }}
                disabled={deleteUsersMutation.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Trash2 size={14} />
                Eliminar seleccionados ({selectedUserIds.size})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds(new Set((data?.users ?? []).map((u: any) => u.id)))
                        } else setSelectedUserIds(new Set())
                      }}
                    />
                  </th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Oficio</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Registro</th>
                  <th className="px-3 py-2">Correo OK</th>
                  <th className="px-3 py-2">PRO</th>
                  <th className="px-3 py-2">Estado cuenta</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((user: any) => (
                  <tr key={user.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        aria-label={`Seleccionar ${user.nombre || user.id}`}
                      />
                    </td>
                    <td className="px-3 py-3">{user.nombre || 'Sin nombre'}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{user.correo || '—'}</td>
                    <td className="px-3 py-3">{user.habilidad_empirica || '—'}</td>
                    <td className="px-3 py-3">{user.estado || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {user.fecha_registro
                        ? new Date(user.fecha_registro).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                    <td className="px-3 py-3">{user.verificado ? 'Sí' : 'Pendiente'}</td>
                    <td className="px-3 py-3">{user.es_pro ? 'Sí' : 'No'}</td>
                    <td className="px-3 py-3">{user.bloqueado ? 'Suspendido' : 'Activo'}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            userMutation.mutate({
                              id: user.id,
                              es_pro: true,
                            })
                          }
                          className="rounded-lg bg-purple-600 px-2 py-1 text-xs font-semibold"
                        >
                          Activar PRO
                        </button>
                        <button
                          type="button"
                          onClick={() => banUserMutation.mutate({ id: user.id })}
                          className="rounded-lg bg-amber-700 px-2 py-1 text-xs font-semibold"
                        >
                          Banear posts
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            blockUserMutation.mutate({ id: user.id, bloqueado: !user.bloqueado })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
                        >
                          <Shield size={12} />
                          {user.bloqueado ? 'Reactivar' : 'Suspender'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-amber-400">{value}</p>
    </div>
  )
}

function StatsPanel({
  title,
  items,
}: {
  title: string
  items: { label: string; count: number }[]
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
        {items.length === 0 && <li className="text-slate-500">Sin datos aún</li>}
        {items.slice(0, 12).map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 border-b border-slate-800/60 pb-1">
            <span className="truncate text-slate-200">{item.label}</span>
            <span className="shrink-0 font-bold text-amber-400">{item.count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ModerationTable({
  title,
  posts,
  moderateMutation,
  deleteMutation,
}: {
  title: string
  posts: { id: string; content: string; estado?: string | null; estatus?: string | null }[]
  moderateMutation: { mutate: (payload: { id: string; estatus: 'aprobado' | 'baneado' | 'pendiente' }) => void }
  deleteMutation: { mutate: (payload: { id: string }) => void }
}) {
  if (posts.length === 0) return null

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-3 py-2">Contenido</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Estatus</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-slate-800/80">
                <td className="max-w-md px-3 py-3">{post.content.slice(0, 120)}</td>
                <td className="px-3 py-3">{post.estado || '—'}</td>
                <td className="px-3 py-3">{post.estatus}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => moderateMutation.mutate({ id: post.id, estatus: 'aprobado' })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold"
                    >
                      <CheckCircle2 size={14} /> Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => moderateMutation.mutate({ id: post.id, estatus: 'baneado' })}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold"
                    >
                      <Ban size={14} /> Banear
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate({ id: post.id })}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
