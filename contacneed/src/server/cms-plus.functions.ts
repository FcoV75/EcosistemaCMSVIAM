import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser, requireActiveUser, requireAdminUser } from '../lib/auth'
import {
  aceptarInvitacionCirculo,
  activateCmsPlus,
  ajustarUsadosCredito,
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
  PRODUCTO_CMS_PLUS,
  getCmsPlusTier,
  isCmsPlusNivel,
  type CmsPlusBilling,
  type CmsPlusNivel,
} from '../lib/cms-plus'
import { normalizarEmail } from '../lib/promotores-viam'
import { getResendConfig, sendResendEmail } from '../lib/privilege-email'
import { getSiteUrl } from '../lib/site-url'

export const getCmsPlusCatalogoFn = createServerFn({ method: 'GET' }).handler(async () => {
  return {
    nombre: 'Círculo CMS-Plus Membresías',
    manifiesto: CMS_PLUS_MANIFIESTO,
    niveles: catalogoPublicoCmsPlus(),
  }
})

async function maybeSendRenewalReminder(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  {
    userId,
    email,
    membership,
  }: {
    userId: string
    email?: string | null
    membership: Awaited<ReturnType<typeof getCmsPlusStatus>>
  },
) {
  if (!membership.active || membership.permanent || !membership.expiresAt) return
  const mail = String(email || '')
    .trim()
    .toLowerCase()
  if (!mail.includes('@')) return

  const dias = Math.ceil((new Date(membership.expiresAt).getTime() - Date.now()) / 86400000)
  if (dias > 7 || dias < -3) return

  const { data: row } = await supabase
    .from('ecosistema_entitlements')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('producto', PRODUCTO_CMS_PLUS)
    .eq('status', 'active')
    .maybeSingle()
  if (!row?.id) return

  const meta = (row.metadata || {}) as Record<string, unknown>
  const marker = String(membership.expiresAt)
  if (meta.renovacion_recordatorio_para === marker) return

  const resend = getResendConfig()
  if (!resend.enabled) return

  const site = getSiteUrl()
  const sent = await sendResendEmail({
    apiKey: resend.apiKey,
    from: resend.from,
    to: mail,
    subject:
      dias <= 0
        ? 'Tu Círculo CMS-Plus venció o vence hoy — renueva'
        : `Renueva tu Círculo CMS-Plus · quedan ${dias} día${dias === 1 ? '' : 's'}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;max-width:560px">
        <h2 style="margin:0 0 12px">Recordatorio de renovación</h2>
        <p>Tu membresía <strong>Círculo CMS-Plus ${membership.tier?.nombre || ''}</strong>
          ${dias <= 0 ? 'ya venció o vence hoy' : `vence en ${dias} día${dias === 1 ? '' : 's'}`}
          (${new Date(membership.expiresAt).toLocaleDateString('es-MX')}).</p>
        <p>Renueva para no interrumpir créditos de salud, círculo de beneficiarios ni el bundle Plus.</p>
        <p style="margin:18px 0">
          <a href="${site}/circulo-cms-plus" style="display:inline-block;padding:12px 18px;background:#d4a017;color:#111;text-decoration:none;border-radius:8px;font-weight:700">
            Renovar / subir de nivel
          </a>
        </p>
      </div>
    `,
  })

  if (sent.ok) {
    await supabase
      .from('ecosistema_entitlements')
      .update({
        metadata: {
          ...meta,
          renovacion_recordatorio_para: marker,
          renovacion_recordatorio_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  }
}

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
    try {
      await maybeSendRenewalReminder(supabase, {
        userId: user.id,
        email: user.email,
        membership,
      })
    } catch (err) {
      console.warn('cms-plus recordatorio renovación:', err)
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
  .inputValidator((d: { cantidad?: number; nota?: string; idempotencyKey?: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const membership = await getCmsPlusStatus(supabase, user.id)
    if (!membership.active || !membership.nivel) {
      throw new Error('Necesitas CMS-Plus activo para usar créditos.')
    }
    // Créditos gratuitos solo para el titular; beneficiarios usan descuento de círculo.
    const row = await registrarUsoCredito(supabase, {
      userId: user.id,
      nivel: membership.nivel,
      cantidad: 1,
      nota: data.nota || 'Consulta titular CMS-Plus',
      idempotencyKey: data.idempotencyKey,
    })
    const resumen = await getCreditosResumen(supabase, user.id, membership.nivel)
    return { ok: true, creditos: row, resumen }
  })

export const consultarMiembroCmsPlusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')

    const q = String(data.q || '').trim()
    if (q.length < 2) throw new Error('Escribe correo, código CMS o nombre (mín. 2 caracteres).')

    const supabase = createSupabaseAdminClient()
    const qLower = q.toLowerCase()
    const qCode = q.toUpperCase()

    const safe = q.replace(/[%_,]/g, '').slice(0, 80)
    const { data: perfilesHit } = await supabase
      .from('perfiles')
      .select('id, nombre, correo')
      .or(`nombre.ilike.%${safe}%,correo.ilike.%${safe}%`)
      .limit(25)

    const { data: byCode } = await supabase
      .from('ecosistema_entitlements')
      .select('id, user_id, plan, status, expires_at, metadata, legacy_code, created_at')
      .eq('producto', PRODUCTO_CMS_PLUS)
      .ilike('legacy_code', `%${qCode}%`)
      .limit(25)

    const { data: byMetaEmail } = await supabase
      .from('ecosistema_entitlements')
      .select('id, user_id, plan, status, expires_at, metadata, legacy_code, created_at')
      .eq('producto', PRODUCTO_CMS_PLUS)
      .order('created_at', { ascending: false })
      .limit(300)

    const metaHits = (byMetaEmail || []).filter((row) => {
      const meta = (row.metadata || {}) as { email?: string }
      return String(meta.email || '')
        .toLowerCase()
        .includes(qLower)
    })

    const userIds = [
      ...new Set(
        [
          ...(perfilesHit || []).map((p) => p.id),
          ...(byCode || []).map((r) => r.user_id),
          ...metaHits.map((r) => r.user_id),
        ].filter(Boolean) as string[],
      ),
    ].slice(0, 8)

    if (!userIds.length) {
      return { found: false as const, matches: [] }
    }

    const { data: entitlements } = await supabase
      .from('ecosistema_entitlements')
      .select('id, user_id, plan, status, expires_at, metadata, legacy_code, created_at')
      .eq('producto', PRODUCTO_CMS_PLUS)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })

    async function buildMatch(userId: string) {
      const row =
        (entitlements || []).find((e) => e.user_id === userId && e.status === 'active') ||
        (entitlements || []).find((e) => e.user_id === userId)
      if (!row || !isCmsPlusNivel(row.plan || '')) return null

      const meta = (row.metadata || {}) as { email?: string; billing?: string; permanent?: boolean }
      const perfil =
        (perfilesHit || []).find((p) => p.id === userId) ||
        (
          await supabase.from('perfiles').select('id, nombre, correo').eq('id', userId).maybeSingle()
        ).data

      let creditos = null
      try {
        creditos = await getCreditosResumen(supabase, userId, row.plan as CmsPlusNivel)
      } catch {
        creditos = null
      }

      const circuloRaw = await listarCirculoTitular(supabase, userId)
      const beneficiarios = []
      for (const inv of circuloRaw) {
        let nombre: string | null = null
        let correo = inv.email_invitado || null
        if (inv.beneficiario_id) {
          const { data: bp } = await supabase
            .from('perfiles')
            .select('nombre, correo')
            .eq('id', inv.beneficiario_id)
            .maybeSingle()
          nombre = bp?.nombre || null
          correo = bp?.correo || correo
        }
        beneficiarios.push({
          id: inv.id,
          status: inv.status,
          email: correo,
          nombre,
          descuento_pct: inv.descuento_pct,
          token: inv.token,
        })
      }

      const tier = getCmsPlusTier(row.plan)
      return {
        entitlementId: row.id,
        userId,
        nombre: perfil?.nombre || null,
        email: perfil?.correo || meta.email || null,
        nivel: row.plan,
        status: row.status,
        billing: meta.billing || 'mensual',
        permanent: Boolean(meta.permanent) || !row.expires_at,
        expiresAt: row.expires_at,
        legacyCode: row.legacy_code,
        creditos,
        beneficiarios,
        descuentoCirculoPct: tier?.descuentoCirculoPct ?? null,
      }
    }

    const matches = []
    for (const userId of userIds) {
      const match = await buildMatch(userId)
      if (match) matches.push(match)
    }

    return { found: matches.length > 0, matches }
  })

export const ajustarCreditosCmsPlusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; usados: number; nota?: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const supabase = createSupabaseAdminClient()
    const membership = await getCmsPlusStatus(supabase, data.userId)
    if (!membership.active || !membership.nivel) {
      throw new Error('Ese usuario no tiene CMS-Plus activo.')
    }
    const row = await ajustarUsadosCredito(supabase, {
      userId: data.userId,
      nivel: membership.nivel,
      usados: data.usados,
      nota: data.nota || `Ajuste por admin ${admin.user.email || admin.user.id}`,
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

    const base = `CMS-Plus ${result.tier.nombre} otorgado a ${mail}. Código ${result.legacyCode}.`
    return {
      ok: true,
      userId,
      nivel: result.nivel,
      legacyCode: result.legacyCode,
      emailed: Boolean(result.emailed),
      nota: result.emailed
        ? `${base} Correo enviado con el código CMS.`
        : `${base}${result.emailWarning ? ` ${result.emailWarning}` : ''}`,
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

export const suspenderCmsPlusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; motivo?: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const supabase = createSupabaseAdminClient()
    const { data: row, error: findError } = await supabase
      .from('ecosistema_entitlements')
      .select('id, metadata')
      .eq('user_id', data.userId)
      .eq('producto', 'cms_plus')
      .eq('status', 'active')
      .maybeSingle()
    if (findError) throw findError
    if (!row?.id) throw new Error('No hay membresía CMS-Plus activa para suspender.')
    const meta = (row.metadata || {}) as Record<string, unknown>
    const { error } = await supabase
      .from('ecosistema_entitlements')
      .update({
        status: 'cancelled',
        metadata: {
          ...meta,
          suspendido: true,
          suspendido_at: new Date().toISOString(),
          suspendido_motivo: data.motivo || 'suspendido_admin',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) throw error
    return { ok: true }
  })

export const reactivarCmsPlusAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const supabase = createSupabaseAdminClient()
    const { data: row, error: findError } = await supabase
      .from('ecosistema_entitlements')
      .select('id, user_id, plan, metadata, expires_at')
      .eq('id', data.id)
      .eq('producto', 'cms_plus')
      .maybeSingle()
    if (findError) throw findError
    if (!row?.id) throw new Error('Membresía no encontrada')
    if (!row.user_id || !isCmsPlusNivel(row.plan || '')) {
      throw new Error('No se puede reactivar: faltan usuario o nivel')
    }
    const meta = (row.metadata || {}) as { billing?: string; email?: string; permanent?: boolean }
    const result = await activateCmsPlus(supabase, {
      userId: row.user_id,
      nivel: row.plan as CmsPlusNivel,
      billing: meta.billing === 'anual' ? 'anual' : 'mensual',
      email: meta.email || null,
      source: 'admin_reactivar',
      permanent: Boolean(meta.permanent) || !row.expires_at,
    })
    return {
      ok: true,
      nivel: result.nivel,
      legacyCode: result.legacyCode,
      emailed: Boolean(result.emailed),
      nota: result.emailed
        ? `Reactivado. Código ${result.legacyCode} reenviado por correo.`
        : `Reactivado. Código ${result.legacyCode}.${result.emailWarning ? ` ${result.emailWarning}` : ''}`,
    }
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
    .limit(500)
  if (error) throw error

  const membresias = (data || []).map((row) => {
    const meta = (row.metadata || {}) as {
      email?: string
      billing?: string
      permanent?: boolean
      suspendido?: boolean
    }
    return {
      id: row.id,
      user_id: row.user_id,
      nivel: row.plan,
      status: row.status,
      billing: meta.billing || 'mensual',
      email: meta.email || null,
      permanent: Boolean(meta.permanent) || !row.expires_at,
      suspendido: Boolean(meta.suspendido) && row.status !== 'active',
      expires_at: row.expires_at,
      legacy_code: row.legacy_code,
      created_at: row.created_at,
    }
  })

  const conteos = {
    plata: membresias.filter((m) => m.nivel === 'plata' && m.status === 'active').length,
    oro: membresias.filter((m) => m.nivel === 'oro' && m.status === 'active').length,
    platino: membresias.filter((m) => m.nivel === 'platino' && m.status === 'active').length,
    diamante: membresias.filter((m) => m.nivel === 'diamante' && m.status === 'active').length,
    suspendidos: membresias.filter((m) => m.suspendido || m.status === 'cancelled').length,
    totalActivos: membresias.filter((m) => m.status === 'active').length,
  }

  return { membresias, conteos }
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
