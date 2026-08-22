import { createServerFn } from '@tanstack/react-start'
import { CURSOS_BUNDLED } from './cursos-bundled'
import Stripe from 'stripe'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser, requireActiveUser, requireAdminUser } from '../lib/auth'
import { normalizarEmail } from '../lib/promotores-viam'
import {
  CURSOS_EDUCATIVOS,
  ESCUELA_LEMA,
  ESCUELA_TITULO,
  PLAN_RECUPERACION,
  PRECIO_RECUPERACION_CENTAVOS,
  PRECIO_RECUPERACION_MXN,
  PRODUCTO_ESCUELA,
  cursosPublicos,
  getCursoBySlug,
  randomIntegrationSuffix,
  type SesionViva,
} from '../lib/cursos-educativos'
import { getSiteUrl } from '../lib/site-url'

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY no configurada en Netlify')
  return new Stripe(secret)
}

function vigente(row: { status: string; expires_at: string | null }) {
  if (row.status !== 'active') return false
  if (!row.expires_at) return true
  return new Date(row.expires_at).getTime() > Date.now()
}

export async function usuarioTieneCurso(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  slug: string,
) {
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('id, status, expires_at, metadata, plan')
    .eq('user_id', userId)
    .eq('producto', PRODUCTO_ESCUELA)
    .eq('status', 'active')
    .limit(40)

  if (error) throw error
  return (data ?? []).some((row) => {
    if (!vigente(row)) return false
    const meta = (row.metadata || {}) as { curso_slug?: string }
    return meta.curso_slug === slug || row.plan === 'propietario'
  })
}

export async function upsertAccesoCurso(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  {
    userId,
    email,
    slug,
    stripeSessionId,
    source,
  }: {
    userId: string | null
    email?: string | null
    slug: string
    stripeSessionId?: string | null
    source: string
  },
) {
  const now = new Date().toISOString()
  const { data: rows } = await supabase
    .from('ecosistema_entitlements')
    .select('id, user_id, metadata')
    .eq('producto', PRODUCTO_ESCUELA)
    .eq('status', 'active')
    .limit(300)

  const already = (rows || []).find((row) => {
    const meta = (row.metadata || {}) as { curso_slug?: string; email?: string }
    const sameSlug = meta.curso_slug === slug
    const sameUser = userId && row.user_id === userId
    const sameMail = email && normalizarEmail(meta.email) === normalizarEmail(email)
    return sameSlug && (sameUser || sameMail)
  })

  const metadata = {
    curso_slug: slug,
    email: email || null,
    source,
    recuperacion_mxn: PRECIO_RECUPERACION_MXN,
  }

  const row = {
    user_id: userId,
    producto: PRODUCTO_ESCUELA,
    plan: PLAN_RECUPERACION,
    status: 'active',
    expires_at: null,
    stripe_session_id: stripeSessionId || null,
    metadata,
    updated_at: now,
  }

  if (already?.id) {
    const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', already.id)
    if (error) throw error
    return { id: already.id, updated: true }
  }

  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .insert({ ...row, starts_at: now })
    .select('id')
    .single()
  if (error) throw error
  return { id: data?.id, created: true }
}

async function leerAgenda(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<{ id: string | null; sesiones: SesionViva[] }> {
  const { data } = await supabase
    .from('ecosistema_entitlements')
    .select('id, metadata')
    .eq('producto', 'escuela_agenda')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const sesiones = ((data?.metadata as { sesiones?: SesionViva[] } | null)?.sesiones || []).filter(
    Boolean,
  )
  return { id: data?.id ?? null, sesiones }
}

export const getEscuelaPublicaFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  const supabase = createSupabaseAdminClient()
  const agenda = await leerAgenda(supabase)
  let misSlugs: string[] = []
  if (user) {
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('metadata, status, expires_at')
      .eq('user_id', user.id)
      .eq('producto', PRODUCTO_ESCUELA)
      .eq('status', 'active')
    misSlugs = (data ?? [])
      .filter((row) => vigente(row))
      .map((row) => ((row.metadata || {}) as { curso_slug?: string }).curso_slug)
      .filter((slug): slug is string => Boolean(slug))
  }

  return {
    titulo: ESCUELA_TITULO,
    lema: ESCUELA_LEMA,
    precioRecuperacion: PRECIO_RECUPERACION_MXN,
    cursos: cursosPublicos(),
    sesiones: agenda.sesiones,
    misSlugs,
    loggedIn: Boolean(user),
  }
})

export const getCursoAccesoFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const curso = getCursoBySlug(data.slug)
    if (!curso) throw new Error('Curso no encontrado')

    const user = await getServerUser()
    const admin = user ? await requireAdminUser() : null
    const supabase = createSupabaseAdminClient()
    const comprado = user ? await usuarioTieneCurso(supabase, user.id, data.slug) : false
    const unlocked = Boolean(admin) || comprado

    return {
      curso,
      loggedIn: Boolean(user),
      unlocked,
      esAdmin: Boolean(admin),
      precioRecuperacion: PRECIO_RECUPERACION_MXN,
    }
  })

