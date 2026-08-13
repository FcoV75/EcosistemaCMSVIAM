import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificacionTipo =
  | 'solicitud_amistad'
  | 'solicitud_servicio'
  | 'mensaje'
  | 'general'

export async function crearNotificacion(
  supabase: SupabaseClient,
  input: {
    usuarioId: string
    tipo: NotificacionTipo
    titulo: string
    cuerpo?: string | null
    enlace?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('notificaciones').insert({
    usuario_id: input.usuarioId,
    tipo: input.tipo,
    titulo: input.titulo,
    cuerpo: input.cuerpo ?? null,
    enlace: input.enlace ?? '/mensajes',
    metadata: input.metadata ?? {},
    leida: false,
  })

  // Tabla opcional hasta aplicar migración 011
  if (error && !error.message.includes('does not exist')) {
    console.warn('[notificaciones]', error.message)
  }
}
