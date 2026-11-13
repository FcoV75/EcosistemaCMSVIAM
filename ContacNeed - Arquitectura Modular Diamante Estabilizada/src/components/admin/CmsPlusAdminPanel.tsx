import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  listCmsPlusAdminFn,
  otorgarCmsPlusAdminFn,
  revocarCmsPlusAdminFn,
  suspenderCmsPlusAdminFn,
  reactivarCmsPlusAdminFn,
} from '../../server/cms-plus.functions'
import { CMS_PLUS_NIVELES, type CmsPlusBilling, type CmsPlusNivel } from '../../lib/cms-plus'

type TabId = CmsPlusNivel | 'todos' | 'suspendidos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'plata', label: 'Plata' },
  { id: 'oro', label: 'Oro' },
  { id: 'platino', label: 'Platino' },
  { id: 'diamante', label: 'Diamante' },
  { id: 'suspendidos', label: 'Suspendidos' },
]

export function CmsPlusAdminPanel() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [nivel, setNivel] = useState<CmsPlusNivel>('oro')
  const [billing, setBilling] = useState<CmsPlusBilling>('mensual')
  const [permanent, setPermanent] = useState(false)
  const [tab, setTab] = useState<TabId>('todos')
  const [msg, setMsg] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-cms-plus'],
    queryFn: () => listCmsPlusAdminFn(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-cms-plus'] })

  const otorgarMutation = useMutation({
    mutationFn: () =>
      otorgarCmsPlusAdminFn({
        data: { email, nivel, billing, permanent },
      }),
    onSuccess: (result) => {
      setMsg(result.nota || 'CMS-Plus otorgado.')
      setEmail('')
      invalidate()
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo otorgar')
    },
  })

  const suspenderMutation = useMutation({
    mutationFn: (userId: string) =>
      suspenderCmsPlusAdminFn({ data: { userId, motivo: 'admin_panel' } }),
    onSuccess: () => {
      setMsg('Membresía suspendida.')
      invalidate()
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo suspender')
    },
  })

  const revocarMutation = useMutation({
    mutationFn: (userId: string) => revocarCmsPlusAdminFn({ data: { userId } }),
    onSuccess: () => {
      setMsg('Membresía eliminada.')
      invalidate()
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo eliminar')
    },
  })

  const reactivarMutation = useMutation({
    mutationFn: (id: string) => reactivarCmsPlusAdminFn({ data: { id } }),
    onSuccess: () => {
      setMsg('Membresía reactivada.')
      invalidate()
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo reactivar')
    },
  })

  const rows = listQuery.data?.membresias ?? []
  const conteos = listQuery.data?.conteos ?? {
    plata: 0,
    oro: 0,
    platino: 0,
    diamante: 0,
    suspendidos: 0,
    totalActivos: 0,
  }

  const filtered = useMemo(() => {
    if (tab === 'todos') return rows.filter((m) => m.status === 'active')
    if (tab === 'suspendidos') {
      return rows.filter((m) => m.suspendido || m.status === 'cancelled' || m.status === 'expired')
    }
    return rows.filter((m) => m.nivel === tab && m.status === 'active')
  }, [rows, tab])

  const busy =
    otorgarMutation.isPending ||
    suspenderMutation.isPending ||
    revocarMutation.isPending ||
    reactivarMutation.isPending

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 via-slate-900/80 to-violet-950/30 p-4">
        <h2 className="text-lg font-bold text-amber-300">Círculo CMS-Plus · Control de membresías</h2>
        <p className="mt-1 text-sm text-slate-300">
          Alta, suspensión y baja por nivel — mismo control que Nexus, Video Diamante y ContacNeed.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Precios: Plata $499 · Oro $899 · Platino $1,499 · Diamante $2,499 MXN/mes
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ['Activos', conteos.totalActivos, 'text-emerald-300'],
              ['Plata', conteos.plata, 'text-slate-200'],
              ['Oro', conteos.oro, 'text-amber-300'],
              ['Platino', conteos.platino, 'text-cyan-300'],
              ['Diamante', conteos.diamante, 'text-violet-300'],
              ['Suspendidos', conteos.suspendidos, 'text-rose-300'],
            ] as const
          ).map(([label, n, tone]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center">
              <p className={`text-2xl font-black ${tone}`}>{n}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        {msg && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            {msg}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-slate-300 lg:col-span-2">
            Correo
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
              placeholder="paciente@correo.com"
            />
          </label>
          <label className="text-sm text-slate-300">
            Nivel
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value as CmsPlusNivel)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
            >
              {CMS_PLUS_NIVELES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} (${t.precioMensualMxn})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Ciclo
            <select
              value={billing}
              onChange={(e) => setBilling(e.target.value as CmsPlusBilling)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
            >
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
            />
            Permanente
          </label>
        </div>

        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={() => otorgarMutation.mutate()}
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {otorgarMutation.isPending ? 'Otorgando…' : 'Dar de alta'}
        </button>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((t) => {
          const count =
            t.id === 'todos'
              ? conteos.totalActivos
              : t.id === 'suspendidos'
                ? conteos.suspendidos
                : conteos[t.id as CmsPlusNivel]
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                tab === t.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-white/15 bg-black/30 text-slate-300 hover:border-amber-400/40'
              }`}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/70">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-black/40 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Ciclo</th>
              <th className="px-3 py-2">Vence</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  {listQuery.isLoading ? 'Cargando…' : 'Sin miembros en esta pestaña.'}
                </td>
              </tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-white/5 text-slate-200">
                <td className="px-3 py-2 font-mono text-xs">{m.email || m.user_id}</td>
                <td className="px-3 py-2 capitalize">{m.nivel}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      m.status === 'active'
                        ? 'text-emerald-300'
                        : m.suspendido || m.status === 'cancelled'
                          ? 'text-amber-300'
                          : 'text-slate-400'
                    }
                  >
                    {m.suspendido ? 'suspendido' : m.status}
                    {m.permanent ? ' · permanente' : ''}
                  </span>
                </td>
                <td className="px-3 py-2">{m.billing}</td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {m.permanent ? '—' : m.expires_at ? new Date(m.expires_at).toLocaleDateString('es-MX') : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {m.status === 'active' && m.user_id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs font-semibold text-amber-300 hover:underline disabled:opacity-50"
                          onClick={() => {
                            if (!confirm(`¿Suspender a ${m.email || m.user_id}?`)) return
                            suspenderMutation.mutate(m.user_id!)
                          }}
                        >
                          Suspender
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs font-semibold text-red-300 hover:underline disabled:opacity-50"
                          onClick={() => {
                            if (!confirm(`¿Eliminar membresía de ${m.email || m.user_id}?`)) return
                            revocarMutation.mutate(m.user_id!)
                          }}
                        >
                          Eliminar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs font-semibold text-emerald-300 hover:underline disabled:opacity-50"
                          onClick={() => reactivarMutation.mutate(m.id)}
                        >
                          Reactivar
                        </button>
                        {m.user_id && (
                          <button
                            type="button"
                            disabled={busy}
                            className="text-xs font-semibold text-red-300 hover:underline disabled:opacity-50"
                            onClick={() => {
                              if (!confirm('¿Eliminar definitivamente?')) return
                              revocarMutation.mutate(m.user_id!)
                            }}
                          >
                            Eliminar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
