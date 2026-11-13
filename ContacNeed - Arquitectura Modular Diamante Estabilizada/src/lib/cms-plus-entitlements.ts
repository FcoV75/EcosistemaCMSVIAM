import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureLegacyCmsCode } from './cms-legacy-code'
import { upsertContacNeedPro } from './ecosistema-entitlements'
import {
  CMS_PLUS_NIVELES,
  PRODUCTO_CMS_PLUS,
  getCmsPlusTier,
  isCmsPlusNivel,
  periodoActual,
  type CmsPlusBilling,
  type CmsPlusNivel,
  type CmsPlusTier,
} from './cms-plus'

export type CmsPlusStatus = {
  active: boolean
  nivel: CmsPlusNivel | null
  billing: CmsPlusBilling | null
  expiresAt: string | null
  permanent: boolean
  tier: CmsPlusTier | null
  legacyCode: string | null
}

function entitlementVigente(row: { status: string; expires_at: string | null }) {
  if (!row || row.status !== 'active') return false
  if (!row.expires_at) return true
  return new Date(row.expires_at).getTime() > Date.now()
}

function expiresForBilling(billing: CmsPlusBilling): string {
  const days = billing === 'anual' ? 365 : 30
  return new Date(Date.now() + days * 86400000).toISOString()
}

