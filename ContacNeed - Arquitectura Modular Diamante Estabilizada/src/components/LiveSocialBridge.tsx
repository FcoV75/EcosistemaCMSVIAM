import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase.browser'
import { getSupabaseBrowserSessionFn } from '../server/auth.functions'
import { useIdentity } from '../lib/identity-context'

/**
 * Puente global de tiempo real: mensajes, solicitudes y engagement del feed.
 * Invalida caches de React Query para que likes/comentarios/chats/solicitudes
 * se vean al momento en cualquier pestaña/equipo.
 */
export function LiveSocialBridge() {
  const { user } = useIdentity()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null
    let postsBumpTimer: ReturnType<typeof setTimeout> | null = null

    async function connect() {
      try {
        const supabase = getSupabaseBrowserClient()
        const session = await getSupabaseBrowserSessionFn()
        if (session) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
        }
        if (cancelled) return

        const bumpPosts = () => {
          if (postsBumpTimer) return
          postsBumpTimer = setTimeout(() => {
            postsBumpTimer = null
            queryClient.invalidateQueries({ queryKey: ['posts'] })
          }, 20_000)
        }
        const bumpSocial = () => {
          queryClient.invalidateQueries({ queryKey: ['inbox'] })
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
          queryClient.invalidateQueries({ queryKey: ['contact-requests'] })
          queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
          queryClient.invalidateQueries({ queryKey: ['online-users'] })
        }

        channel = supabase
          .channel(`live-social:${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reacciones' },
            bumpPosts,
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'comentarios' },
            bumpPosts,
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reacciones_comentarios' },
            bumpPosts,
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'compartidos' },
            bumpPosts,
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'mensajes' },
            (payload) => {
              const row = payload.new as { remitente_id?: string; destinatario_id?: string }
              if (row.destinatario_id === user.id || row.remitente_id === user.id) {
                bumpSocial()
              }
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'solicitudes_contacto' },
            (payload) => {
              const row = (payload.new || payload.old) as {
                destinatario_id?: string
                solicitante_id?: string
              }
              if (row.destinatario_id === user.id || row.solicitante_id === user.id) {
                bumpSocial()
              }
            },
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notificaciones' },
            (payload) => {
              const row = payload.new as { usuario_id?: string }
              if (row.usuario_id === user.id) {
                queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
              }
            },
          )
          .subscribe()
      } catch {
        // Sin Realtime/env: el polling de notificaciones y Actualizar siguen disponibles.
      }
    }

    void connect()

    return () => {
      cancelled = true
      if (postsBumpTimer) clearTimeout(postsBumpTimer)
      if (channel) {
        try {
          const supabase = getSupabaseBrowserClient()
          void supabase.removeChannel(channel)
        } catch {
          /* Safari privado / cliente no disponible */
        }
      }
    }
  }, [user?.id, queryClient])

  return null
}
