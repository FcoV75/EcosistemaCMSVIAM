import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireAdminUser, requireProUser } from '../lib/auth'
import { getMaxProAds } from '../lib/plan-limits'

export type AnuncioRow = {
  id: string
  titulo: string
  cuerpo?: string | null
  imagen_url?: string | null
  enlace_url?: string | null
  estado?: string | null
  usuario_id?: string | null
  activo: boolean
  prioridad: number
  tipo: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

async function assertAdmin() {
  const admin = await requireAdminUser()
  if (!admin) throw new Error('Acceso denegado')
  return admin
}

function isActive(ad: AnuncioRow) {
  if (!ad.activo) return false
  const now = Date.now()
  if (ad.fecha_inicio && new Date(ad.fecha_inicio).getTime() > now) return false
  if (ad.fecha_fin && new Date(ad.fecha_fin).getTime() < now) return false
  return true
}

export const getActiveAdsFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { tipo?: string; estado?: string }) => d ?? {})
  .handler(async ({ data }) => {
    const supabase = createSupabaseAdminClient()
    const { data: rows, error } = await supabase
      .from('anuncios')
      .select('*')
      .eq('activo', true)
      .order('prioridad', { ascending: false })
      .limit(50)

    if (error) {
      if (error.message.includes('does not exist')) return []
      throw error
    }

    const estado = data?.estado?.trim()
    const tipo = data?.tipo?.trim()

    return (rows ?? [])
      .filter((ad) => isActive(ad as AnuncioRow))
      .filter((ad) => !tipo || ad.tipo === tipo)
      .filter((ad) => !estado || !ad.estado || ad.estado === estado)
      .slice(0, 12) as AnuncioRow[]
  })

export const getAdminAdsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await assertAdmin()
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.from('anuncios').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
})

export const saveAdFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      id?: string
      titulo: string
      cuerpo?: string
      imagen_url?: string
      enlace_url?: string
      estado?: string
      tipo?: string
      activo?: boolean
      prioridad?: number
      fecha_inicio?: string
      fecha_fin?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const payload = {
      titulo: data.titulo.trim(),
      cuerpo: data.cuerpo ?? null,
      imagen_url: data.imagen_url ?? null,
      enlace_url: data.enlace_url ?? null,
      estado: data.estado ?? null,
      tipo: data.tipo ?? 'banner',
      activo: data.activo ?? true,
      prioridad: data.prioridad ?? 0,
      fecha_inicio: data.fecha_inicio ?? null,
      fecha_fin: data.fecha_fin ?? null,
    }

    if (data.id) {
      const { error } = await supabase.from('anuncios').update(payload).eq('id', data.id)
      if (error) throw error
      return { success: true, id: data.id }
    }

    const { data: row, error } = await supabase.from('anuncios').insert(payload).select('id').single()
    if (error) throw error
    return { success: true, id: row.id }
  })

export const deleteAdFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('anuncios').delete().eq('id', data.id)
    if (error) throw error
    return { success: true }
  })

export const publishMyProAdFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { titulo?: string; cuerpo?: string; imagen_url?: string; enlace_url?: string }) => d ?? {},
  )
  .handler(async ({ data }) => {
    const { user, profile } = await requireProUser()
    const supabase = createSupabaseAdminClient()
    const extraSlots = Number(profile?.pro_extra_ad_slots ?? 0)
    const maxAds = getMaxProAds(extraSlots)

    const { count, error: countError } = await supabase
      .from('anuncios')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .eq('tipo', 'pro')
      .eq('activo', true)

    if (countError) throw countError
    if ((count ?? 0) >= maxAds) {
      throw new Error(
        maxAds <= 1
          ? 'Ya tienes tu anuncio PRO activo. Solicita el paquete +5 anuncios ($500 MXN) para publicar más.'
          : `Límite de anuncios PRO alcanzado (${maxAds} activos). Solicita otro paquete extra si lo necesitas.`,
      )
    }

    const { data: row, error } = await supabase
      .from('anuncios')
      .insert({
        titulo: data.titulo?.trim() || profile?.nombre?.trim() || 'Profesional PRO',
        cuerpo: data.cuerpo?.trim() || profile?.descripcion_profesion || profile?.habilidad_empirica || null,
        imagen_url: data.imagen_url?.trim() || profile?.avatar_url || null,
        enlace_url: data.enlace_url?.trim() || null,
        usuario_id: user.id,
        estado: profile?.estado ?? null,
        tipo: 'pro',
        activo: true,
        prioridad: 10,
      })
      .select('id')
      .single()

    if (error) throw new Error(`No se pudo publicar tu anuncio PRO: ${error.message}`)
    return { success: true, id: row.id }
  })

export const createProAdFromProfileFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { titulo: string; cuerpo?: string; imagen_url?: string; enlace_url?: string }) => d)
  .handler(async ({ data }) => {
    const admin = await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { data: row, error } = await supabase
      .from('anuncios')
      .insert({
        titulo: data.titulo.trim(),
        cuerpo: data.cuerpo ?? null,
        imagen_url: data.imagen_url ?? null,
        enlace_url: data.enlace_url ?? null,
        usuario_id: admin.user.id,
        tipo: 'pro',
        activo: true,
        prioridad: 10,
      })
      .select('id')
      .single()

    if (error) throw error
    return { success: true, id: row.id }
  })
