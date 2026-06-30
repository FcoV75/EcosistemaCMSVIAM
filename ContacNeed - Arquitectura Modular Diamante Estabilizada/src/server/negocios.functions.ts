import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'
import { getStoreItemLimit } from '../lib/plan-limits'

export const getNegocioFn = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from('negocios').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return data
  })

export const updateNegocioFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      banner_url?: string
      items?: string[]
      maps_address?: string
      lat?: number | null
      lng?: number | null
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, profile } = await requireActiveUser()
    const isPro = Boolean(profile?.es_pro)
    const items = data.items ?? []
    const itemLimit = getStoreItemLimit(isPro)

    if (items.length > itemLimit) {
      throw new Error(
        isPro
          ? `Tu tienda PRO admite hasta ${itemLimit} imágenes de productos.`
          : `Plan gratuito: máximo ${itemLimit} imágenes en tu tienda. Activa PRO para ampliarla.`,
      )
    }

    const hasMapsPayload =
      data.maps_address !== undefined || data.lat !== undefined || data.lng !== undefined

    if (hasMapsPayload && !isPro) {
      throw new Error('La ubicación GPS en Google Maps es exclusiva de ContacNeed PRO.')
    }

    const supabase = createSupabaseAdminClient()

    const payload: Record<string, unknown> = {
      id: user.id,
      banner_url: data.banner_url ?? null,
      items,
    }

    if (isPro && hasMapsPayload) {
      payload.maps_address = data.maps_address?.trim() || null
      payload.lat = typeof data.lat === 'number' ? data.lat : null
      payload.lng = typeof data.lng === 'number' ? data.lng : null
    }

    const { data: row, error } = await supabase
      .from('negocios')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) throw new Error(`No se pudo guardar la tienda: ${error.message}`)
    return row
  })
