import type { SupabaseClient } from '@supabase/supabase-js'

export type ContacNeedProStatus = {
  active: boolean
  plan: 'monthly' | 'annual' | null
  expiresAt: string | null
  permanent: boolean
}

function planToProfile(plan: string | null | undefined): 'monthly' | 'annual' | null {
  if (plan === 'anual' || plan === 'annual') return 'annual'
  if (plan === 'mensual' || plan === 'monthly') return 'monthly'
  return null
}

function entitlementVigente(row: {
  status: string
  expires_at: string | null
}) {
  if (!row || row.status !== 'active') return false
  if (!row.expires_at) return true
  return new Date(row.expires_at).getTime() > Date.now()
}

export async function getContacNeedProStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContacNeedProStatus> {
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('plan, expires_at, status, metadata')
    .eq('user_id', userId)
    .eq('producto', 'contacneed_pro')
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  if (!data || !entitlementVigente(data)) {
    return { active: false, plan: null, expiresAt: null, permanent: false }
  }

  const meta = (data.metadata || {}) as Record<string, unknown>
  const permanent =
    meta.permanent === true || data.plan === 'propietario' || !data.expires_at

  return {
    active: true,
    plan: planToProfile(data.plan),
    expiresAt: data.expires_at,
    permanent,
  }
}

export async function upsertContacNeedPro(
  supabase: SupabaseClient,
  userId: string,
  planType: 'monthly' | 'annual',
  stripeSessionId?: string | null,
) {
  const plan = planType === 'annual' ? 'anual' : 'mensual'
  const expiresAt = new Date(
    Date.now() + (planType === 'annual' ? 365 : 30) * 86400000,
  ).toISOString()

  const { data: existente } = await supabase
    .from('ecosistema_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('producto', 'contacneed_pro')
    .eq('status', 'active')
    .maybeSingle()

  const row = {
    user_id: userId,
    producto: 'contacneed_pro',
    plan,
    status: 'active',
    expires_at: expiresAt,
    stripe_session_id: stripeSessionId || null,
    metadata: { source: 'contacneed' },
    updated_at: new Date().toISOString(),
  }

  if (existente?.id) {
    const { error } = await supabase
      .from('ecosistema_entitlements')
      .update(row)
      .eq('id', existente.id)
    if (error) throw error
    return { updated: true }
  }

  const { error } = await supabase.from('ecosistema_entitlements').insert(row)
  if (error) throw error
  return { created: true }
}

export async function revokeContacNeedPro(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from('ecosistema_entitlements')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('producto', 'contacneed_pro')
    .eq('status', 'active')
  if (error) throw error
}

export async function countActiveContacNeedPro(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('id, expires_at, status')
    .eq('producto', 'contacneed_pro')
    .eq('status', 'active')

  if (error) throw error
  return (data || []).filter(entitlementVigente).length
}
