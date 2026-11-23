import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureLegacyCmsCode } from './cms-legacy-code'

export const PRODUCTO_PROMOTOR = 'promotor_viam'
export const CMS_VIAM_URL = 'https://centromultidisciplinarioags.com'

function entitlementVigente(row: { status: string; expires_at: string | null }) {
  if (!row || row.status !== 'active') return false
  if (!row.expires_at) return true
  return new Date(row.expires_at).getTime() > Date.now()
}

export function normalizarEmail(email: string | null | undefined) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function emailsPromotorEnv() {
  const raw = process.env.ECOSISTEMA_PROMOTOR_EMAILS || ''
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

function ownerCodesFromEnv() {
  const raw = process.env.ECOSISTEMA_OWNER_CODES || 'CMS-8INFW3'
  return new Set(
    raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  )
}

export async function esFundadorEcosistema(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  profile?: { es_fundador?: boolean | null; is_admin?: boolean | null } | null,
) {
  if (profile?.es_fundador) return true

  const { data } = await supabase
    .from('ecosistema_entitlements')
    .select('plan, legacy_code, metadata, status, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const owners = ownerCodesFromEnv()
  return (data || []).some(
    (r) =>
      entitlementVigente(r) &&
      (r.plan === 'propietario' ||
        (r.metadata as { rol?: string } | null)?.rol === 'fundador' ||
        (r.legacy_code && owners.has(String(r.legacy_code).toUpperCase()))),
  )
}

export async function resolverAccesoCursoPromotores(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  profile?: { es_fundador?: boolean | null; is_admin?: boolean | null } | null,
) {
  if (await esFundadorEcosistema(supabase, user, profile)) {
    return {
      ok: true as const,
      rol: 'fundador' as const,
      email: user.email || null,
      cursoUrl: `${CMS_VIAM_URL}/curso-promotores`,
    }
  }

  // Admins ContacNeed también pueden estudiar el material
  if (profile?.is_admin) {
    return {
      ok: true as const,
      rol: 'admin' as const,
      email: user.email || null,
      cursoUrl: `${CMS_VIAM_URL}/curso-promotores`,
    }
  }

  const email = normalizarEmail(user.email)
  if (email && emailsPromotorEnv().has(email)) {
    return {
      ok: true as const,
      rol: 'promotor' as const,
      email: user.email || null,
      cursoUrl: `${CMS_VIAM_URL}/curso-promotores`,
      fuente: 'env',
    }
  }

  const { data: byUser } = await supabase
    .from('ecosistema_entitlements')
    .select('id, metadata, status, expires_at, user_id')
    .eq('producto', PRODUCTO_PROMOTOR)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (byUser && entitlementVigente(byUser)) {
    return {
      ok: true as const,
      rol: 'promotor' as const,
      email: user.email || null,
      nombre: (byUser.metadata as { nombre?: string } | null)?.nombre || null,
      matriculaId: byUser.id,
      cursoUrl: `${CMS_VIAM_URL}/curso-promotores`,
    }
  }

  if (email) {
    const { data: rows } = await supabase
      .from('ecosistema_entitlements')
      .select('id, metadata, status, expires_at, user_id')
      .eq('producto', PRODUCTO_PROMOTOR)
      .eq('status', 'active')
      .limit(300)

    const match = (rows || []).find(
      (r) =>
        entitlementVigente(r) &&
        normalizarEmail((r.metadata as { email?: string } | null)?.email) === email,
    )

    if (match) {
      if (!match.user_id) {
        await supabase
          .from('ecosistema_entitlements')
          .update({
            user_id: user.id,
            updated_at: new Date().toISOString(),
            metadata: {
              ...((match.metadata as object) || {}),
              email,
              vinculado_en_login: new Date().toISOString(),
            },
          })
          .eq('id', match.id)
      }
      return {
        ok: true as const,
        rol: 'promotor' as const,
        email: user.email || null,
        nombre: (match.metadata as { nombre?: string } | null)?.nombre || null,
        matriculaId: match.id,
        cursoUrl: `${CMS_VIAM_URL}/curso-promotores`,
      }
    }
  }

  return {
    ok: false as const,
    error:
      'Tu cuenta aún no está matriculada como promotor. Pide al fundador/admin que te autorice.',
  }
}

export async function listarPromotoresMatriculados(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('id, user_id, producto, plan, status, starts_at, expires_at, metadata, created_at')
    .eq('producto', PRODUCTO_PROMOTOR)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw error
  return data || []
}

export async function matricularPromotorViam(
  supabase: SupabaseClient,
  {
    email,
    nombre,
    matriculadoPor,
  }: { email: string; nombre?: string; matriculadoPor?: string | null },
) {
  const mail = normalizarEmail(email)
  if (!mail || !mail.includes('@')) throw new Error('Correo inválido.')

  let userId: string | null = null
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const hit = (data?.users || []).find((u) => normalizarEmail(u.email) === mail)
    if (hit) {
      userId = hit.id
      break
    }
    if (!data?.users?.length || data.users.length < 200) break
  }

  const { data: rowsEmail } = await supabase
    .from('ecosistema_entitlements')
    .select('id, metadata, user_id, legacy_code')
    .eq('producto', PRODUCTO_PROMOTOR)
    .eq('status', 'active')
    .limit(300)

  const already = (rowsEmail || []).find(
    (r) =>
      r.user_id === userId ||
      normalizarEmail((r.metadata as { email?: string } | null)?.email) === mail,
  )

  const legacyCode =
    (already?.legacy_code && String(already.legacy_code).toUpperCase()) ||
    (await ensureLegacyCmsCode(supabase, { userId, email: mail }))

  const metadata = {
    rol: 'promotor',
    email: mail,
    nombre: String(nombre || '').trim() || null,
    matriculado_at: new Date().toISOString(),
    matriculado_por: matriculadoPor || null,
    source: 'contacneed-admin',
    codigo_cms: legacyCode,
  }

  const row = {
    user_id: userId,
    producto: PRODUCTO_PROMOTOR,
    plan: 'promotor',
    status: 'active',
    expires_at: null as string | null,
    legacy_code: legacyCode,
    metadata,
    updated_at: new Date().toISOString(),
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
      legacyCode,
      nombre: metadata.nombre,
    }
  }

  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .insert({ ...row, starts_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return {
    id: data?.id,
    created: true,
    userLinked: !!userId,
    email: mail,
    legacyCode,
    nombre: metadata.nombre,
  }
}

export async function darBajaPromotorViam(supabase: SupabaseClient, id: string) {
  const { data: row, error: errFind } = await supabase
    .from('ecosistema_entitlements')
    .select('id, producto, metadata')
    .eq('id', id)
    .maybeSingle()
  if (errFind) throw errFind
  if (!row || row.producto !== PRODUCTO_PROMOTOR) throw new Error('Matrícula no encontrada.')

  const { error } = await supabase
    .from('ecosistema_entitlements')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
      metadata: {
        ...((row.metadata as object) || {}),
        baja_at: new Date().toISOString(),
      },
    })
    .eq('id', id)
  if (error) throw error
  return { id }
}
