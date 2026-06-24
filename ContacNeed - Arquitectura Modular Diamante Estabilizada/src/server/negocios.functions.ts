import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'
import { FREE_TIENDA_MAX_ITEMS } from '../lib/plan-limits'

export const getNegocioFn = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from('negocios').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return data
  })

export const updateNegocioFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { banner_url?: string; items?: string[] }) => d)
  .handler(async ({ data }) => {
    const { user, profile } = await requireActiveUser()
    const isPro = Boolean(profile?.es_pro)
    const items = data.items ?? []

    if (!isPro && items.length > FREE_TIENDA_MAX_ITEMS) {
      throw new Error(
        `Plan gratuito: máximo ${FREE_TIENDA_MAX_ITEMS} productos en tu tienda. Activa PRO para agregar más.`,
      )
    }

    const supabase = createSupabaseAdminClient()

    const payload = {
      id: user.id,
      banner_url: data.banner_url ?? null,
      items,
    }

    const { data: row, error } = await supabase
      .from('negocios')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) throw new Error(`No se pudo guardar la tienda: ${error.message}`)
    return row
  })
