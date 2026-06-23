import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireProUser } from '../lib/auth'

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
    const { user } = await requireProUser()
    const supabase = createSupabaseAdminClient()

    const payload = {
      id: user.id,
      banner_url: data.banner_url ?? null,
      items: data.items ?? [],
    }

    const { data: row, error } = await supabase
      .from('negocios')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) throw new Error(`No se pudo guardar la tienda: ${error.message}`)
    return row
  })
