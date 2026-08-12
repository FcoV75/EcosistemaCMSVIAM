import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireAdminUser } from '../lib/auth'
import {
  listarMembresiasProducto,
  otorgarMembresiaViam,
  PRODUCTO_NEXUS,
  PRODUCTO_VIDEO_DIAMANTE,
  PRODUCTOS_MEMBRESIA,
  revocarMembresiaViam,
  type PlanMembresia,
  type ProductoMembresia,
} from '../lib/membresias-viam'

function assertProducto(producto: string): ProductoMembresia {
  if (producto === PRODUCTO_NEXUS || producto === PRODUCTO_VIDEO_DIAMANTE) {
    return producto
  }
  throw new Error('Producto no válido. Usa sincronia_nexus o video_diamante_premium.')
}

function mapMembresiaRow(p: Awaited<ReturnType<typeof listarMembresiasProducto>>[number]) {
  const meta = (p.metadata || {}) as {
    email?: string
    nombre?: string
    permanent?: boolean
  }
  return {
    id: p.id,
    user_id: p.user_id,
    producto: p.producto,
    plan: p.plan,
    status: p.status,
    email: meta.email || null,
    nombre: meta.nombre || null,
    permanent: Boolean(meta.permanent) || p.plan === 'propietario' || !p.expires_at,
    expires_at: p.expires_at,
    legacy_code: p.legacy_code,
    created_at: p.created_at,
  }
}

type ListInput = { producto: ProductoMembresia }

export const listMembresiasAdminFn = createServerFn({ method: 'GET' })
  .inputValidator((d: ListInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const producto = assertProducto(data.producto)
    const supabase = createSupabaseAdminClient()
    const rows = await listarMembresiasProducto(supabase, producto)
    const info = PRODUCTOS_MEMBRESIA[producto]
    return {
      producto,
      etiqueta: info.etiqueta,
      descripcion: info.descripcion,
      precios: info.precios,
      membresias: rows.map(mapMembresiaRow),
    }
  })

type OtorgarInput = {
  producto: ProductoMembresia
  email: string
  plan: PlanMembresia
  nombre?: string
}

export const otorgarMembresiaAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: OtorgarInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const producto = assertProducto(data.producto)
    const supabase = createSupabaseAdminClient()
    const out = await otorgarMembresiaViam(supabase, {
      producto,
      email: data.email,
      plan: data.plan,
      nombre: data.nombre,
      otorgadoPor: admin.user.email || admin.user.id,
    })
    const etiqueta = PRODUCTOS_MEMBRESIA[producto].etiqueta
    return {
      success: true,
      ...out,
      nota: out.userLinked
        ? `${etiqueta} (${out.plan}) otorgada y vinculada a la cuenta ContacNeed.`
        : `${etiqueta} (${out.plan}) otorgada por correo. Se vinculará al iniciar sesión.`,
    }
  })

type RevocarInput = { id: string; producto: ProductoMembresia }

export const revocarMembresiaAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: RevocarInput) => d)
  .handler(async ({ data }) => {
    const admin = await requireAdminUser()
    if (!admin) throw new Error('Acceso denegado: se requiere administrador')
    const producto = assertProducto(data.producto)
    const supabase = createSupabaseAdminClient()
    const out = await revocarMembresiaViam(supabase, {
      id: data.id,
      producto,
      revocadoPor: admin.user.email || admin.user.id,
    })
    return { success: true, ...out }
  })
