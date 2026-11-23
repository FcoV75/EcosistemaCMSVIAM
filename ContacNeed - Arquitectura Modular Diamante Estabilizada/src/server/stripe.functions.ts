import { createServerFn } from '@tanstack/react-start'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser, requireActiveUser } from '../lib/auth'
import { getContacNeedProStatus, upsertContacNeedPro } from '../lib/ecosistema-entitlements'
import { activateCmsPlus, getCmsPlusStatus } from '../lib/cms-plus-entitlements'
import { notifyPrivilegeGrant } from '../lib/notify-privileges'
import {
  getCmsPlusTier,
  isCmsPlusNivel,
  nombreProductoStripe,
  precioCentavos,
  type CmsPlusBilling,
  type CmsPlusNivel,
} from '../lib/cms-plus'
import { PRODUCTO_EXPEDIENTE, precioExpedienteCentavos } from '../lib/expediente-clinico'
import {
  activateExpedienteClinico,
  getExpedienteAccess,
} from '../lib/expediente-entitlements'
import { PRODUCTO_CONTADOR, precioContadorCentavos } from '../lib/contador-privado'
import {
  activateContadorPrivado,
  getContadorAccess,
} from '../lib/contador-entitlements'

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY no configurada en Netlify')
  return new Stripe(secret, { apiVersion: '2025-02-24.acacia' })
}

function siteBaseUrl() {
  return process.env.URL ?? process.env.VITE_SITE_URL ?? 'https://contacneed.com'
}

/** Foto de cierre del ecosistema: aparece en el panel izquierdo de Stripe Checkout. */
function cmsPlusCheckoutImageUrl() {
  return (
    process.env.CMS_PLUS_CHECKOUT_IMAGE_URL ||
    process.env.VITE_CMS_PLUS_CHECKOUT_IMAGE_URL ||
    'https://centromultidisciplinarioags.com/Assets/Images/Gracias_Pago_CMS.png'
  )
}

function cmsPlusPriceId(nivel: CmsPlusNivel, billing: CmsPlusBilling): string | undefined {
  const tier = getCmsPlusTier(nivel)
  if (!tier) return undefined
  const envName = billing === 'anual' ? tier.envPriceAnnual : tier.envPriceMonthly
  return process.env[envName] || undefined
}

async function syncCheckoutProductImage(stripe: Stripe, priceId: string, imageUrl: string) {
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
    const product = price.product
    if (!product || typeof product === 'string' || ('deleted' in product && product.deleted)) {
      return
    }
    const images = Array.isArray(product.images) ? product.images : []
    if (images[0] === imageUrl) return
    await stripe.products.update(product.id, { images: [imageUrl] })
  } catch (err) {
    console.warn('CMS-Plus: no se pudo sincronizar imagen del producto Stripe:', err)
  }
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

    const metadata = { userId: user.id, plan: data.plan, producto: 'contacneed_pro' }
    const session = priceId
      ? await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer_email: user.email,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${siteUrl}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/?payment_cancelled=true`,
          metadata,
          subscription_data: { metadata },
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
          metadata,
          subscription_data: { metadata },
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
    const imageUrl = cmsPlusCheckoutImageUrl()
    const metadata = {
      userId: user.id,
      producto: 'cms_plus',
      nivel: data.nivel,
      billing: data.billing,
      plan: esAnual ? 'annual' : 'monthly',
    }

    // Stripe Checkout muestra product_data.images (o images del Product) en el
    // espacio en blanco bajo el precio, a la izquierda del formulario de pago.
    const session = priceId
      ? await (async () => {
          await syncCheckoutProductImage(stripe, priceId, imageUrl)
          return stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: user.email,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${siteUrl}/circulo-cms-plus?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/circulo-cms-plus?payment_cancelled=true`,
            metadata,
            subscription_data: { metadata },
          })
        })()
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
                  images: [imageUrl],
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
          subscription_data: { metadata },
        })

    if (!session.url) throw new Error('No se pudo crear la sesión de pago CMS-Plus')
    return { url: session.url, sessionId: session.id }
  })

