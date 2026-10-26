import { Link, Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { useIdentity } from '../lib/identity-context'
import { getServerUserFn } from '../server/auth.functions'
import { createProyectoFn, listMisProyectosFn } from '../server/grupos-proyectos.functions'

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
  if (pathname !== '/mi-proyecto' && pathname.startsWith('/mi-proyecto/')) {
    return <Outlet />
  }

  const { isPro } = useIdentity()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [tipo, setTipo] = useState('edificio')
  const [error, setError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['mis-proyectos'],
    queryFn: () => listMisProyectosFn(),
    enabled: isPro,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createProyectoFn({ data: { nombre, descripcion: desc, tipo_obra: tipo } }),
    onSuccess: () => {
      setNombre('')
      setDesc('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['mis-proyectos'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

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
            text="Crea un proyecto serio (edificio, escuela, hospital…). Dentro arma grupos estratégicos (arquitectos, albañiles, abogados, proveedores). Tú lo concluyes y eliges qué grupos quedan para mantenimiento."
          />
        </div>

        {!isPro ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-5 text-sm text-amber-50">
            <p className="font-semibold">Mi Proyecto es ContacNeed PRO</p>
            <p className="mt-2 text-amber-100/80">
              Coordina obras grandes con grupos por oficio hasta concluir y dejar solo el equipo de
              mantenimiento.
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
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
              >
                {createMutation.isPending ? 'Creando…' : 'Crear proyecto'}
              </button>
            </form>

            <SectionList title="Tus proyectos" items={listQuery.data?.propios || []} />
            <SectionList title="Colaboras en" items={listQuery.data?.colaborando || []} />
          </>
        )}
      </div>
    </AppShell>
  )
}

function SectionList({ title, items }: { title: string; items: any[] }) {
  if (!items.length) return null
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-300/70">{title}</h2>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              to="/mi-proyecto/$projectId"
              params={{ projectId: p.id }}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
            >
              <div>
                <p className="font-semibold text-white">{p.nombre}</p>
                <p className="text-xs text-purple-200/60">
                  {p.tipo_obra} · {p.estatus}
                </p>
              </div>
              <span className="text-xs font-bold text-amber-300">Abrir →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
