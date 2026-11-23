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

const CMS_PLUS_CREDITOS = {
  plata: 3,
  oro: 6,
  platino: 10,
  diamante: 16,
}

const CMS_PLUS_ANUNCIOS = {
  plata: 2,
  oro: 3,
  platino: 6,
  diamante: 12,
}

function periodoActual() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function generarCodigoCmsCandidate() {
  return 'CMS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function ensureLegacyCmsCode(supabase, { userId, email }) {
  const mail = String(email || '')
    .trim()
    .toLowerCase()

  if (userId) {
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('legacy_code')
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('legacy_code', 'is', null)
      .limit(20)
    const existing = (data || []).find((r) => r.legacy_code)?.legacy_code
    if (existing) return String(existing).toUpperCase()
  }

  if (mail) {
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('legacy_code, metadata')
      .eq('status', 'active')
      .not('legacy_code', 'is', null)
      .limit(300)
    const match = (data || []).find(
      (r) =>
        String((r.metadata || {}).email || '')
          .trim()
          .toLowerCase() === mail,
    )
    if (match?.legacy_code) return String(match.legacy_code).toUpperCase()
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generarCodigoCmsCandidate()
    const { data: collision } = await supabase
      .from('ecosistema_entitlements')
      .select('id')
      .eq('legacy_code', code)
      .limit(1)
      .maybeSingle()
    if (!collision?.id) return code
  }
  throw new Error('No se pudo generar un código CMS único.')
}

