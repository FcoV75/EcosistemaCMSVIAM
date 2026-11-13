import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser, requireActiveUser, requireAdminUser } from '../lib/auth'
import {
  aceptarInvitacionCirculo,
  activateCmsPlus,
  catalogoPublicoCmsPlus,
  getCmsPlusStatus,
  getCreditosResumen,
  invitarAlCirculo,
  listarCirculoTitular,
  otorgarBonoFidelidad,
  registrarUsoCredito,
  revokeCmsPlus,
} from '../lib/cms-plus-entitlements'
import {
  CMS_PLUS_MANIFIESTO,
  isCmsPlusNivel,
  type CmsPlusBilling,
  type CmsPlusNivel,
} from '../lib/cms-plus'
import { normalizarEmail } from '../lib/promotores-viam'

export const getCmsPlusCatalogoFn = createServerFn({ method: 'GET' }).handler(async () => {
  return {
    nombre: 'Círculo CMS-Plus Membresías',
    manifiesto: CMS_PLUS_MANIFIESTO,
    niveles: catalogoPublicoCmsPlus(),
  }
})

export const getMiCmsPlusFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  if (!user) {
    return {
      loggedIn: false,
      membership: null,
      creditos: null,
      circulo: [] as Awaited<ReturnType<typeof listarCirculoTitular>>,
    }
  }

  const supabase = createSupabaseAdminClient()
  const membership = await getCmsPlusStatus(supabase, user.id)
  let creditos = null
  let circulo: Awaited<ReturnType<typeof listarCirculoTitular>> = []

  if (membership.active && membership.nivel) {
    try {
      creditos = await getCreditosResumen(supabase, user.id, membership.nivel)
    } catch (err) {
      console.warn('cms-plus créditos:', err)
    }
    try {
      circulo = await listarCirculoTitular(supabase, user.id)
    } catch (err) {
      console.warn('cms-plus círculo:', err)
    }
  }

  return { loggedIn: true, membership, creditos, circulo }
})

export const invitarCirculoCmsPlusFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email?: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const membership = await getCmsPlusStatus(supabase, user.id)
    if (!membership.active || !membership.nivel) {
      throw new Error('Necesitas una membresía CMS-Plus activa para invitar.')
    }

    const invite = await invitarAlCirculo(supabase, {
      titularId: user.id,
      email: data.email,
      nivel: membership.nivel,
    })

    const siteUrl = process.env.URL ?? process.env.VITE_SITE_URL ?? 'https://contacneed.com'
    return {
      ok: true,
      token: invite.token,
      inviteUrl: `${siteUrl}/circulo-cms-plus?invite=${invite.token}`,
      descuento_pct: invite.descuento_pct,
    }
  })

export const aceptarCirculoCmsPlusFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const invite = await aceptarInvitacionCirculo(supabase, {
      token: data.token,
      userId: user.id,
    })
    return { ok: true, invite }
  })

export const usarCreditoCmsPlusFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { cantidad?: number; nota?: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const membership = await getCmsPlusStatus(supabase, user.id)
    if (!membership.active || !membership.nivel) {
      throw new Error('Necesitas CMS-Plus activo para usar créditos.')
    }
    const row = await registrarUsoCredito(supabase, {
      userId: user.id,
      nivel: membership.nivel,
      cantidad: data.cantidad || 1,
      nota: data.nota,
    })
    return { ok: true, creditos: row }
  })

export const otorgarCmsPlusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      email: string
      nivel: CmsPlusNivel
      billing?: CmsPlusBilling
      permanent?: boolean
      nombre?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    if (!isCmsPlusNivel(data.nivel)) throw new Error('Nivel inválido')

    const mail = normalizarEmail(data.email)
    if (!mail.includes('@')) throw new Error('Correo inválido')

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
    if (!userId) throw new Error('No hay cuenta ContacNeed con ese correo. Que se registre primero.')

    const result = await activateCmsPlus(supabase, {
      userId,
      nivel: data.nivel,
      billing: data.billing || 'mensual',
      email: mail,
      source: 'admin',
      permanent: Boolean(data.permanent),
    })

    return {
      ok: true,
      userId,
      nivel: result.nivel,
      legacyCode: result.legacyCode,
      nota: `CMS-Plus ${result.tier.nombre} otorgado a ${mail}`,
    }
  })

export const revocarCmsPlusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const supabase = createSupabaseAdminClient()
    await revokeCmsPlus(supabase, data.userId)
    return { ok: true }
  })

export const listCmsPlusAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await requireAdminUser()
  if (!admin) throw new Error('Acceso denegado: se requiere administrador')
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('id, user_id, plan, status, expires_at, metadata, legacy_code, created_at')
    .eq('producto', 'cms_plus')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error

  return {
    membresias: (data || []).map((row) => {
      const meta = (row.metadata || {}) as { email?: string; billing?: string; permanent?: boolean }
      return {
        id: row.id,
        user_id: row.user_id,
        nivel: row.plan,
        status: row.status,
        billing: meta.billing || 'mensual',
        email: meta.email || null,
        permanent: Boolean(meta.permanent) || !row.expires_at,
        expires_at: row.expires_at,
        legacy_code: row.legacy_code,
        created_at: row.created_at,
      }
    }),
  }
})

export const registrarConversionCirculoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { titularId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const membership = await getCmsPlusStatus(supabase, data.titularId)
    if (!membership.active || !membership.nivel) return { skipped: true }

    const { data: invite } = await supabase
      .from('cms_plus_circulo')
      .select('id')
      .eq('titular_id', data.titularId)
      .eq('beneficiario_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (invite?.id) {
      await supabase
        .from('cms_plus_circulo')
        .update({ status: 'converted', updated_at: new Date().toISOString() })
        .eq('id', invite.id)
    }

    return otorgarBonoFidelidad(supabase, {
      titularId: data.titularId,
      nivel: membership.nivel,
    })
  })
