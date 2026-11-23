import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { EnlaceAviso } from '../components/EnlaceAviso'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import {
  getNotificacionesFn,
  markNotificacionReadFn,
} from '../server/notificaciones.functions'
import { responderInvitacionGrupoFn } from '../server/grupos-proyectos.functions'

export const Route = createFileRoute('/avisos')({
  component: AvisosPage,
})

function AvisosPage() {
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const notifQuery = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => getNotificacionesFn(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })

  const markMutation = useMutation({
    mutationFn: (payload: { id?: string; all?: boolean }) =>
      markNotificacionReadFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  const inviteMutation = useMutation({
    mutationFn: (payload: { grupoId: string; accept: boolean; notificacionId: string }) =>
      responderInvitacionGrupoFn({ data: payload }),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
      queryClient.invalidateQueries({ queryKey: ['grupos-comunes'] })
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'No se pudo responder'),
  })

  const items = notifQuery.data?.items ?? []

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="space-y-4">
        <header className="rounded-2xl border border-purple-400/25 bg-slate-950/70 p-5">
          <h1 className="text-2xl font-black text-amber-100">Avisos</h1>
          <p className="mt-1 text-sm text-slate-300">
            Aquí lees tus notificaciones sin salir de ContacNeed. El detalle queda en esta bandeja.
          </p>
          {(notifQuery.data?.unread ?? 0) > 0 && (
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-purple-200 hover:text-white"
              onClick={() => markMutation.mutate({ all: true })}
            >
              Marcar todas como leídas
            </button>
          )}
          {actionError && <p className="mt-2 text-sm text-red-300">{actionError}</p>}
        </header>

        {items.length === 0 && (
          <p className="rounded-2xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
            {notifQuery.data?.loggedIn === false
              ? 'Inicia sesión para ver tus avisos.'
              : 'Sin avisos por ahora.'}
          </p>
        )}

        <ul className="space-y-3">
          {items.map((item) => {
            const meta = (item.metadata || {}) as { grupoId?: string; action?: string }
            const esInvitacion =
              item.tipo === 'grupo_invitacion' && Boolean(meta.grupoId) && !item.leida

            return (
              <li
                key={item.id}
                className={`rounded-2xl border px-4 py-3 ${
                  item.leida ? 'border-slate-800 bg-slate-950/50' : 'border-amber-400/25 bg-amber-950/20'
                }`}
              >
                <p className="text-base font-bold text-white">{item.titulo}</p>
                {item.cuerpo && <p className="mt-1 text-sm text-slate-300">{item.cuerpo}</p>}
                <p className="mt-2 text-[11px] text-purple-300/60">
                  {new Date(item.created_at).toLocaleString('es-MX')}
                </p>

                {esInvitacion ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={inviteMutation.isPending}
                      className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-bold text-white"
                      onClick={() =>
                        inviteMutation.mutate({
                          grupoId: String(meta.grupoId),
                          accept: true,
                          notificacionId: item.id,
                        })
                      }
                    >
                      Aceptar invitación
                    </button>
                    <button
                      type="button"
                      disabled={inviteMutation.isPending}
                      className="rounded-lg bg-red-900/60 px-3 py-1.5 text-xs font-bold text-red-100"
                      onClick={() =>
                        inviteMutation.mutate({
                          grupoId: String(meta.grupoId),
                          accept: false,
                          notificacionId: item.id,
                        })
                      }
                    >
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <EnlaceAviso enlace={item.enlace} />
                )}

                {!item.leida && !esInvitacion && (
                  <button
                    type="button"
                    className="mt-2 block text-xs font-semibold text-purple-200 hover:text-white"
                    onClick={() => markMutation.mutate({ id: item.id })}
                  >
                    Marcar leída
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </AppShell>
  )
}
