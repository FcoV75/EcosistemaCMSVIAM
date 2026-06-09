import { useState } from 'react'
import { Crown, X } from 'lucide-react'
import { createCheckoutSessionFn } from '../server/stripe.functions'

type StripeSubscriptionModalProps = {
  open: boolean
  onClose: () => void
}

export function StripeSubscriptionModal({ open, onClose }: StripeSubscriptionModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const startCheckout = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan)
    setError(null)

    try {
      const session = await createCheckoutSessionFn({ data: { plan } })
      window.location.href = session.url
    } catch (checkoutError: any) {
      setError(checkoutError?.message ?? 'No se pudo iniciar el pago con Stripe')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Crown className="text-amber-500" size={20} />
            <h3 className="text-lg font-bold text-slate-900">ContacNeed PRO</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-gray-600">
            Desbloquea tienda personalizada, mayor visibilidad local, multimedia ampliada y herramientas premium.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => startCheckout('monthly')}
              disabled={loadingPlan !== null}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left hover:border-amber-400 disabled:opacity-50"
            >
              <p className="text-sm font-bold text-slate-900">Plan Mensual</p>
              <p className="mt-1 text-xs text-gray-600">Pago recurrente flexible</p>
              <p className="mt-3 text-sm font-semibold text-amber-700">
                {loadingPlan === 'monthly' ? 'Redirigiendo...' : 'Pagar con Stripe'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => startCheckout('annual')}
              disabled={loadingPlan !== null}
              className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4 text-left hover:border-purple-400 disabled:opacity-50"
            >
              <p className="text-sm font-bold text-slate-900">Plan Anual</p>
              <p className="mt-1 text-xs text-gray-600">Mejor valor anual</p>
              <p className="mt-3 text-sm font-semibold text-purple-700">
                {loadingPlan === 'annual' ? 'Redirigiendo...' : 'Pagar con Stripe'}
              </p>
            </button>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  )
}
