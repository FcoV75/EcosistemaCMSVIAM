import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeSupabaseUrl(raw) {
  const value = String(raw || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
  if (!value) return ''
  const embedded = value.match(/https?:\/\/[a-z0-9-]+\.supabase\.co/i)
  if (embedded) return embedded[0].replace(/\/+$/, '')
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(value)) return `https://${value}`
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin
  } catch {
    /* ignore */
  }
  return ''
}

function supabaseUrlFromEnv() {
  return (
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    ''
  )
}

function header(req, name) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || ''
}

async function upsertContacNeedPro(supabase, userId, planType, sessionId) {
  const plan = planType === 'annual' ? 'anual' : 'mensual'
  const expiresAt =
    planType === 'annual'
      ? new Date(Date.now() + 365 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()

  const { data: existente, error: findError } = await supabase
    .from('ecosistema_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('producto', 'contacneed_pro')
    .eq('status', 'active')
    .maybeSingle()

  if (findError) throw findError

  const row = {
    user_id: userId,
    producto: 'contacneed_pro',
    plan,
    status: 'active',
    expires_at: expiresAt,
    stripe_session_id: sessionId || null,
    metadata: { source: 'contacneed_webhook' },
    updated_at: new Date().toISOString(),
  }

  if (existente?.id) {
    const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', existente.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('ecosistema_entitlements').insert(row)
    if (error) throw error
  }
}

async function activateEscuelaFromCheckout(supabase, session) {
  const slug = session.metadata?.curso_slug
  const userId = session.metadata?.userId || null
  const email = session.metadata?.email || null
  if (!slug) return { warning: 'checkout de escuela sin curso_slug' }

  const now = new Date().toISOString()
  const { data: rows } = await supabase
    .from('ecosistema_entitlements')
    .select('id, user_id, metadata')
    .eq('producto', 'escuela_principios')
    .eq('status', 'active')
    .limit(300)

  const already = (rows || []).find((row) => {
    const meta = row.metadata || {}
    return meta.curso_slug === slug && ((userId && row.user_id === userId) || (email && meta.email === email))
  })

  const row = {
    user_id: userId,
    producto: 'escuela_principios',
    plan: 'recuperacion',
    status: 'active',
    expires_at: null,
    stripe_session_id: session.id || null,
    metadata: { curso_slug: slug, email, source: 'contacneed_webhook', recuperacion_mxn: 200 },
    updated_at: now,
  }

  if (already?.id) {
    const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', already.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('ecosistema_entitlements').insert({ ...row, starts_at: now })
    if (error) throw error
  }
  return { activated: true, producto: 'escuela_principios', slug, userId }
}

async function activateProFromCheckout(session) {
  const producto = session.metadata?.producto || 'contacneed_pro'
  if (producto === 'escuela_principios') {
    const supabaseUrl = supabaseUrlFromEnv()
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase no configurado para ContacNeed.')
    }
    const supabase = createClient(supabaseUrl, supabaseKey)
    return activateEscuelaFromCheckout(supabase, session)
  }
  if (producto !== 'contacneed_pro') {
    return { ignored: true, producto }
  }

  const userId = session.metadata?.userId
  if (!userId) {
    return {
      warning: 'checkout sin userId en metadata; use confirmStripeSessionFn en el cliente.',
    }
  }

  const supabaseUrl = supabaseUrlFromEnv()
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase no configurado para ContacNeed.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const planType = session.metadata?.plan === 'annual' ? 'annual' : 'monthly'
  await upsertContacNeedPro(supabase, userId, planType, session.id)
  return { activated: true, userId, planType }
}

/**
 * Webhook Stripe → ContacNeed PRO
 * Debe devolver 2xx para que Stripe marque el evento como entregado.
 */
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeSecret) {
    return json(500, { error: 'Stripe no configurado.' })
  }
  if (!webhookSecret) {
    return json(500, { error: 'STRIPE_WEBHOOK_SECRET no configurado en Netlify.' })
  }

  const stripe = new Stripe(stripeSecret)
  const signature = header(req, 'stripe-signature')
  if (!signature) {
    return json(400, { error: 'Falta cabecera stripe-signature.' })
  }

  // Firma Stripe exige el cuerpo crudo (texto), no JSON parseado.
  const rawBody = await req.text()

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('stripe-webhook signature:', error.message)
    return json(400, { error: `Webhook Error: ${error.message}` })
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const result = await activateProFromCheckout(stripeEvent.data.object)
      return json(200, { received: true, type: stripeEvent.type, ...result })
    }

    // Renovaciones / facturas: acusamos recibo para no saturar reintentos.
    // La activación principal de PRO sigue en checkout.session.completed (+ confirm del cliente).
    if (
      stripeEvent.type === 'invoice.paid' ||
      stripeEvent.type === 'invoice.payment_succeeded' ||
      stripeEvent.type === 'customer.subscription.updated' ||
      stripeEvent.type === 'customer.subscription.created' ||
      stripeEvent.type === 'customer.subscription.deleted'
    ) {
      return json(200, { received: true, type: stripeEvent.type, noted: true })
    }

    return json(200, { received: true, type: stripeEvent.type })
  } catch (error) {
    console.error('stripe-webhook handler:', error)
    return json(500, {
      error: error instanceof Error ? error.message : 'Error procesando webhook',
    })
  }
}
