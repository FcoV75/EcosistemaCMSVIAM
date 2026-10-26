import { Link, Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Users } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { useIdentity } from '../lib/identity-context'
import { getServerUserFn } from '../server/auth.functions'
import {
  createGrupoComunFn,
  listMisGruposComunesFn,
  responderInvitacionGrupoFn,
} from '../server/grupos-proyectos.functions'

export const Route = createFileRoute('/grupos')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: GruposPage,
})

function GruposPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (pathname !== '/grupos' && pathname.startsWith('/grupos/')) {
    return <Outlet />
  }

  const { isPro } = useIdentity()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState<string | null>(null)

  const gruposQuery = useQuery({
    queryKey: ['grupos-comunes'],
    queryFn: () => listMisGruposComunesFn(),
    enabled: isPro,
  })

  const createMutation = useMutation({
    mutationFn: () => createGrupoComunFn({ data: { nombre, descripcion: desc } }),
    onSuccess: () => {
      setNombre('')
      setDesc('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['grupos-comunes'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'No se pudo crear'),
  })

  const inviteMutation = useMutation({
    mutationFn: (payload: { grupoId: string; accept: boolean }) =>
      responderInvitacionGrupoFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grupos-comunes'] }),
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
          <Users className="text-amber-400" size={22} />
          <h1 className="text-2xl font-black text-white">Grupos</h1>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
            PRO
          </span>
          <SectionHelpHint
            title="¿Cómo usar Grupos?"
            text="Crea grupos tipo WhatsApp/Messenger: familia, compañeros o proveedores. Invita personas de ContacNeed y chatea solo entre miembros. Es beneficio PRO."
          />
        </div>

        {!isPro ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-5 text-sm text-amber-50">
            <p className="font-semibold">Grupos es una ventaja ContacNeed PRO</p>
            <p className="mt-2 text-amber-100/80">
              Comunícate en espacios privados con las personas que elijas. Sube a PRO para activarlo.
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
                <span className="mb-1 block text-purple-200/80">Nombre del grupo</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Ej. Familia, Equipo taller, Proveedores"
                  required
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-purple-200/80">Descripción (opcional)</span>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-white"
                />
              </label>
              {error && <p className="text-sm text-red-300 sm:col-span-2">{error}</p>}
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="cn-btn-metallic rounded-xl px-4 py-2 text-sm font-bold text-slate-950 sm:col-span-2"
              >
                {createMutation.isPending ? 'Creando…' : 'Crear grupo'}
              </button>
            </form>

            <ul className="space-y-2">
              {(gruposQuery.data?.items || []).map((g: any) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-white">{g.nombre}</p>
                    <p className="text-xs text-purple-200/60">
                      {g.mi_estatus === 'invitado' ? 'Invitación pendiente' : `Rol: ${g.mi_rol}`}
                    </p>
                  </div>
                  {g.mi_estatus === 'invitado' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-bold text-white"
                        onClick={() => inviteMutation.mutate({ grupoId: g.id, accept: true })}
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-red-900/60 px-3 py-1.5 text-xs font-bold text-red-100"
                        onClick={() => inviteMutation.mutate({ grupoId: g.id, accept: false })}
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <Link
                      to="/grupos/$groupId"
                      params={{ groupId: g.id }}
                      className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/10"
                    >
                      Abrir chat
                    </Link>
                  )}
                </li>
              ))}
              {!gruposQuery.isLoading && !(gruposQuery.data?.items || []).length && (
                <p className="text-sm text-purple-200/60">Aún no tienes grupos. Crea el primero arriba.</p>
              )}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  )
}
