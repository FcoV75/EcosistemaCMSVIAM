import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Ban, CheckCircle2, MessageSquare, Send, Trash2, Users } from 'lucide-react'
import { requireAdminUserFn } from '../server/auth.functions'
import {
  askAdminBotFn,
  banUserAdminFn,
  deletePostAdminFn,
  getAdminDashboardFn,
  moderatePostFn,
  updateUserAdminFn,
} from '../server/admin.functions'

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

  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => getAdminDashboardFn(),
    refetchInterval: false,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['posts'] })
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Publicaciones visibles" value={data?.totals.posts ?? 0} />
          <MetricCard label="Usuarios registrados" value={data?.totals.users ?? 0} />
          <MetricCard label="Estados con actividad" value={data?.statsByState?.length ?? 0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StatsPanel title="Usuarios por estado" items={data?.statsByState ?? []} />
          <StatsPanel title="Usuarios por oficio/profesión" items={data?.statsByProfession ?? []} />
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-4 text-lg font-bold">Publicaciones</h2>
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
                {(data?.posts ?? []).map((post) => (
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users size={18} />
            <h2 className="text-lg font-bold">Usuarios</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Oficio</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">PRO</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((user: any) => (
                  <tr key={user.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-3">{user.nombre || 'Sin nombre'}</td>
                    <td className="px-3 py-3">{user.habilidad_empirica || '—'}</td>
                    <td className="px-3 py-3">{user.estado || '—'}</td>
                    <td className="px-3 py-3">{user.es_pro ? 'Sí' : 'No'}</td>
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
                          className="rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
                        >
                          Banear publicaciones
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
