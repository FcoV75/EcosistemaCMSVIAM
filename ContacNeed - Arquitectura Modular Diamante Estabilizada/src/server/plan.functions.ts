import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'
import {
  FREE_PLAN_FEATURES,
  PRO_PLAN_FEATURES,
  PRO_EXTRA_ADS_PACK_PRICE_MXN,
  PRO_EXTRA_ADS_PACK_SIZE,
  formatPlanLimitMessage,
  getDailyPostLimit,
  getMaxProAds,
  getStartOfTodayIso,
  getStoreItemLimit,
} from '../lib/plan-limits'

async function countTodayPosts(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { count, error } = await supabase
    .from('publicaciones')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .gte('fecha_creacion', getStartOfTodayIso())

  if (error) throw error
  return count ?? 0
}

async function countActiveProAds(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { count, error } = await supabase
    .from('anuncios')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .eq('tipo', 'pro')
    .eq('activo', true)

  if (error) {
    if (error.message.includes('does not exist')) return 0
    throw error
  }
  return count ?? 0
}

export const getPlanUsageFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, profile } = await requireActiveUser()
  const isPro = Boolean(profile?.es_pro)
  const postsUsed = await countTodayPosts(user.id)
  const postLimit = getDailyPostLimit(isPro)
  const storeLimit = getStoreItemLimit(isPro)
  const extraAdSlots = Number(profile?.pro_extra_ad_slots ?? 0)
  const maxAds = isPro ? getMaxProAds(extraAdSlots) : 0
  const activeAds = isPro ? await countActiveProAds(user.id) : 0

  const supabase = createSupabaseAdminClient()
  const { data: negocio } = await supabase.from('negocios').select('items').eq('id', user.id).maybeSingle()
  const storeItems = Array.isArray(negocio?.items) ? negocio.items.length : 0

  return {
    isPro,
    planType: profile?.pro_plan_type ?? null,
    posts: {
      used: postsUsed,
      limit: postLimit,
      remaining: Math.max(0, postLimit - postsUsed),
      label: formatPlanLimitMessage(postsUsed, postLimit, 'Publicaciones'),
    },
    store: {
      used: storeItems,
      limit: storeLimit,
      remaining: Math.max(0, storeLimit - storeItems),
    },
    proAds: {
      active: activeAds,
      max: maxAds,
      extraSlots: extraAdSlots,
      extraPackSize: PRO_EXTRA_ADS_PACK_SIZE,
      extraPackPriceMxn: PRO_EXTRA_ADS_PACK_PRICE_MXN,
    },
    features: {
      liveChat: isPro,
      mapsLocation: isPro,
      marketReport: isPro,
    },
    freeFeatures: [...FREE_PLAN_FEATURES],
    proFeatures: [...PRO_PLAN_FEATURES],
  }
})

export const requestProExtraAdsFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user, profile } = await requireActiveUser()
  if (!profile?.es_pro) {
    throw new Error('Solo miembros PRO pueden solicitar anuncios adicionales.')
  }

  const supabase = createSupabaseAdminClient()
  const planLabel = profile.pro_plan_type === 'annual' ? 'anual' : 'mensual'
  const billingNote =
    profile.pro_plan_type === 'annual'
      ? 'Pago único $500 MXN por paquete de 5 anuncios extra (plan anual).'
      : 'Cargo recurrente $500 MXN/mes por paquete de 5 anuncios extra (plan mensual).'

  const { error } = await supabase.from('solicitudes_pro').insert({
    usuario_id: user.id,
    metodo: 'extra_ads',
    monto: PRO_EXTRA_ADS_PACK_PRICE_MXN,
    estatus: 'pendiente',
    notas: `Paquete +${PRO_EXTRA_ADS_PACK_SIZE} anuncios PRO · plan ${planLabel}. ${billingNote}`,
  })

  if (error) {
    if (error.message.includes('does not exist')) {
      throw new Error('Sistema de solicitudes en configuración. Contacta soporte.')
    }
    throw error
  }

  return {
    success: true,
    message: `Solicitud registrada. Tras confirmar el pago de $${PRO_EXTRA_ADS_PACK_PRICE_MXN} MXN se activarán ${PRO_EXTRA_ADS_PACK_SIZE} anuncios adicionales.`,
  }
})
