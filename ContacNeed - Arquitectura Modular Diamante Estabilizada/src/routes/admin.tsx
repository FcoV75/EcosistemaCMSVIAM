import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Trash2, Users } from 'lucide-react'
import { requireAdminUserFn } from '../server/auth.functions'
import {
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

  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => getAdminDashboardFn(),
    refetchInterval: false,
  })

  const moderateMutation = useMutation({
    mutationFn: (payload: { id: string; estatus: 'aprobado' | 'baneado' | 'pendiente' }) =>
      moderatePostFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (payload: { id: string }) => deletePostAdminFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
  })

  const userMutation = useMutation({
    mutationFn: (payload: { id: string; es_pro?: boolean; is_premium?: boolean }) =>
      updateUserAdminFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
  })

  const banUserMutation = useMutation({
    mutationFn: (payload: { id: string }) => banUserAdminFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
  })

  const data = dashboardQuery.data

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Plataforma de Administración</p>
          <h1 className="text-3xl font-black">ContacNeed Admin</h1>
          <p className="mt-2 text-sm text-slate-300">
            Moderación de publicaciones, gestión de usuarios y analítica por estado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Publicaciones visibles" value={data?.totals.posts ?? 0} />
          <MetricCard label="Usuarios registrados" value={data?.totals.users ?? 0} />
          <MetricCard label="Estados con actividad" value={data?.statsByState?.length ?? 0} />
        </div>

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
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">PRO</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((user: any) => (
                  <tr key={user.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-3">{user.full_name || 'Sin nombre'}</td>
                    <td className="px-3 py-3">{user.email || '—'}</td>
                    <td className="px-3 py-3">{user.estado || '—'}</td>
                    <td className="px-3 py-3">{user.es_pro || user.is_premium ? 'Sí' : 'No'}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            userMutation.mutate({
                              id: user.id,
                              es_pro: true,
                              is_premium: true,
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
