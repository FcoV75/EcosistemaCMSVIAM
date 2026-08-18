import { Link, Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { useIdentity } from '../lib/identity-context'
import { getServerUserFn } from '../server/auth.functions'
import {
  getContactRequestsFn,
  getConversationsSummaryFn,
  getInboxFn,
  getOnlineUsersFn,
  markMessageReadFn,
  respondContactRequestFn,
} from '../server/social.functions'

export const Route = createFileRoute('/mensajes')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: MessagesPage,
})

function MessagesPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (pathname.startsWith('/mensajes/chat/')) {
    return <Outlet />
  }

  const queryClient = useQueryClient()
  const { isPro } = useIdentity()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [tab, setTab] = useState<'inbox' | 'chats' | 'requests' | 'online'>('chats')

  const inboxQuery = useQuery({
    queryKey: ['inbox'],
    queryFn: () => getInboxFn(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })
  const chatsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversationsSummaryFn(),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  })
  const requestsQuery = useQuery({
    queryKey: ['contact-requests'],
    queryFn: () => getContactRequestsFn(),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  })
  const onlineQuery = useQuery({
    queryKey: ['online-users'],
    queryFn: () => getOnlineUsersFn(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const respondMutation = useMutation({
    mutationFn: (payload: { id: string; accept: boolean }) => respondContactRequestFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-requests'] })
    },
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => markMessageReadFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Mensajes y contactos</h1>
            <p className="text-sm text-purple-200/70">
              Bandeja personal, solicitudes de servicio/amistad y profesionales en línea.
            </p>
          </div>
          {(inboxQuery.data?.unread ?? 0) > 0 && (
            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
              {inboxQuery.data?.unread} sin leer
            </span>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { id: 'chats' as const, label: 'Chats en vivo' },
            { id: 'inbox' as const, label: 'Bandeja' },
            { id: 'requests' as const, label: 'Solicitudes' },
            { id: 'online' as const, label: 'En línea' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === item.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-purple-500/25 text-purple-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'chats' && (
          <div className="space-y-3">
            {!isPro && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                El chat en vivo es exclusivo PRO. En plan gratuito usa la bandeja y las solicitudes de contacto.
              </p>
            )}
            {(chatsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-purple-200/60">
                Aún no tienes conversaciones. Visita un perfil y abre un chat en vivo.
              </p>
            )}
            {(chatsQuery.data ?? []).map((conv) => (
              isPro ? (
              <Link
                key={conv.peer.id}
                to="/mensajes/chat/$peerId"
                params={{ peerId: conv.peer.id }}
                className="flex items-center gap-3 rounded-xl border border-purple-500/15 bg-slate-900/40 p-4 transition hover:border-amber-400/35"
              >
                <img
                  src={conv.peer.avatar_url || `https://i.pravatar.cc/80?u=${conv.peer.id}`}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-bold text-white">{conv.peer.nombre}</p>
                    <span className="shrink-0 text-xs text-purple-300/50">
                      {new Date(conv.lastMessage.created_at).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <p className="truncate text-sm text-purple-100/75">
                    {conv.lastMessage.incoming ? '' : 'Tú: '}
                    {conv.lastMessage.url_adjunto
                      ? conv.lastMessage.cuerpo && conv.lastMessage.cuerpo !== '📎'
                        ? conv.lastMessage.cuerpo
                        : `📎 ${conv.lastMessage.nombre_archivo || 'Archivo adjunto'}`
                      : conv.lastMessage.cuerpo}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">
                    {conv.unreadCount}
                  </span>
                )}
              </Link>
              ) : (
              <div
                key={conv.peer.id}
                className="flex items-center gap-3 rounded-xl border border-purple-500/15 bg-slate-900/40 p-4 opacity-90"
              >
                <img
                  src={conv.peer.avatar_url || `https://i.pravatar.cc/80?u=${conv.peer.id}`}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{conv.peer.nombre}</p>
                  <p className="truncate text-sm text-purple-100/75">
                    {conv.lastMessage.url_adjunto
                      ? conv.lastMessage.cuerpo && conv.lastMessage.cuerpo !== '📎'
                        ? conv.lastMessage.cuerpo
                        : `📎 ${conv.lastMessage.nombre_archivo || 'Archivo adjunto'}`
                      : conv.lastMessage.cuerpo}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase text-amber-300">Solo PRO</span>
              </div>
              )
            ))}
          </div>
        )}

        {tab === 'inbox' && (
          <div className="space-y-3">
            {(inboxQuery.data?.messages ?? []).length === 0 && (
              <p className="text-sm text-purple-200/60">No tienes mensajes aún.</p>
            )}
            {(inboxQuery.data?.messages ?? []).map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 ${
                  msg.incoming && !msg.leido
                    ? 'border-amber-400/40 bg-amber-950/20'
                    : 'border-purple-500/15 bg-slate-900/40'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={msg.peer.avatar_url || `https://i.pravatar.cc/80?u=${msg.peer.id}`}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div>
                      <Link to="/u/$userId" params={{ userId: msg.peer.id }} className="font-bold text-white hover:text-amber-200">
                        {msg.incoming ? msg.peer.nombre : `Para: ${msg.peer.nombre}`}
                      </Link>
                      {msg.tipo === 'informe_pro' ? (
                        <p className="text-[10px] uppercase text-purple-300/60">Informe PRO</p>
                      ) : (
                        <p className="text-[10px] uppercase text-purple-300/60">{msg.tipo}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-purple-300/50">
                    {new Date(msg.created_at).toLocaleString('es-MX')}
                  </span>
                </div>
                {msg.asunto && <p className="text-xs font-semibold text-amber-200/80">{msg.asunto}</p>}
                <p className="mt-2 text-sm text-purple-100/90">
                  {msg.url_adjunto && (!msg.cuerpo || msg.cuerpo === '📎')
                    ? `📎 ${msg.nombre_archivo || 'Archivo adjunto'}`
                    : msg.cuerpo}
                </p>
                {msg.url_adjunto ? (
                  <a
                    href={msg.url_adjunto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-amber-300 hover:text-amber-200"
                  >
                    Ver adjunto →
                  </a>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    to="/mensajes/chat/$peerId"
                    params={{ peerId: msg.peer.id }}
                    className="text-xs font-bold text-amber-300 hover:text-amber-200"
                  >
                    {isPro ? 'Chat en vivo →' : 'Chat PRO →'}
                  </Link>
                  {msg.incoming && !msg.leido && (
                    <button
                      type="button"
                      onClick={() => readMutation.mutate(msg.id)}
                      className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Marcar como leído
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-3">
            {(requestsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-purple-200/60">No hay solicitudes pendientes.</p>
            )}
            {(requestsQuery.data ?? []).map((req) => (
              <div key={req.id} className="rounded-xl border border-purple-500/15 bg-slate-900/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to="/u/$userId" params={{ userId: req.solicitante.id }} className="font-bold text-white hover:text-amber-200">
                      {req.solicitante.nombre}
                    </Link>
                    <p className="text-xs text-purple-300/70">
                      {req.tipo === 'servicio' ? 'Solicitud de servicio' : 'Solicitud de amistad'}
                      {req.solicitante.habilidad_empirica ? ` · ${req.solicitante.habilidad_empirica}` : ''}
                    </p>
                    {req.mensaje && <p className="mt-2 text-sm text-purple-100/85">{req.mensaje}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondMutation.mutate({ id: req.id, accept: true })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Check size={14} /> Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => respondMutation.mutate({ id: req.id, accept: false })}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <X size={14} /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'online' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(onlineQuery.data ?? []).length === 0 && (
              <p className="text-sm text-purple-200/60 sm:col-span-2">
                Nadie activo en los últimos 5 minutos. Vuelve pronto o envía un mensaje a quien te interese.
              </p>
            )}
            {(onlineQuery.data ?? []).map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3"
              >
                <Link
                  to="/u/$userId"
                  params={{ userId: person.id }}
                  className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90"
                >
                  <img
                    src={person.avatar_url || `https://i.pravatar.cc/80?u=${person.id}`}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-bold text-white">{person.nombre}</p>
                    <p className="text-xs text-emerald-200/80">
                      {person.habilidad_empirica ?? 'Profesional'} · {person.estado ?? 'México'}
                    </p>
                    <span className="text-[10px] font-bold uppercase text-emerald-400">Disponible</span>
                  </div>
                </Link>
                <Link
                  to="/mensajes/chat/$peerId"
                  params={{ peerId: person.id }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${
                    isPro
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-amber-400/40 text-amber-200'
                  }`}
                >
                  {isPro ? 'Chat' : 'PRO'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
