import type { SupabaseClient } from '@supabase/supabase-js'
import { getCmsPlusStatus } from './cms-plus-entitlements'
import type { CmsPlusNivel } from './cms-plus'
import { getContacNeedProStatus } from './ecosistema-entitlements'
import {
  etiquetaPrecioContador,
  precioContadorMensualMxn,
  PRODUCTO_CONTADOR,
} from './contador-privado'
import { esFundadorEcosistema } from './promotores-viam'

function entitlementVigente(row: { status: string; expires_at: string | null }) {
  if (!row || row.status !== 'active') return false
  if (!row.expires_at) return true
  return new Date(row.expires_at).getTime() > Date.now()
}

export type ContadorAccess = {
  ok: boolean
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
  esPro: boolean
  precioMensualMxn: number
  precioLabel: string
  entitlementActive: boolean
  expiresAt: string | null
  permanent: boolean
  reason?: string
}

export async function getContadorAccess(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  profile?: {
    es_fundador?: boolean | null
    is_admin?: boolean | null
    es_pro?: boolean | null
  } | null,
): Promise<ContadorAccess> {
  const esOwner = await esFundadorEcosistema(supabase, user, profile)
  const cms = await getCmsPlusStatus(supabase, user.id)
  const pro = await getContacNeedProStatus(supabase, user.id)
  const cmsNivel = cms.active ? cms.nivel : null
  const esPro = Boolean(pro.active || profile?.es_pro)
  const precioMensualMxn = precioContadorMensualMxn({ esOwner, cmsNivel, esPro })
  const precioLabel = etiquetaPrecioContador({ esOwner, cmsNivel, esPro })

  if (esOwner) {
    return {
      ok: true,
      esOwner: true,
      cmsNivel,
      esPro,
      precioMensualMxn: 0,
      precioLabel,
      entitlementActive: true,
      expiresAt: null,
      permanent: true,
    }
  }

  if (profile?.is_admin) {
    return {
      ok: true,
      esOwner: false,
      cmsNivel,
      esPro,
      precioMensualMxn,
      precioLabel,
      entitlementActive: true,
      expiresAt: null,
      permanent: true,
      reason: 'admin',
    }
  }

  const { data } = await supabase
    .from('ecosistema_entitlements')
    .select('status, expires_at, metadata, plan')
    .eq('user_id', user.id)
    .eq('producto', PRODUCTO_CONTADOR)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data && entitlementVigente(data)) {
    const meta = (data.metadata || {}) as Record<string, unknown>
    return {
      ok: true,
      esOwner: false,
      cmsNivel,
      esPro,
      precioMensualMxn,
      precioLabel,
      entitlementActive: true,
      expiresAt: data.expires_at,
      permanent: meta.permanent === true || !data.expires_at,
    }
  }

  return {
    ok: false,
    esOwner: false,
    cmsNivel,
    esPro,
    precioMensualMxn,
    precioLabel,
    entitlementActive: false,
    expiresAt: null,
    permanent: false,
    reason: 'requiere_suscripcion',
  }
}

export async function activateContadorPrivado(
  supabase: SupabaseClient,
  opts: {
    userId: string
    stripeSessionId?: string | null
    email?: string | null
    cmsNivel?: CmsPlusNivel | null
    precioMxn?: number
    permanent?: boolean
    source?: string
  },
) {
  const expiresAt = opts.permanent ? null : new Date(Date.now() + 30 * 86400000).toISOString()

  const { data: existente } = await supabase
    .from('ecosistema_entitlements')
    .select('id, legacy_code')
    .eq('user_id', opts.userId)
    .eq('producto', PRODUCTO_CONTADOR)
    .eq('status', 'active')
    .maybeSingle()

  const row = {
    user_id: opts.userId,
    producto: PRODUCTO_CONTADOR,
    plan: 'mensual',
    status: 'active',
    expires_at: expiresAt,
    stripe_session_id: opts.stripeSessionId || null,
    legacy_code: existente?.legacy_code || null,
    metadata: {
      source: opts.source || 'contacneed',
      cms_nivel: opts.cmsNivel || null,
      precio_mxn: opts.precioMxn ?? null,
      email: opts.email || null,
      permanent: opts.permanent === true,
    },
    updated_at: new Date().toISOString(),
  }

  if (existente?.id) {
    const { error } = await supabase
      .from('ecosistema_entitlements')
      .update(row)
      .eq('id', existente.id)
    if (error) throw error
    return { id: existente.id, expiresAt }
  }

  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .insert(row)
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id as string, expiresAt }
}
