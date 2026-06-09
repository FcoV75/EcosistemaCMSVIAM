import { createServerFn } from '@tanstack/react-start'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma.server'
import { getServerUser } from '../lib/auth'

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY no configurada')
  return new Stripe(secret, { apiVersion: '2024-11-20.acacia' })
}

export const createCheckoutSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { plan: 'monthly' | 'annual' }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Debes iniciar sesión para suscribirte')

    const stripe = getStripe()
    const siteUrl = process.env.URL ?? process.env.VITE_SITE_URL ?? 'https://contacneed.com'

    const priceId =
      data.plan === 'annual'
        ? process.env.STRIPE_PRICE_ANNUAL
        : process.env.STRIPE_PRICE_MONTHLY

    if (!priceId) throw new Error('Precio de Stripe no configurado en variables de entorno')

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?payment_cancelled=true`,
      metadata: {
        userId: user.id,
        plan: data.plan,
      },
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

    await prisma.perfiles.update({
      where: { id: user.id },
      data: {
        es_pro: true,
        is_premium: true,
      },
    })

    return { success: true, es_pro: true, is_premium: true }
  })
