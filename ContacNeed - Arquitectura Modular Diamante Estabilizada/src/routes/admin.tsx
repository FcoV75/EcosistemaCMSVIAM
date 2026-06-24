import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Ban, CheckCircle2, Megaphone, MessageSquare, RefreshCw, Send, Shield, Trash2, Users } from 'lucide-react'
import { requireAdminUserFn } from '../server/auth.functions'
import {
  approveProRequestFn,
  askAdminBotFn,
  banUserAdminFn,
  blockUserAdminFn,
  deletePostAdminFn,
  getAdminDashboardFn,
  moderatePostFn,
  rejectProRequestFn,
  updateUserAdminFn,
} from '../server/admin.functions'
import { deleteAdFn, getAdminAdsFn, saveAdFn } from '../server/ads.functions'

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
  const [botQuestion, setBotQuestion] = useState('')
  const [botAnswer, setBotAnswer] = useState<string | null>(null)
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
  })

  const adsQuery = useQuery({
    queryKey: ['admin-ads'],
    queryFn: () => getAdminAdsFn(),
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['admin-ads'] })
    queryClient.invalidateQueries({ queryKey: ['posts'] })
    queryClient.invalidateQueries({ queryKey: ['banner-ads'] })
    queryClient.invalidateQueries({ queryKey: ['pro-panel'] })
  }

  const moderateMutation = useMutation({
    mutationFn: (payload: { id: string; estatus: 'aprobado' | 'baneado' | 'pendiente' }) =>
      moderatePostFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: (payload: { id: string }) => deletePostAdminFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const userMutation = useMutation({
    mutationFn: (payload: { id: string; es_pro?: boolean; is_admin?: boolean }) =>
      updateUserAdminFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const banUserMutation = useMutation({
    mutationFn: (payload: { id: string }) => banUserAdminFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const blockUserMutation = useMutation({
    mutationFn: (payload: { id: string; bloqueado: boolean }) => blockUserAdminFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const approveProMutation = useMutation({
    mutationFn: (payload: { id: string }) => approveProRequestFn({ data: payload }),
    onSuccess: invalidateAll,
  })

  const rejectProMutation = useMutation({
    mutationFn: (payload: { id: string }) => rejectProRequestFn({ data: payload }),
    onSuccess: invalidateAll,
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

  const data = dashboardQuery.data

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Plataforma de Administración</p>
            <h1 className="text-3xl font-black">ContacNeed Admin</h1>
            <p className="mt-2 text-sm text-slate-300">
              Moderación de publicaciones, gestión de usuarios y analítica por estado y oficio.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/10"
          >
            <ArrowLeft size={16} />
            Volver a la pizarra
          </Link>
          <button
            type="button"
            onClick={() => dashboardQuery.refetch()}
            disabled={dashboardQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={dashboardQuery.isFetching ? 'animate-spin' : ''} />
            {dashboardQuery.isFetching ? 'Actualizando...' : 'Actualizar datos'}
          </button>
        </div>

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
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
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
