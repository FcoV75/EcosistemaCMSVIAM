import { createServerFn } from '@tanstack/react-start'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser } from '../lib/auth'

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY no configurada en Netlify')
  return new Stripe(secret, { apiVersion: '2024-11-20.acacia' })
}

export const createCheckoutSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { plan: 'monthly' | 'annual' }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Debes iniciar sesión para suscribirte')

    const stripe = getStripe()
    const siteUrl = process.env.URL ?? process.env.VITE_SITE_URL ?? 'https://contacneed.com'
    const esAnual = data.plan === 'annual'

    const priceId = esAnual ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY

    const session = priceId
      ? await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: user.email,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${siteUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/?payment_cancelled=true`,
          metadata: { userId: user.id, plan: data.plan },
        })
      : await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: user.email,
          line_items: [
            {
              price_data: {
                currency: 'mxn',
                product_data: {
                  name: esAnual ? 'ContacNeed PRO — Anual' : 'ContacNeed PRO — Mensual',
                },
                unit_amount: esAnual ? 300000 : 30000,
                recurring: { interval: esAnual ? 'year' : 'month' },
              },
              quantity: 1,
            },
          ],
          success_url: `${siteUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/?payment_cancelled=true`,
          metadata: { userId: user.id, plan: data.plan },
        })

    if (!session.url) throw new Error('No se pudo crear la sesión de pago')
    return { url: session.url, sessionId: session.id }
  })

export const confirmStripeSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Not authenticated')

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(data.sessionId)

    if (session.payment_status !== 'paid') {
      throw new Error('El pago aún no está confirmado')
    }

    if (session.metadata?.userId && session.metadata.userId !== user.id) {
      throw new Error('La sesión de pago no pertenece a este usuario')
    }

    const supabase = createSupabaseAdminClient()
    const planType = session.metadata?.plan === 'annual' ? 'annual' : 'monthly'
    const { error } = await supabase
      .from('perfiles')
      .update({ es_pro: true, pro_plan_type: planType })
      .eq('id', user.id)
    if (error) throw error

    return { success: true, es_pro: true }
  })
