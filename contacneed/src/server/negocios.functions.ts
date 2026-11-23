import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'
import { getStoreItemLimit } from '../lib/plan-limits'
import { geocodeAddress } from '../lib/geocode'

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
      const address = data.maps_address?.trim() || ''
      payload.maps_address = address || null

      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        payload.lat = data.lat
        payload.lng = data.lng
      } else if (address) {
        const geo = await geocodeAddress(address)
        payload.lat = geo.lat
        payload.lng = geo.lng
        if (geo.formattedAddress) payload.maps_address = geo.formattedAddress
      } else {
        payload.lat = null
        payload.lng = null
      }
    }

    const { data: row, error } = await supabase
      .from('negocios')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) throw new Error(`No se pudo guardar la tienda: ${error.message}`)
    return row
  })