/** Checkout mensual del módulo Expediente clínico (precio según nivel CMS-Plus). */
export const createExpedienteCheckoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionUser = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const access = await getExpedienteAccess(supabase, sessionUser.user, sessionUser.profile)

  if (access.ok) {
    return { alreadyActive: true as const, precioLabel: access.precioLabel }
  }

  if (access.esOwner || access.precioMensualMxn === 0) {
    await activateExpedienteClinico(supabase, {
      userId: sessionUser.user.id,
      email: sessionUser.user.email,
      permanent: true,
      precioMxn: 0,
      source: 'owner_gratis_checkout',
    })
    return { alreadyActive: true as const, precioLabel: 'Gratis (creador)' }
  }

  const cms = await getCmsPlusStatus(supabase, sessionUser.user.id)
  const cmsNivel = cms.active ? cms.nivel : null
  const unitAmount = precioExpedienteCentavos({ esOwner: false, cmsNivel })
  const stripe = getStripe()
  const siteUrl = siteBaseUrl()
  const metadata = {
    userId: sessionUser.user.id,
    producto: PRODUCTO_EXPEDIENTE,
    cms_nivel: cmsNivel || '',
    precio_mxn: String(access.precioMensualMxn),
    plan: 'monthly',
  }

  // price_data dinámico: la cuota cambia por nivel CMS-Plus (300–800 MXN).
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: sessionUser.user.email,
    line_items: [
      {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Expediente clínico normativo — ContacNeed',
            description:
              'Control de pacientes NOM-004/NOM-024: historia clínica, evolución y grabaciones. Precio según tu nivel CMS-Plus.',
          },
          unit_amount: unitAmount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/expediente-clinico?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/expediente-clinico?payment_cancelled=true`,
    metadata,
    subscription_data: { metadata },
  })

  if (!session.url) throw new Error('No se pudo crear la sesión de pago del expediente')
  return { url: session.url, sessionId: session.id, precioLabel: access.precioLabel }
})

/** Checkout mensual Tu Contador Privado (precio según CMS-Plus / PRO). */
export const createContadorCheckoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionUser = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const access = await getContadorAccess(supabase, sessionUser.user, sessionUser.profile)

  if (access.ok) {
    return { alreadyActive: true as const, precioLabel: access.precioLabel }
  }

  if (access.esOwner || access.precioMensualMxn === 0) {
    await activateContadorPrivado(supabase, {
      userId: sessionUser.user.id,
      email: sessionUser.user.email,
      permanent: true,
      precioMxn: 0,
      source: 'owner_gratis_checkout',
    })
    return { alreadyActive: true as const, precioLabel: 'Gratis (creador)' }
  }

  const cms = await getCmsPlusStatus(supabase, sessionUser.user.id)
  const pro = await getContacNeedProStatus(supabase, sessionUser.user.id)
  const cmsNivel = cms.active ? cms.nivel : null
  const esPro = Boolean(pro.active || sessionUser.profile?.es_pro)
  const unitAmount = precioContadorCentavos({ esOwner: false, cmsNivel, esPro })
  const stripe = getStripe()
  const siteUrl = siteBaseUrl()
  const metadata = {
    userId: sessionUser.user.id,
    producto: PRODUCTO_CONTADOR,
    cms_nivel: cmsNivel || '',
    precio_mxn: String(access.precioMensualMxn),
    plan: 'monthly',
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: sessionUser.user.email,
    line_items: [
      {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Tu Contador Privado — ContacNeed',
            description:
              'Control mensual de ingresos, egresos y checklist fiscal para oficios y PyME. Precio según tu nivel.',
          },
          unit_amount: unitAmount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/tu-contador-privado?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/tu-contador-privado?payment_cancelled=true`,
    metadata,
    subscription_data: { metadata },
  })

  if (!session.url) throw new Error('No se pudo crear la sesión de pago del Contador Privado')
  return { url: session.url, sessionId: session.id, precioLabel: access.precioLabel }
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

    if (producto === PRODUCTO_EXPEDIENTE || producto === 'expediente_clinico') {
      const cms = await getCmsPlusStatus(supabase, user.id)
      const precioMxn = Number(session.metadata?.precio_mxn || 0) || undefined
      await activateExpedienteClinico(supabase, {
        userId: user.id,
        stripeSessionId: session.id,
        email: user.email,
        cmsNivel: cms.active ? cms.nivel : null,
        precioMxn,
        source: 'contacneed_confirm',
      })
      return {
        success: true,
        producto: PRODUCTO_EXPEDIENTE,
        es_pro: Boolean((await getCmsPlusStatus(supabase, user.id)).active),
      }
    }

    if (producto === PRODUCTO_CONTADOR || producto === 'contador_privado') {
      const cms = await getCmsPlusStatus(supabase, user.id)
      const precioMxn = Number(session.metadata?.precio_mxn || 0) || undefined
      await activateContadorPrivado(supabase, {
        userId: user.id,
        stripeSessionId: session.id,
        email: user.email,
        cmsNivel: cms.active ? cms.nivel : null,
        precioMxn,
        source: 'contacneed_confirm',
      })
      return {
        success: true,
        producto: PRODUCTO_CONTADOR,
        es_pro: Boolean((await getContacNeedProStatus(supabase, user.id)).active),
      }
    }

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
        legacyCode: result.legacyCode,
        emailed: Boolean(result.emailed),
      }
    }

    const planRaw = String(session.metadata?.plan || '').toLowerCase()
    const planType = planRaw === 'annual' || planRaw === 'anual' ? 'annual' : 'monthly'
    const out = await upsertContacNeedPro(supabase, user.id, planType, session.id, {
      email: user.email,
      notifySource: 'contacneed_confirm',
    })
    let emailed = false
    let emailWarning: string | undefined
    if (user.email) {
      const { data: proRow } = await supabase
        .from('ecosistema_entitlements')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('producto', 'contacneed_pro')
        .eq('status', 'active')
        .maybeSingle()
      const meta = (proRow?.metadata || {}) as Record<string, unknown>
      const already =
        Boolean(meta.codigo_notificado_at) &&
        String(meta.codigo_cms || '').toUpperCase() === String(out.legacyCode).toUpperCase()
      if (!already) {
        const mail = await notifyPrivilegeGrant({
          email: user.email,
          nombre: null,
          codigoCms: out.legacyCode,
          privilegios: [
            planType === 'annual' ? 'ContacNeed PRO — Anual' : 'ContacNeed PRO — Mensual',
          ],
        })
        emailed = mail.emailed
        if (!mail.emailed) emailWarning = mail.warning
        if (mail.emailed && proRow?.id) {
          await supabase
            .from('ecosistema_entitlements')
            .update({
              metadata: {
                ...meta,
                codigo_cms: out.legacyCode,
                email: user.email,
                codigo_notificado_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', proRow.id)
        }
      } else {
        emailed = true
      }
    }

    return {
      success: true,
      es_pro: true,
      producto: 'contacneed_pro',
      legacyCode: out.legacyCode,
      emailed,
      emailWarning,
    }
  })
