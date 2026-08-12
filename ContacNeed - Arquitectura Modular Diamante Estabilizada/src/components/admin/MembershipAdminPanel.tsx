import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  listMembresiasAdminFn,
  otorgarMembresiaAdminFn,
  revocarMembresiaAdminFn,
} from '../server/membresias.functions'
import {
  PLANES_MEMBRESIA,
  type PlanMembresia,
  type ProductoMembresia,
} from '../lib/membresias-viam'

type Props = {
  producto: ProductoMembresia
  accentClass?: string
}

export function MembershipAdminPanel({ producto, accentClass = 'text-sky-300 border-sky-500/25' }: Props) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [plan, setPlan] = useState<PlanMembresia>('mensual')
  const [msg, setMsg] = useState<string | null>(null)

  const queryKey = ['admin-membresias', producto]
  const listQuery = useQuery({
    queryKey,
    queryFn: () => listMembresiasAdminFn({ data: { producto } }),
  })

  const otorgarMutation = useMutation({
    mutationFn: (payload: { email: string; plan: PlanMembresia; nombre?: string }) =>
      otorgarMembresiaAdminFn({ data: { producto, ...payload } }),
    onSuccess: (result) => {
      setMsg(result.nota || 'Membresía otorgada.')
      setEmail('')
      setNombre('')
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['panel-fundador'] })
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo otorgar')
    },
  })

  const revocarMutation = useMutation({
    mutationFn: (id: string) => revocarMembresiaAdminFn({ data: { id, producto } }),
    onSuccess: () => {
      setMsg('Membresía revocada.')
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['panel-fundador'] })
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo revocar')
    },
  })

  const activos = (listQuery.data?.membresias ?? []).filter((m) => m.status === 'active')
  const porPlan = {
    mensual: activos.filter((m) => m.plan === 'mensual').length,
    anual: activos.filter((m) => m.plan === 'anual').length,
    propietario: activos.filter((m) => m.plan === 'propietario' || m.permanent).length,
  }

  const [titleColor, borderColor] = accentClass.split(' ')

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border bg-slate-900/80 p-4 ${borderColor || 'border-sky-500/25'}`}>
        <h2 className={`text-lg font-bold ${titleColor || 'text-sky-300'}`}>
          {listQuery.data?.etiqueta || 'Membresía'}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {listQuery.data?.descripcion || 'Otorga o revoca niveles de acceso.'}
        </p>
        <p className="mt-1 text-xs text-slate-500">{listQuery.data?.precios}</p>

        {listQuery.isError && (
          <p className="mt-3 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {listQuery.error instanceof Error ? listQuery.error.message : 'Error al cargar'}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">Activos</p>
            <p className="mt-2 text-3xl font-black text-amber-400">{activos.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">Mensual</p>
            <p className="mt-2 text-3xl font-black text-amber-400">{porPlan.mensual}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">Anual</p>
            <p className="mt-2 text-3xl font-black text-amber-400">{porPlan.anual}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">Propietario</p>
            <p className="mt-2 text-3xl font-black text-amber-400">{porPlan.propietario}</p>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border bg-slate-900/80 p-4 ${borderColor || 'border-sky-500/25'}`}>
        <h3 className={`text-base font-bold ${titleColor || 'text-sky-300'}`}>Otorgar membresía</h3>
        <p className="mt-1 text-sm text-slate-300">
          Elige el nivel (mensual, anual o propietario) e indica el correo del usuario ContacNeed.
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const mail = email.trim()
            if (!mail) return
            setMsg(null)
            otorgarMutation.mutate({
              email: mail,
              plan,
              nombre: nombre.trim() || undefined,
            })
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (opcional)"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanMembresia)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2"
          >
            {PLANES_MEMBRESIA.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} ({p.hint})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={otorgarMutation.isPending}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 md:col-span-2 disabled:opacity-50"
          >
            {otorgarMutation.isPending ? 'Otorgando...' : 'Otorgar membresía'}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-sky-200">{msg}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {activos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    {listQuery.isLoading ? 'Cargando...' : 'Aún no hay membresías activas.'}
                  </td>
                </tr>
              )}
              {activos.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/80">
                  <td className="px-3 py-3">{m.email || '—'}</td>
                  <td className="px-3 py-3">{m.nombre || '—'}</td>
                  <td className="px-3 py-3 font-semibold text-amber-300">
                    {m.plan || '—'}
                    {m.permanent ? ' · permanente' : ''}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">
                    {m.permanent || !m.expires_at
                      ? 'Sin vencimiento'
                      : new Date(m.expires_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-3 py-3 text-emerald-300">{m.status}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`¿Revocar membresía de ${m.email || 'este usuario'}?`)) return
                        revocarMutation.mutate(m.id)
                      }}
                      className="rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
                    >
                      Revocar
                    </button>
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
