import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'
import { Feed } from '../components/Feed'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { confirmStripeSessionFn } from '../server/stripe.functions'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentSuccess = params.get('payment_success')
    const sessionId = params.get('session_id')

    if (paymentSuccess === 'true' && sessionId) {
      confirmStripeSessionFn({ data: { sessionId } })
        .then(() => {
          setPaymentMessage('Pago confirmado. Tu cuenta PRO ya está activa.')
          window.history.replaceState({}, '', window.location.pathname)
        })
        .catch((error: Error) => {
          setPaymentMessage(error.message || 'No se pudo confirmar el pago.')
        })
    }
  }, [])

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      {paymentMessage && (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
          {paymentMessage}
        </div>
      )}
      <Feed selectedState={selectedState} />
    </AppShell>
  )
}
