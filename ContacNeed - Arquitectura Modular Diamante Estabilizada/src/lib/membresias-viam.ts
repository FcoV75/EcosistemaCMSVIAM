import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureLegacyCmsCode } from './cms-legacy-code'
import { normalizarEmail } from './promotores-viam'

export const PRODUCTO_NEXUS = 'sincronia_nexus'
export const PRODUCTO_VIDEO_DIAMANTE = 'video_diamante_premium'

export type ProductoMembresia = typeof PRODUCTO_NEXUS | typeof PRODUCTO_VIDEO_DIAMANTE
export type PlanMembresia = 'mensual' | 'anual' | 'propietario'

export const PLANES_MEMBRESIA: { value: PlanMembresia; label: string; hint: string }[] = [
  { value: 'mensual', label: 'Mensual', hint: '30 días' },
  { value: 'anual', label: 'Anual', hint: '365 días' },
  { value: 'propietario', label: 'Propietario / permanente', hint: 'Sin vencimiento' },
]

export const PRODUCTOS_MEMBRESIA: Record<
  ProductoMembresia,
  { etiqueta: string; descripcion: string; precios: string }
> = {
  sincronia_nexus: {
    etiqueta: 'Sincronía Nexus',
    descripcion: 'Controla membresías del Santuario Nexus (mensual, anual o propietario).',
    precios: 'Mensual $400 · Anual $3,600 MXN',
  },
  video_diamante_premium: {
    etiqueta: 'Video Diamante',
    descripcion: 'Controla Premium de Video Diamante (mensual, anual o propietario).',
    precios: 'Mensual $300 · Anual $3,000 MXN',
  },
}

function expiresForPlan(plan: PlanMembresia): string | null {
  if (plan === 'propietario') return null
  const days = plan === 'anual' ? 365 : 30
  return new Date(Date.now() + days * 86400000).toISOString()
}

async function resolverUserIdPorEmail(supabase: SupabaseClient, mail: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const hit = (data?.users || []).find((u) => normalizarEmail(u.email) === mail)
    if (hit) return hit.id
    if (!data?.users?.length || data.users.length < 200) break
  }
  return null
}

export async function listarMembresiasProducto(
  supabase: SupabaseClient,
  producto: ProductoMembresia,
) {
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select(
      'id, user_id, producto, plan, status, starts_at, expires_at, legacy_code, metadata, created_at, updated_at',
    )
    .eq('producto', producto)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw error
  return data || []
}

export async function otorgarMembresiaViam(
  supabase: SupabaseClient,
  {
    producto,
    email,
    plan,
    nombre,
    otorgadoPor,
  }: {
    producto: ProductoMembresia
    email: string
    plan: PlanMembresia
    nombre?: string
    otorgadoPor?: string | null
  },
) {
  const mail = normalizarEmail(email)
  if (!mail || !mail.includes('@')) throw new Error('Correo inválido.')
  if (!PLANES_MEMBRESIA.some((p) => p.value === plan)) {
    throw new Error('Plan inválido. Usa mensual, anual o propietario.')
  }

  const userId = await resolverUserIdPorEmail(supabase, mail)

  const { data: rows } = await supabase
    .from('ecosistema_entitlements')
    .select('id, metadata, user_id, legacy_code')
    .eq('producto', producto)
    .eq('status', 'active')
    .limit(300)

  const already = (rows || []).find(
    (r) =>
      (userId && r.user_id === userId) ||
      normalizarEmail((r.metadata as { email?: string } | null)?.email) === mail,
  )

  const legacyCode =
    (already?.legacy_code && String(already.legacy_code).toUpperCase()) ||
    (await ensureLegacyCmsCode(supabase, { userId, email: mail }))

  const now = new Date().toISOString()
  const metadata = {
    email: mail,
    nombre: String(nombre || '').trim() || null,
    plan,
    permanent: plan === 'propietario',
    otorgado_at: now,
    otorgado_por: otorgadoPor || null,
    source: 'contacneed-admin',
    codigo_cms: legacyCode,
  }

  const row = {
    user_id: userId,
    producto,
    plan,
    status: 'active',
    expires_at: expiresForPlan(plan),
    legacy_code: legacyCode,
    metadata,
    updated_at: now,
  }

  if (already?.id) {
    const { error } = await supabase
      .from('ecosistema_entitlements')
      .update(row)
      .eq('id', already.id)
    if (error) throw error
    return {
      id: already.id,
      updated: true,
      userLinked: !!userId,
      email: mail,
      plan,
      producto,
      legacyCode,
      nombre: metadata.nombre,
    }
  }

  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .insert({ ...row, starts_at: now })
    .select('id')
    .single()
  if (error) throw error
  return {
    id: data?.id,
    created: true,
    userLinked: !!userId,
    email: mail,
    plan,
    producto,
    legacyCode,
    nombre: metadata.nombre,
  }
}

export async function revocarMembresiaViam(
  supabase: SupabaseClient,
  {
    id,
    producto,
    revocadoPor,
  }: { id: string; producto: ProductoMembresia; revocadoPor?: string | null },
) {
  const { data: row, error: errFind } = await supabase
    .from('ecosistema_entitlements')
    .select('id, producto, metadata')
    .eq('id', id)
    .maybeSingle()
  if (errFind) throw errFind
  if (!row || row.producto !== producto) {
    throw new Error('Membresía no encontrada.')
  }

  const { error } = await supabase
    .from('ecosistema_entitlements')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      metadata: {
        ...((row.metadata as object) || {}),
        revocado_at: new Date().toISOString(),
        revocado_por: revocadoPor || null,
      },
    })
    .eq('id', id)
  if (error) throw error
  return { id }
}
