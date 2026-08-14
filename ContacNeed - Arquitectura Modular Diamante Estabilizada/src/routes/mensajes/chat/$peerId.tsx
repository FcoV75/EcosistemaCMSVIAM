import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AppShell } from '../../../components/AppShell'
import { RealtimeChat } from '../../../components/RealtimeChat'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../../../lib/mexico-states'
import { getSessionContextFn } from '../../../server/auth.functions'
import { getConversationFn } from '../../../server/social.functions'

export const Route = createFileRoute('/mensajes/chat/$peerId')({
  beforeLoad: async ({ params }) => {
    const session = await getSessionContextFn()
    if (!session.user) throw redirect({ to: '/login' })
    if (!session.profile?.es_pro) throw redirect({ to: '/mensajes' })
    if (session.user.id === params.peerId) throw redirect({ to: '/mensajes' })
    return { user: session.user }
  },
  loader: async ({ params }) => {
    try {
      const data = await getConversationFn({ data: params.peerId })
      return { ok: true as const, data }
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'No se pudo abrir el chat',
      }
    }
  },
  component: ChatPage,
})

function ChatPage() {
  const { user } = Route.useRouteContext()
  const { peerId } = Route.useParams()
  const loaded = Route.useLoaderData()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <Link to="/mensajes" className="text-sm text-purple-300 hover:text-white">
            ← Volver a mensajes
          </Link>
          <h1 className="mt-2 text-xl font-black text-white">Chat en tiempo real</h1>
          <p className="text-sm text-purple-200/60">
            Los mensajes aparecen al instante cuando ambos están conectados.
          </p>
        </div>

        {!loaded.ok ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5 text-sm text-amber-100">
            <p>{loaded.error}</p>
            <Link to="/mensajes" className="mt-3 inline-block font-bold text-amber-300 hover:underline">
              Ir a solicitudes y bandeja →
            </Link>
          </div>
        ) : (
          <RealtimeChat
            peerId={peerId}
            myUserId={user.id}
            peerName={loaded.data.peer.nombre}
            peerAvatar={loaded.data.peer.avatar_url}
            peerOnlineApprox={loaded.data.peer.online}
          />
        )}
      </div>
    </AppShell>
  )
}
