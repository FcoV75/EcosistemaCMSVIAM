import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'

export const getNotificacionesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireActiveUser()
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, cuerpo, enlace, leida, created_at, metadata')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) {
    if (error.message.includes('does not exist')) {
      return { items: [], unread: 0 }
    }
    throw new Error(error.message)
  }

  const items = data ?? []
  return {
    items,
    unread: items.filter((n) => !n.leida).length,
  }
})

export const markNotificacionReadFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id?: string; all?: boolean }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()

    if (data.all) {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('usuario_id', user.id)
        .eq('leida', false)
      if (error && !error.message.includes('does not exist')) throw new Error(error.message)
      return { success: true }
    }

    if (!data.id) throw new Error('Notificación no válida')
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', data.id)
      .eq('usuario_id', user.id)
    if (error && !error.message.includes('does not exist')) throw new Error(error.message)
    return { success: true }
  })