export const getCursoDocumentoFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { slug: string; kind: 'lecciones' | 'diapositivas' | 'guia' | 'zip' }) => d)
  .handler(async ({ data }) => {
    const curso = getCursoBySlug(data.slug)
    if (!curso || curso.estado !== 'dado') throw new Error('Este curso aún no está disponible.')

    const user = await getServerUser()
    if (!user) throw new Error('Debes iniciar sesión')
    const admin = await requireAdminUser()
    const supabase = createSupabaseAdminClient()
    const comprado = await usuarioTieneCurso(supabase, user.id, data.slug)
    if (!admin && !comprado) throw new Error('Paga la cuota de recuperación para ver y descargar este curso.')

    const bundled = CURSOS_BUNDLED[data.slug]
    if (!bundled) throw new Error('Material del curso no empaquetado.')
    if (data.kind === 'zip') {
      return {
        filename: `${data.slug}.zip`,
        mime: 'application/zip',
        zipUrl: bundled.zipPublicUrl,
      }
    }
    if (data.kind === 'guia') {
      return { filename: 'guia-docente.md', mime: 'text/markdown', text: bundled.guia }
    }
    if (data.kind === 'diapositivas') {
      const html = bundled.diapositivas.replace(
        '<script src="slides.js"></script>',
        `<script>${bundled.slides}</script>`,
      )
      return { filename: 'diapositivas.html', mime: 'text/html', html }
    }
    return { filename: 'index.html', mime: 'text/html', html: bundled.lecciones }
  })

export const createEscuelaCheckoutFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { user, profile } = await requireActiveUser()
    const curso = getCursoBySlug(data.slug)
    if (!curso || curso.estado !== 'dado') {
      throw new Error('Este curso todavía no se puede adquirir.')
    }

    const supabase = createSupabaseAdminClient()
    if (await usuarioTieneCurso(supabase, user.id, data.slug)) {
      return { url: null as string | null, already: true }
    }

    const stripe = getStripe()
    const siteUrl = getSiteUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || profile?.correo || undefined,
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            unit_amount: PRECIO_RECUPERACION_CENTAVOS,
            product_data: {
              name: `${curso.titulo} — recuperación`,
              description: `${ESCUELA_TITULO}. Ver y descargar el curso ya impartido.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/escuela/${data.slug}?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/escuela/${data.slug}?payment_cancelled=true`,
      metadata: {
        userId: user.id,
        producto: PRODUCTO_ESCUELA,
        curso_slug: data.slug,
        email: user.email || profile?.correo || '',
        integration_identifier: `escuela-recup-${randomIntegrationSuffix()}`,
      },
    })

    if (!session.url) throw new Error('No se pudo crear la sesión de pago')
    return { url: session.url, already: false }
  })

export const confirmEscuelaCheckoutFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(data.sessionId)
    if (session.payment_status !== 'paid') throw new Error('El pago aún no está confirmado')
    if (session.metadata?.userId && session.metadata.userId !== user.id) {
      throw new Error('La sesión de pago no pertenece a este usuario')
    }
    const slug = session.metadata?.curso_slug
    if (!slug || session.metadata?.producto !== PRODUCTO_ESCUELA) {
      throw new Error('Esta sesión no corresponde a un curso de la escuela')
    }

    const supabase = createSupabaseAdminClient()
    await upsertAccesoCurso(supabase, {
      userId: user.id,
      email: user.email,
      slug,
      stripeSessionId: session.id,
      source: 'stripe-checkout',
    })
    return { success: true, slug }
  })

export const listEscuelaAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdminUser()
  const supabase = createSupabaseAdminClient()
  const agenda = await leerAgenda(supabase)
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('id, user_id, plan, status, metadata, created_at, stripe_session_id')
    .eq('producto', PRODUCTO_ESCUELA)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error

  return {
    titulo: ESCUELA_TITULO,
    lema: ESCUELA_LEMA,
    cursos: CURSOS_EDUCATIVOS,
    sesiones: agenda.sesiones,
    compras: data ?? [],
    precioRecuperacion: PRECIO_RECUPERACION_MXN,
  }
})

export const otorgarCursoAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string; slug: string; nombre?: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado')
    const mail = normalizarEmail(data.email)
    if (!mail.includes('@')) throw new Error('Correo inválido')
    const curso = getCursoBySlug(data.slug)
    if (!curso || curso.estado !== 'dado') throw new Error('Curso no disponible para otorgar')

    const supabase = createSupabaseAdminClient()
    let userId: string | null = null
    for (let page = 1; page <= 10; page++) {
      const { data: pageData, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (error) break
      const hit = (pageData?.users || []).find((u) => normalizarEmail(u.email) === mail)
      if (hit) {
        userId = hit.id
        break
      }
      if (!pageData?.users?.length || pageData.users.length < 200) break
    }

    await upsertAccesoCurso(supabase, {
      userId,
      email: mail,
      slug: data.slug,
      source: `admin:${admin.user.id}`,
    })
    return { ok: true, userLinked: Boolean(userId), email: mail }
  })

export const guardarAgendaAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { sesiones: SesionViva[] }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado')
    const supabase = createSupabaseAdminClient()
    const agenda = await leerAgenda(supabase)
    const now = new Date().toISOString()
    const row = {
      user_id: admin.user.id,
      producto: 'escuela_agenda',
      plan: 'agenda',
      status: 'active',
      expires_at: null,
      metadata: { sesiones: data.sesiones, updated_by: admin.user.id },
      updated_at: now,
    }
    if (agenda.id) {
      const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', agenda.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('ecosistema_entitlements').insert({ ...row, starts_at: now })
      if (error) throw error
    }
    return { ok: true, total: data.sesiones.length }
  })