async function upsertProductoBundle(
  supabase: SupabaseClient,
  {
    userId,
    producto,
    plan,
    expiresAt,
    stripeSessionId,
    legacyCode,
    metadata,
  }: {
    userId: string
    producto: string
    plan: string
    expiresAt: string | null
    stripeSessionId?: string | null
    legacyCode: string
    metadata: Record<string, unknown>
  },
) {
  const { data: existente } = await supabase
    .from('ecosistema_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('producto', producto)
    .eq('status', 'active')
    .maybeSingle()

  const row = {
    user_id: userId,
    producto,
    plan,
    status: 'active' as const,
    expires_at: expiresAt,
    stripe_session_id: stripeSessionId || null,
    legacy_code: legacyCode,
    metadata,
    updated_at: new Date().toISOString(),
  }

  if (existente?.id) {
    const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', existente.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('ecosistema_entitlements').insert({
    ...row,
    starts_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function getCmsPlusStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<CmsPlusStatus> {
  const empty: CmsPlusStatus = {
    active: false,
    nivel: null,
    billing: null,
    expiresAt: null,
    permanent: false,
    tier: null,
    legacyCode: null,
  }

  try {
    const { data, error } = await supabase
      .from('ecosistema_entitlements')
      .select('plan, expires_at, status, metadata, legacy_code')
      .eq('user_id', userId)
      .eq('producto', PRODUCTO_CMS_PLUS)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (error || !data || !entitlementVigente(data)) return empty
    if (!isCmsPlusNivel(data.plan || '')) return empty

    const meta = (data.metadata || {}) as Record<string, unknown>
    const billing: CmsPlusBilling =
      meta.billing === 'anual' || data.plan?.includes('anual') ? 'anual' : 'mensual'
    const permanent = meta.permanent === true || !data.expires_at

    return {
      active: true,
      nivel: data.plan as CmsPlusNivel,
      billing,
      expiresAt: data.expires_at,
      permanent,
      tier: getCmsPlusTier(data.plan),
      legacyCode: data.legacy_code || null,
    }
  } catch {
    return empty
  }
}

export async function ensurePeriodoCreditos(
  supabase: SupabaseClient,
  userId: string,
  nivel: CmsPlusNivel,
  periodo = periodoActual(),
) {
  const tier = getCmsPlusTier(nivel)
  if (!tier) throw new Error('Nivel inválido')

  const { data: existing } = await supabase
    .from('cms_plus_creditos')
    .select('*')
    .eq('user_id', userId)
    .eq('periodo', periodo)
    .maybeSingle()

  if (existing) {
    if (existing.nivel !== nivel || existing.allotment !== tier.creditosSalud) {
      const { data, error } = await supabase
        .from('cms_plus_creditos')
        .update({
          nivel,
          allotment: tier.creditosSalud,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw error
      return data
    }
    return existing
  }

  const { data, error } = await supabase
    .from('cms_plus_creditos')
    .insert({
      user_id: userId,
      periodo,
      allotment: tier.creditosSalud,
      usados: 0,
      compartidos_enviados: 0,
      nivel,
    })
    .select('*')
    .single()
  if (error) throw error

  await supabase.from('cms_plus_creditos_movimientos').insert({
    user_id: userId,
    periodo,
    tipo: 'renovacion',
    cantidad: tier.creditosSalud,
    nota: `Asignación mensual ${tier.nombre}`,
    metadata: { nivel },
  })

  return data
}

export async function activateCmsPlus(
  supabase: SupabaseClient,
  {
    userId,
    nivel,
    billing,
    stripeSessionId,
    email,
    source = 'stripe',
    permanent = false,
  }: {
    userId: string
    nivel: CmsPlusNivel
    billing: CmsPlusBilling
    stripeSessionId?: string | null
    email?: string | null
    source?: string
    permanent?: boolean
  },
) {
  if (!isCmsPlusNivel(nivel)) throw new Error('Nivel CMS-Plus inválido')
  const tier = getCmsPlusTier(nivel)!
  const expiresAt = permanent ? null : expiresForBilling(billing)
  const billingPlan = billing === 'anual' ? 'anual' : 'mensual'

  const legacyCode = await ensureLegacyCmsCode(supabase, {
    userId,
    email: email || null,
  })

  const sharedMeta = {
    source,
    nivel,
    billing,
    codigo_cms: legacyCode,
    email: email || null,
    bundle: 'cms_plus',
  }

  await upsertProductoBundle(supabase, {
    userId,
    producto: PRODUCTO_CMS_PLUS,
    plan: nivel,
    expiresAt,
    stripeSessionId,
    legacyCode,
    metadata: { ...sharedMeta, permanent, aporte_fondo_mxn: tier.aporteFondoMxn },
  })

  // Plus digital: ContacNeed PRO + Nexus + Video Diamante
  await upsertContacNeedPro(
    supabase,
    userId,
    billing === 'anual' ? 'annual' : 'monthly',
    stripeSessionId,
    { email, notifySource: `cms_plus_${nivel}` },
  )

  await upsertProductoBundle(supabase, {
    userId,
    producto: 'sincronia_nexus',
    plan: permanent ? 'propietario' : billingPlan,
    expiresAt,
    stripeSessionId,
    legacyCode,
    metadata: { ...sharedMeta, via: 'cms_plus' },
  })

  await upsertProductoBundle(supabase, {
    userId,
    producto: 'video_diamante_premium',
    plan: permanent ? 'propietario' : billingPlan,
    expiresAt,
    stripeSessionId,
    legacyCode,
    metadata: {
      ...sharedMeta,
      via: 'cms_plus',
      clips_mes: tier.videoDiamanteClips,
    },
  })

  // Marca es_pro en perfil para compatibilidad UI
  await supabase
    .from('perfiles')
    .update({
      es_pro: true,
      pro_plan_type: billing === 'anual' ? 'annual' : 'monthly',
      pro_extra_ad_slots: Math.max(0, tier.anunciosPro - 1),
    })
    .eq('id', userId)

  try {
    await ensurePeriodoCreditos(supabase, userId, nivel)
  } catch (err) {
    console.warn('cms-plus créditos (¿migración 016 aplicada?):', err)
  }

  return { nivel, billing, expiresAt, legacyCode, tier }
}

export async function revokeCmsPlus(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('ecosistema_entitlements')
    .update({ status: 'cancelled', updated_at: now })
    .eq('user_id', userId)
    .eq('producto', PRODUCTO_CMS_PLUS)
    .eq('status', 'active')
  if (error) throw error
}

export async function getCreditosResumen(supabase: SupabaseClient, userId: string, nivel: CmsPlusNivel) {
  const periodo = periodoActual()
  const row = await ensurePeriodoCreditos(supabase, userId, nivel, periodo)
  const disponibles = Math.max(0, (row.allotment || 0) - (row.usados || 0))
  return {
    periodo,
    allotment: row.allotment,
    usados: row.usados,
    compartidos_enviados: row.compartidos_enviados,
    disponibles,
    nivel: row.nivel,
  }
}

export async function registrarUsoCredito(
  supabase: SupabaseClient,
  {
    userId,
    nivel,
    cantidad = 1,
    nota,
  }: { userId: string; nivel: CmsPlusNivel; cantidad?: number; nota?: string },
) {
  const resumen = await getCreditosResumen(supabase, userId, nivel)
  if (resumen.disponibles < cantidad) {
    throw new Error('No tienes créditos suficientes este mes.')
  }

  const { data, error } = await supabase
    .from('cms_plus_creditos')
    .update({
      usados: resumen.usados + cantidad,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('periodo', resumen.periodo)
    .select('*')
    .single()
  if (error) throw error

  await supabase.from('cms_plus_creditos_movimientos').insert({
    user_id: userId,
    periodo: resumen.periodo,
    tipo: 'uso',
    cantidad: -cantidad,
    nota: nota || 'Uso de crédito de salud',
  })

  return data
}

function randomToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'PLUS-'
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function invitarAlCirculo(
  supabase: SupabaseClient,
  {
    titularId,
    email,
    nivel,
  }: { titularId: string; email?: string | null; nivel: CmsPlusNivel },
) {
  const tier = getCmsPlusTier(nivel)
  if (!tier) throw new Error('Nivel inválido')

  const { data: activos } = await supabase
    .from('cms_plus_circulo')
    .select('id')
    .eq('titular_id', titularId)
    .in('status', ['pending', 'active'])

  if ((activos || []).length >= tier.beneficiariosMax) {
    throw new Error(`Tu nivel ${tier.nombre} admite hasta ${tier.beneficiariosMax} beneficiarios.`)
  }

  const token = randomToken()
  const { data, error } = await supabase
    .from('cms_plus_circulo')
    .insert({
      titular_id: titularId,
      email_invitado: email?.trim().toLowerCase() || null,
      token,
      status: 'pending',
      descuento_pct: tier.descuentoCirculoPct,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function aceptarInvitacionCirculo(
  supabase: SupabaseClient,
  { token, userId }: { token: string; userId: string },
) {
  const normalized = String(token || '').trim().toUpperCase()
  const { data: invite, error } = await supabase
    .from('cms_plus_circulo')
    .select('*')
    .eq('token', normalized)
    .maybeSingle()
  if (error) throw error
  if (!invite) throw new Error('Invitación no encontrada.')
  if (invite.status !== 'pending') throw new Error('Esta invitación ya no está disponible.')
  if (invite.titular_id === userId) throw new Error('No puedes aceptar tu propia invitación.')

  const { data: other } = await supabase
    .from('cms_plus_circulo')
    .select('id')
    .eq('beneficiario_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (other) throw new Error('Ya perteneces a un círculo activo.')

  const { data, error: updError } = await supabase
    .from('cms_plus_circulo')
    .update({
      beneficiario_id: userId,
      status: 'active',
      activado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .select('*')
    .single()
  if (updError) throw updError
  return data
}

export async function listarCirculoTitular(supabase: SupabaseClient, titularId: string) {
  const { data, error } = await supabase
    .from('cms_plus_circulo')
    .select('id, email_invitado, beneficiario_id, token, status, descuento_pct, activado_at, created_at')
    .eq('titular_id', titularId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function otorgarBonoFidelidad(
  supabase: SupabaseClient,
  { titularId, nivel }: { titularId: string; nivel: CmsPlusNivel },
) {
  const tier = getCmsPlusTier(nivel)!
  const maxBonus = nivel === 'plata' ? 1 : 3
  const periodo = periodoActual()
  const { data: movs } = await supabase
    .from('cms_plus_creditos_movimientos')
    .select('id')
    .eq('user_id', titularId)
    .eq('periodo', periodo)
    .eq('tipo', 'bono_fidelidad')

  if ((movs || []).length >= maxBonus) {
    return { skipped: true, reason: 'Tope de bonos del mes alcanzado' }
  }

  const resumen = await getCreditosResumen(supabase, titularId, nivel)
  await supabase
    .from('cms_plus_creditos')
    .update({
      allotment: resumen.allotment + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', titularId)
    .eq('periodo', periodo)

  await supabase.from('cms_plus_creditos_movimientos').insert({
    user_id: titularId,
    periodo,
    tipo: 'bono_fidelidad',
    cantidad: 1,
    nota: `Bono por activación en el círculo (${tier.nombre})`,
  })

  return { ok: true }
}

export function catalogoPublicoCmsPlus() {
  return CMS_PLUS_NIVELES.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    tagline: t.tagline,
    precioMensualMxn: t.precioMensualMxn,
    precioAnualMxn: t.precioAnualMxn,
    creditosSalud: t.creditosSalud,
    anunciosPro: t.anunciosPro,
    videoDiamanteClips: t.videoDiamanteClips,
    iaViam: t.iaViam,
    beneficiariosMax: t.beneficiariosMax,
    descuentoCirculoPct: t.descuentoCirculoPct,
    creditosCompartibles: t.creditosCompartibles,
    aporteFondoMxn: t.aporteFondoMxn,
    plusResumen: t.plusResumen,
    saludResumen: t.saludResumen,
    negocioResumen: t.negocioResumen,
    highlight: Boolean(t.highlight),
  }))
}
