import { createServerFn } from '@tanstack/react-start'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser } from '../lib/auth'
import { upsertContacNeedPro } from '../lib/ecosistema-entitlements'
import { activateCmsPlus } from '../lib/cms-plus-entitlements'
import {
  getCmsPlusTier,
  isCmsPlusNivel,
  nombreProductoStripe,
  precioCentavos,
  type CmsPlusBilling,
  type CmsPlusNivel,
} from '../lib/cms-plus'

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY no configurada en Netlify')
  return new Stripe(secret, { apiVersion: '2025-02-24.acacia' })
}

function siteBaseUrl() {
  return process.env.URL ?? process.env.VITE_SITE_URL ?? 'https://contacneed.com'
}

function cmsPlusPriceId(nivel: CmsPlusNivel, billing: CmsPlusBilling): string | undefined {
  const tier = getCmsPlusTier(nivel)
  if (!tier) return undefined
  const envName = billing === 'anual' ? tier.envPriceAnnual : tier.envPriceMonthly
  return process.env[envName] || undefined
}

export const createCheckoutSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { plan: 'monthly' | 'annual' }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Debes iniciar sesión para suscribirte')

    const stripe = getStripe()
    const siteUrl = siteBaseUrl()
    const esAnual = data.plan === 'annual'

    const priceId = esAnual ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY

    const session = priceId
      ? await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: user.email,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${siteUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/?payment_cancelled=true`,
          metadata: { userId: user.id, plan: data.plan, producto: 'contacneed_pro' },
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
          metadata: { userId: user.id, plan: data.plan, producto: 'contacneed_pro' },
        })

    if (!session.url) throw new Error('No se pudo crear la sesión de pago')
    return { url: session.url, sessionId: session.id }
  })

export const createCmsPlusCheckoutFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { nivel: CmsPlusNivel; billing: CmsPlusBilling }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Debes iniciar sesión para unirte al Círculo CMS-Plus')
    if (!isCmsPlusNivel(data.nivel)) throw new Error('Nivel inválido')
    if (data.billing !== 'mensual' && data.billing !== 'anual') {
      throw new Error('Ciclo de facturación inválido')
    }

    const stripe = getStripe()
    const siteUrl = siteBaseUrl()
    const esAnual = data.billing === 'anual'
    const priceId = cmsPlusPriceId(data.nivel, data.billing)
    const metadata = {
      userId: user.id,
      producto: 'cms_plus',
      nivel: data.nivel,
      billing: data.billing,
      plan: esAnual ? 'annual' : 'monthly',
    }

    const session = priceId
      ? await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: user.email,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${siteUrl}/circulo-cms-plus?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/circulo-cms-plus?payment_cancelled=true`,
          metadata,
        })
      : await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: user.email,
          line_items: [
            {
              price_data: {
                currency: 'mxn',
                product_data: {
                  name: nombreProductoStripe(data.nivel, data.billing),
                  description:
                    'Círculo CMS-Plus: salud + ContacNeed + Sincronía Nexus + IA VIAM + Video Diamante',
                },
                unit_amount: precioCentavos(data.nivel, data.billing),
                recurring: { interval: esAnual ? 'year' : 'month' },
              },
              quantity: 1,
            },
          ],
          success_url: `${siteUrl}/circulo-cms-plus?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/circulo-cms-plus?payment_cancelled=true`,
          metadata,
        })

    if (!session.url) throw new Error('No se pudo crear la sesión de pago CMS-Plus')
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
    const producto = session.metadata?.producto || 'contacneed_pro'

    if (producto === 'cms_plus') {
      const nivelRaw = session.metadata?.nivel || 'plata'
      if (!isCmsPlusNivel(nivelRaw)) throw new Error('Nivel CMS-Plus inválido en la sesión')
      const billing: CmsPlusBilling =
        session.metadata?.billing === 'anual' || session.metadata?.plan === 'annual'
          ? 'anual'
          : 'mensual'
      const result = await activateCmsPlus(supabase, {
        userId: user.id,
        nivel: nivelRaw,
        billing,
        stripeSessionId: session.id,
        email: user.email,
        source: 'contacneed_confirm',
      })
      return {
        success: true,
        producto: 'cms_plus',
        nivel: result.nivel,
        es_pro: true,
      }
    }

    const planType = session.metadata?.plan === 'annual' ? 'annual' : 'monthly'
    await upsertContacNeedPro(supabase, user.id, planType, session.id)

    return { success: true, es_pro: true, producto: 'contacneed_pro' }
  })
