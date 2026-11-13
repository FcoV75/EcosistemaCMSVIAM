import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  listCmsPlusAdminFn,
  otorgarCmsPlusAdminFn,
  revocarCmsPlusAdminFn,
} from '../../server/cms-plus.functions'
import { CMS_PLUS_NIVELES, type CmsPlusBilling, type CmsPlusNivel } from '../../lib/cms-plus'

export function CmsPlusAdminPanel() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [nivel, setNivel] = useState<CmsPlusNivel>('oro')
  const [billing, setBilling] = useState<CmsPlusBilling>('mensual')
  const [permanent, setPermanent] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-cms-plus'],
    queryFn: () => listCmsPlusAdminFn(),
  })

  const otorgarMutation = useMutation({
    mutationFn: () =>
      otorgarCmsPlusAdminFn({
        data: { email, nivel, billing, permanent },
      }),
    onSuccess: (result) => {
      setMsg(result.nota || 'CMS-Plus otorgado.')
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-plus'] })
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo otorgar')
    },
  })

  const revocarMutation = useMutation({
    mutationFn: (userId: string) => revocarCmsPlusAdminFn({ data: { userId } }),
    onSuccess: () => {
      setMsg('Membresía CMS-Plus revocada.')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-plus'] })
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo revocar')
    },
  })

  const activos = (listQuery.data?.membresias ?? []).filter((m) => m.status === 'active')

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-500/25 bg-slate-900/80 p-4">
        <h2 className="text-lg font-bold text-amber-300">Círculo CMS-Plus Membresías</h2>
        <p className="mt-1 text-sm text-slate-300">
          Otorga Plata, Oro, Platino o Diamante. Activa ContacNeed PRO + Nexus + Video Diamante y
          créditos de salud.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Precios: Plata $499 · Oro $899 · Platino $1,499 · Diamante $2,499 MXN/mes
        </p>

        {msg && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            {msg}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
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
            Permanente / cortesía
          </label>
        </div>

        <button
          type="button"
          disabled={otorgarMutation.isPending || !email.trim()}
          onClick={() => otorgarMutation.mutate()}
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {otorgarMutation.isPending ? 'Otorgando…' : 'Otorgar CMS-Plus'}
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
        <h3 className="font-bold text-amber-100">Activas ({activos.length})</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">Correo</th>
                <th className="px-2 py-2">Nivel</th>
                <th className="px-2 py-2">Ciclo</th>
                <th className="px-2 py-2">Vence</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {activos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-slate-500">
                    {listQuery.isLoading ? 'Cargando…' : 'Aún no hay membresías CMS-Plus.'}
                  </td>
                </tr>
              )}
              {activos.map((m) => (
                <tr key={m.id} className="border-t border-white/5 text-slate-200">
                  <td className="px-2 py-2">{m.email || m.user_id}</td>
                  <td className="px-2 py-2 capitalize">{m.nivel}</td>
                  <td className="px-2 py-2">{m.permanent ? 'permanente' : m.billing}</td>
                  <td className="px-2 py-2">
                    {m.permanent ? '—' : m.expires_at ? new Date(m.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {m.user_id && (
                      <button
                        type="button"
                        className="text-xs text-red-300"
                        onClick={() => {
                          if (!confirm('¿Revocar CMS-Plus de este usuario?')) return
                          revocarMutation.mutate(m.user_id!)
                        }}
                      >
                        Revocar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
