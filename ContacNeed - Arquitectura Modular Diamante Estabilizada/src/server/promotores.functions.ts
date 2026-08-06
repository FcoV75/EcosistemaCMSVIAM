import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser, requireAdminUser } from '../lib/auth'
import {
  darBajaPromotorViam,
  listarPromotoresMatriculados,
  matricularPromotorViam,
  resolverAccesoCursoPromotores,
} from '../lib/promotores-viam'

const ETIQUETAS_PRODUCTO: Record<string, string> = {
  sincronia_nexus: 'Nexus',
  video_diamante_premium: 'Video Diamante',
  contacneed_pro: 'ContacNeed PRO',
  ecosistema_cms_compra: 'CMS / Libros',
  consulta_cms: 'Consulta',
  promotor_viam: 'Promotor VIAM',
}

export const getCursoPromotoresAccessFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const acceso = await resolverAccesoCursoPromotores(supabase, session.user, session.profile)
  if (!acceso.ok) {
    return { ok: false as const, error: acceso.error }
  }
  return acceso
})

export const getPanelFundadorResumenFn = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await requireAdminUser()
  if (!admin) throw new Error('Acceso denegado: se requiere administrador')
  const supabase = createSupabaseAdminClient()
  const { data: entitlements, error } = await supabase
    .from('ecosistema_entitlements')
    .select(
      'id, user_id, legacy_code, producto, plan, status, starts_at, expires_at, stripe_session_id, metadata, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  const porProducto: Record<string, number> = {}
  for (const row of entitlements || []) {
    const key = row.producto || 'sin_producto'
    porProducto[key] = (porProducto[key] || 0) + 1
  }

  const activos = (entitlements || []).filter((r) => r.status === 'active').length
  const usuariosConCuenta = new Set(
    (entitlements || []).filter((r) => r.user_id).map((r) => r.user_id as string),
  ).size
  const soloCodigoLegacy = (entitlements || []).filter((r) => r.legacy_code && !r.user_id).length

  return {
    resumen: {
      total: entitlements?.length || 0,
      activos,
      usuariosConCuenta,
      soloCodigoLegacy,
      porProducto,
    },
    etiquetas: ETIQUETAS_PRODUCTO,
    entitlements: (entitlements || []).slice(0, 80).map((row) => ({
      id: row.id,
      producto: row.producto,
      plan: row.plan,
      status: row.status,
      legacy_code: row.legacy_code,
      user_id: row.user_id,
      expires_at: row.expires_at,
      email: (row.metadata as { email?: string } | null)?.email || null,
    })),
  }
})

export const listPromotoresAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await requireAdminUser()
  if (!admin) throw new Error('Acceso denegado: se requiere administrador')
  const supabase = createSupabaseAdminClient()
  const promotores = await listarPromotoresMatriculados(supabase)
  return {
    promotores: promotores.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      status: p.status,
      email: (p.metadata as { email?: string } | null)?.email || null,
      nombre: (p.metadata as { nombre?: string } | null)?.nombre || null,
      created_at: p.created_at,
    })),
  }
})

type MatricularInput = { email: string; nombre?: string }

export const matricularPromotorAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: MatricularInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const supabase = createSupabaseAdminClient()
    const out = await matricularPromotorViam(supabase, {
      email: data.email,
      nombre: data.nombre,
      matriculadoPor: admin.user.email || admin.user.id,
    })
    return {
      success: true,
      ...out,
      nota: out.userLinked
        ? 'Promotor matriculado y vinculado a su cuenta ContacNeed.'
        : 'Promotor matriculado por correo. Se vinculará al iniciar sesión.',
    }
  })

type BajaInput = { id: string }

export const bajaPromotorAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: BajaInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const supabase = createSupabaseAdminClient()
    const out = await darBajaPromotorViam(supabase, data.id)
    return { success: true, ...out }
  })
