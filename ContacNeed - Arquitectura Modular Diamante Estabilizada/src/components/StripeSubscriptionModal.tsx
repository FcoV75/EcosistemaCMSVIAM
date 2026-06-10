import { useState } from 'react'
import { Crown, X } from 'lucide-react'
import { createCheckoutSessionFn } from '../server/stripe.functions'

type StripeSubscriptionModalProps = {
  open: boolean
  onClose: () => void
}

const PAYPAL_USER = 'JValdezOsorio'

export function StripeSubscriptionModal({ open, onClose }: StripeSubscriptionModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const startStripe = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan)
    setError(null)

    try {
      const session = await createCheckoutSessionFn({ data: { plan } })
      window.location.href = session.url
    } catch {
      try {
        const response = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planTipo: plan === 'annual' ? 'anual' : 'mensual',
            successUrl: `${window.location.origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/?payment_cancelled=true`,
          }),
        })
        const data = await response.json()
        if (response.ok && data.url) {
          window.location.href = data.url
          return
        }
        throw new Error(data.error || 'Stripe no disponible')
      } catch (checkoutError: unknown) {
        setError(
          checkoutError instanceof Error
            ? checkoutError.message
            : 'Stripe no configurado. Usa PayPal abajo.',
        )
        setLoadingPlan(null)
      }
    }
  }

  const paypalUrl = (amount: number) =>
    `https://paypal.me/${PAYPAL_USER}/${amount.toFixed(2)}MXN`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="cn-glass w-full max-w-lg rounded-2xl border border-amber-500/25 shadow-2xl">
        <div className="flex items-center justify-between border-b border-amber-500/15 px-6 py-4">
          <div className="flex items-center gap-2">
            <Crown className="text-amber-400" size={20} />
            <h3 className="text-lg font-bold text-white">ContacNeed PRO</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar modal" className="text-purple-200">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-purple-200/80">
            Desbloquea tienda personalizada, mayor visibilidad y multimedia ampliada.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <PlanCard
              title="Plan Mensual"
              price="MXN $300"
              loading={loadingPlan === 'monthly'}
              disabled={loadingPlan !== null}
              onStripe={() => startStripe('monthly')}
              onPayPal={() => window.open(paypalUrl(300), '_blank', 'noopener,noreferrer')}
            />
            <PlanCard
              title="Plan Anual"
              price="MXN $3,000"
              subtitle="2 meses de regalo"
              loading={loadingPlan === 'annual'}
              disabled={loadingPlan !== null}
              onStripe={() => startStripe('annual')}
              onPayPal={() => window.open(paypalUrl(3000), '_blank', 'noopener,noreferrer')}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  title,
  price,
  subtitle,
  loading,
  disabled,
  onStripe,
  onPayPal,
}: {
  title: string
  price: string
  subtitle?: string
  loading: boolean
  disabled: boolean
  onStripe: () => void
  onPayPal: () => void
}) {
  return (
    <div className="rounded-2xl border border-purple-500/25 bg-slate-900/50 p-4">
      <p className="text-sm font-bold text-white">{title}</p>
      {subtitle && <p className="text-xs text-amber-300/80">{subtitle}</p>}
      <p className="mt-2 text-lg font-black text-amber-400">{price}</p>
      <button
        type="button"
        onClick={onStripe}
        disabled={disabled}
        className="mt-3 w-full rounded-xl bg-purple-600 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50"
      >
        {loading ? 'Redirigiendo...' : 'Pagar con Stripe'}
      </button>
      <button
        type="button"
        onClick={onPayPal}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-amber-400/40 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
      >
        Pagar con PayPal
      </button>
    </div>
  )
}