async function sendPrivilegeEmail({ to, codigoCms, privilegios }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    return { emailed: false, warning: 'Sin RESEND_API_KEY: no se envió el correo con el código CMS.' }
  }
  const from = String(process.env.RESEND_FROM || 'ContacNeed <noreply@contacneed.com>').trim()
  const lista = (privilegios || []).map((p) => `<li style="margin:0 0 6px">${p}</li>`).join('')
  const site = process.env.URL || process.env.VITE_SITE_URL || 'https://contacneed.com'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Tus accesos ContacNeed / Ecosistema VIAM — código ${codigoCms}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;max-width:560px">
          <h2 style="margin:0 0 12px">Accesos activados</h2>
          <p>Se activaron privilegios en tu cuenta del ecosistema ContacNeed / VIAM:</p>
          <ul style="padding-left:18px;margin:12px 0">${lista}</ul>
          <p style="margin:18px 0 8px"><strong>Tu código unificado del ecosistema:</strong></p>
          <p style="font-size:22px;font-weight:800;letter-spacing:1px;background:#111;color:#f5d76e;display:inline-block;padding:10px 16px;border-radius:10px;margin:0">${codigoCms}</p>
          <p style="margin:18px 0 8px">
            <a href="${site}/login" style="display:inline-block;padding:12px 18px;background:#d4a017;color:#111;text-decoration:none;border-radius:8px;font-weight:700">Entrar a ContacNeed</a>
          </p>
          <p style="color:#555;font-size:13px;margin-top:20px">
            Guarda este correo. El código te sirve para ContacNeed PRO, Círculo CMS-Plus, Sincronía Nexus, Video Diamante y el Curso de Promotores según lo que te hayan otorgado.
          </p>
        </div>
      `,
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    return { emailed: false, warning: body || `Resend ${response.status}` }
  }
  return { emailed: true }
}

async function upsertEntitlementRow(
  supabase,
  { userId, producto, plan, expiresAt, sessionId, metadata, legacyCode },
) {
  const { data: existente, error: findError } = await supabase
    .from('ecosistema_entitlements')
    .select('id, legacy_code, metadata')
    .eq('user_id', userId)
    .eq('producto', producto)
    .eq('status', 'active')
    .maybeSingle()

  if (findError) throw findError

  const prevMeta = (existente?.metadata || {})
  const code = legacyCode || existente?.legacy_code || null
  const row = {
    user_id: userId,
    producto,
    plan,
    status: 'active',
    expires_at: expiresAt,
    stripe_session_id: sessionId || null,
    legacy_code: code,
    metadata: { ...prevMeta, ...(metadata || {}), ...(code ? { codigo_cms: code } : {}) },
    updated_at: new Date().toISOString(),
  }

  if (existente?.id) {
    const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', existente.id)
    if (error) throw error
    return { id: existente.id, legacyCode: code, metadata: row.metadata }
  }

  const { data: inserted, error } = await supabase
    .from('ecosistema_entitlements')
    .insert({ ...row, starts_at: new Date().toISOString() })
    .select('id')
    .maybeSingle()
  if (error) throw error
  return { id: inserted?.id, legacyCode: code, metadata: row.metadata }
}

async function upsertContacNeedPro(supabase, userId, planType, sessionId, metadata = {}, legacyCode = null) {
  const plan = planType === 'annual' ? 'anual' : 'mensual'
  const expiresAt =
    planType === 'annual'
      ? new Date(Date.now() + 365 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()

  return upsertEntitlementRow(supabase, {
    userId,
    producto: 'contacneed_pro',
    plan,
    expiresAt,
    sessionId,
    legacyCode,
    metadata: { source: 'contacneed_webhook', ...metadata },
  })
}

async function ensureCmsPlusCreditos(supabase, userId, nivel) {
  const periodo = periodoActual()
  const allotment = CMS_PLUS_CREDITOS[nivel] || 3
  const { data: existing } = await supabase
    .from('cms_plus_creditos')
    .select('id')
    .eq('user_id', userId)
    .eq('periodo', periodo)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from('cms_plus_creditos')
      .update({ nivel, allotment, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    return
  }

  await supabase.from('cms_plus_creditos').insert({
    user_id: userId,
    periodo,
    allotment,
    usados: 0,
    compartidos_enviados: 0,
    nivel,
  })
}

async function activateCmsPlusFromCheckout(supabase, session) {
  const userId = session.metadata?.userId
  if (!userId) {
    return {
      warning: 'cms_plus checkout sin userId; use confirmStripeSessionFn en el cliente.',
    }
  }

  const nivel = ['plata', 'oro', 'platino', 'diamante'].includes(session.metadata?.nivel)
    ? session.metadata.nivel
    : 'plata'
  const billing =
    session.metadata?.billing === 'anual' || session.metadata?.plan === 'annual' ? 'anual' : 'mensual'
  const planType = billing === 'anual' ? 'annual' : 'monthly'
  const expiresAt =
    billing === 'anual'
      ? new Date(Date.now() + 365 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()
  const billingPlan = billing === 'anual' ? 'anual' : 'mensual'
  const email =
    String(session.customer_details?.email || session.customer_email || session.metadata?.email || '')
      .trim()
      .toLowerCase() || null
  const legacyCode = await ensureLegacyCmsCode(supabase, { userId, email })
  const meta = {
    source: 'contacneed_webhook',
    nivel,
    billing,
    bundle: 'cms_plus',
    codigo_cms: legacyCode,
    email,
  }

  const cmsRow = await upsertEntitlementRow(supabase, {
    userId,
    producto: 'cms_plus',
    plan: nivel,
    expiresAt,
    sessionId: session.id,
    legacyCode,
    metadata: meta,
  })
  await upsertContacNeedPro(
    supabase,
    userId,
    planType,
    session.id,
    { via: 'cms_plus', nivel, email, codigo_cms: legacyCode },
    legacyCode,
  )
  await upsertEntitlementRow(supabase, {
    userId,
    producto: 'sincronia_nexus',
    plan: billingPlan,
    expiresAt,
    sessionId: session.id,
    legacyCode,
    metadata: { ...meta, via: 'cms_plus' },
  })
  await upsertEntitlementRow(supabase, {
    userId,
    producto: 'video_diamante_premium',
    plan: billingPlan,
    expiresAt,
    sessionId: session.id,
    legacyCode,
    metadata: { ...meta, via: 'cms_plus' },
  })

  await supabase
    .from('perfiles')
    .update({
      es_pro: true,
      pro_plan_type: planType,
      pro_extra_ad_slots: Math.max(0, (CMS_PLUS_ANUNCIOS[nivel] || 2) - 1),
    })
    .eq('id', userId)

  try {
    await ensureCmsPlusCreditos(supabase, userId, nivel)
  } catch (err) {
    console.warn('cms_plus creditos webhook:', err?.message || err)
  }

  let emailed = false
  let emailWarning
  const alreadyNotified =
    cmsRow?.metadata?.codigo_notificado_at &&
    String(cmsRow.metadata.codigo_cms || '').toUpperCase() === legacyCode
  if (email && !alreadyNotified) {
    const nivelLabel = nivel.charAt(0).toUpperCase() + nivel.slice(1)
    const mail = await sendPrivilegeEmail({
      to: email,
      codigoCms: legacyCode,
      privilegios: [
        `Círculo CMS-Plus ${nivelLabel} — ${billing === 'anual' ? 'Anual' : 'Mensual'}`,
        'ContacNeed PRO + Sincronía Nexus + Video Diamante (bundle Plus)',
        `${CMS_PLUS_CREDITOS[nivel] || 3} créditos de salud / mes y círculo de beneficiarios`,
      ],
    })
    emailed = Boolean(mail.emailed)
    emailWarning = mail.warning
    if (emailed && cmsRow?.id) {
      await supabase
        .from('ecosistema_entitlements')
        .update({
          metadata: {
            ...meta,
            codigo_notificado_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', cmsRow.id)
    }
  } else if (!email) {
    emailWarning = 'Activado sin correo de cliente para enviar el código CMS.'
  }

  return {
    activated: true,
    producto: 'cms_plus',
    userId,
    nivel,
    billing,
    legacyCode,
    emailed,
    emailWarning,
  }
}

async function activateContadorFromCheckout(supabase, session) {
  const userId = session.metadata?.userId
  if (!userId) {
    return { warning: 'checkout contador_privado sin userId en metadata' }
  }
  const email =
    String(session.customer_details?.email || session.customer_email || session.metadata?.email || '')
      .trim()
      .toLowerCase() || null
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
  const precioMxn = Number(session.metadata?.precio_mxn || 0) || null
  const cmsNivel = session.metadata?.cms_nivel || null
  await upsertEntitlementRow(supabase, {
    userId,
    producto: 'contador_privado',
    plan: 'mensual',
    expiresAt,
    sessionId: session.id,
    legacyCode: null,
    metadata: {
      source: 'contacneed_webhook',
      cms_nivel: cmsNivel,
      precio_mxn: precioMxn,
      email,
    },
  })
  return { activated: true, producto: 'contador_privado', userId, expiresAt, precioMxn }
}

async function activateExpedienteFromCheckout(supabase, session) {
  const userId = session.metadata?.userId
  if (!userId) {
    return { warning: 'checkout expediente_clinico sin userId en metadata' }
  }
  const email =
    String(session.customer_details?.email || session.customer_email || session.metadata?.email || '')
      .trim()
      .toLowerCase() || null
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
  const precioMxn = Number(session.metadata?.precio_mxn || 0) || null
  const cmsNivel = session.metadata?.cms_nivel || null
  await upsertEntitlementRow(supabase, {
    userId,
    producto: 'expediente_clinico',
    plan: 'mensual',
    expiresAt,
    sessionId: session.id,
    legacyCode: null,
    metadata: {
      source: 'contacneed_webhook',
      cms_nivel: cmsNivel,
      precio_mxn: precioMxn,
      email,
    },
  })
  return { activated: true, producto: 'expediente_clinico', userId, expiresAt, precioMxn }
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
    if (error) {
      const msg = `${error.message || ''} ${error.code || ''} ${error.details || ''}`.toLowerCase()
      const uniqueHit =
        msg.includes('idx_eco_ent_user_producto') ||
        msg.includes('duplicate') ||
        msg.includes('unique') ||
        error.code === '23505'
      if (uniqueHit && userId) {
        const { data: existente } = await supabase
          .from('ecosistema_entitlements')
          .select('id, metadata')
          .eq('user_id', userId)
          .eq('producto', 'escuela_principios')
          .eq('status', 'active')
          .maybeSingle()
        if (existente?.id) {
          const prev = existente.metadata || {}
          const slugs = new Set([
            ...(Array.isArray(prev.curso_slugs) ? prev.curso_slugs : []),
            ...(prev.curso_slug ? [prev.curso_slug] : []),
            slug,
          ])
          const { error: upErr } = await supabase
            .from('ecosistema_entitlements')
            .update({
              ...row,
              metadata: {
                ...prev,
                ...row.metadata,
                curso_slug: slug,
                curso_slugs: [...slugs],
              },
            })
            .eq('id', existente.id)
          if (upErr) throw upErr
          return { activated: true, producto: 'escuela_principios', slug, userId, merged: true }
        }
      }
      throw error
    }
  }
  return { activated: true, producto: 'escuela_principios', slug, userId }
}

async function activateProFromCheckout(session) {
  const producto = session.metadata?.producto || 'contacneed_pro'
  const supabaseUrl = supabaseUrlFromEnv()
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase no configurado para ContacNeed.')
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (producto === 'escuela_principios') {
    return activateEscuelaFromCheckout(supabase, session)
  }
  if (producto === 'cms_plus') {
    return activateCmsPlusFromCheckout(supabase, session)
  }
  if (producto === 'expediente_clinico') {
    return activateExpedienteFromCheckout(supabase, session)
  }
  if (producto === 'contador_privado') {
    return activateContadorFromCheckout(supabase, session)
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

  const planRaw = String(session.metadata?.plan || '').toLowerCase()
  const planType = planRaw === 'annual' || planRaw === 'anual' ? 'annual' : 'monthly'
  const email =
    String(session.customer_details?.email || session.customer_email || session.metadata?.email || '')
      .trim()
      .toLowerCase() || null
  const legacyCode = await ensureLegacyCmsCode(supabase, { userId, email })
  const proRow = await upsertContacNeedPro(
    supabase,
    userId,
    planType,
    session.id,
    { email, codigo_cms: legacyCode },
    legacyCode,
  )

  let emailed = false
  let emailWarning
  const alreadyNotified =
    proRow?.metadata?.codigo_notificado_at &&
    String(proRow.metadata.codigo_cms || '').toUpperCase() === legacyCode
  if (email && !alreadyNotified) {
    const mail = await sendPrivilegeEmail({
      to: email,
      codigoCms: legacyCode,
      privilegios: [
        planType === 'annual' ? 'ContacNeed PRO — Anual' : 'ContacNeed PRO — Mensual',
      ],
    })
    emailed = Boolean(mail.emailed)
    emailWarning = mail.warning
    if (emailed && proRow?.id) {
      await supabase
        .from('ecosistema_entitlements')
        .update({
          metadata: {
            ...(proRow.metadata || {}),
            codigo_cms: legacyCode,
            email,
            codigo_notificado_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', proRow.id)
    }
  }

  await supabase
    .from('perfiles')
    .update({
      es_pro: true,
      pro_plan_type: planType,
    })
    .eq('id', userId)

  return { activated: true, userId, planType, legacyCode, emailed, emailWarning }
}

async function renewFromInvoice(stripe, invoice) {
  const supabaseUrl = supabaseUrlFromEnv()
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase no configurado para ContacNeed.')
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subscriptionId) return { skipped: true, reason: 'sin_subscription' }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const meta = subscription.metadata || {}
  const userId = meta.userId
  if (!userId) return { skipped: true, reason: 'sin_userId_en_subscription' }

  const producto = meta.producto || 'contacneed_pro'
  const planRaw = String(meta.plan || meta.billing || '').toLowerCase()
  const billing =
    planRaw === 'anual' || planRaw === 'annual' || meta.billing === 'anual' ? 'anual' : 'mensual'
  const planType = billing === 'anual' ? 'annual' : 'monthly'
  const expiresAt =
    billing === 'anual'
      ? new Date(Date.now() + 365 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()
  const email =
    String(invoice.customer_email || meta.email || '')
      .trim()
      .toLowerCase() || null
  const legacyCode = await ensureLegacyCmsCode(supabase, { userId, email })

  if (producto === 'expediente_clinico') {
    await upsertEntitlementRow(supabase, {
      userId,
      producto: 'expediente_clinico',
      plan: 'mensual',
      expiresAt,
      sessionId: invoice.id,
      legacyCode,
      metadata: {
        source: 'contacneed_webhook_renewal',
        cms_nivel: meta.cms_nivel || null,
        precio_mxn: Number(meta.precio_mxn || 0) || null,
        email,
      },
    })
    return { renewed: true, producto: 'expediente_clinico', userId, expiresAt }
  }

  if (producto === 'contador_privado') {
    await upsertEntitlementRow(supabase, {
      userId,
      producto: 'contador_privado',
      plan: 'mensual',
      expiresAt,
      sessionId: invoice.id,
      legacyCode,
      metadata: {
        source: 'contacneed_webhook_renewal',
        cms_nivel: meta.cms_nivel || null,
        precio_mxn: Number(meta.precio_mxn || 0) || null,
        email,
      },
    })
    return { renewed: true, producto: 'contador_privado', userId, expiresAt }
  }

  if (producto === 'cms_plus') {
    const nivel = ['plata', 'oro', 'platino', 'diamante'].includes(meta.nivel) ? meta.nivel : 'plata'
    const shared = {
      source: 'contacneed_webhook_renewal',
      nivel,
      billing,
      bundle: 'cms_plus',
      codigo_cms: legacyCode,
      email,
    }
    await upsertEntitlementRow(supabase, {
      userId,
      producto: 'cms_plus',
      plan: nivel,
      expiresAt,
      sessionId: invoice.id,
      legacyCode,
      metadata: shared,
    })
    await upsertContacNeedPro(
      supabase,
      userId,
      planType,
      invoice.id,
      { via: 'cms_plus_renewal', nivel, email, codigo_cms: legacyCode },
      legacyCode,
    )
    await upsertEntitlementRow(supabase, {
      userId,
      producto: 'sincronia_nexus',
      plan: billing,
      expiresAt,
      sessionId: invoice.id,
      legacyCode,
      metadata: { ...shared, via: 'cms_plus' },
    })
    await upsertEntitlementRow(supabase, {
      userId,
      producto: 'video_diamante_premium',
      plan: billing,
      expiresAt,
      sessionId: invoice.id,
      legacyCode,
      metadata: { ...shared, via: 'cms_plus' },
    })
    await ensureCmsPlusCreditos(supabase, userId, nivel)
    return { renewed: true, producto: 'cms_plus', userId, nivel, expiresAt, legacyCode }
  }

  await upsertContacNeedPro(
    supabase,
    userId,
    planType,
    invoice.id,
    { email, codigo_cms: legacyCode, source: 'contacneed_webhook_renewal' },
    legacyCode,
  )
  return { renewed: true, producto: 'contacneed_pro', userId, expiresAt, legacyCode }
}

/**
 * Webhook Stripe → ContacNeed PRO / CMS-Plus
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

    if (stripeEvent.type === 'invoice.paid' || stripeEvent.type === 'invoice.payment_succeeded') {
      const invoice = stripeEvent.data.object
      // Evita doble extensión en el primer pago (ya cubierto por checkout.session.completed).
      if (invoice.billing_reason === 'subscription_create') {
        return json(200, { received: true, type: stripeEvent.type, noted: 'first_invoice' })
      }
      const result = await renewFromInvoice(stripe, invoice)
      return json(200, { received: true, type: stripeEvent.type, ...result })
    }

    if (
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
