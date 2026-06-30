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
  loader: async ({ params }) => getConversationFn({ data: params.peerId }),
  component: ChatPage,
})

function ChatPage() {
  const { user } = Route.useRouteContext()
  const { peerId } = Route.useParams()
  const data = Route.useLoaderData()
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

        <RealtimeChat
          peerId={peerId}
          myUserId={user.id}
          peerName={data.peer.nombre}
          peerAvatar={data.peer.avatar_url}
          peerOnlineApprox={data.peer.online}
        />
      </div>
    </AppShell>
  )
}
