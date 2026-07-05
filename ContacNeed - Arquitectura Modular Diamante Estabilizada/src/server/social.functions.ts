import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser, requireActiveUser } from '../lib/auth'

const ONLINE_WINDOW_MS = 5 * 60 * 1000

export const pingLastSeenFn = createServerFn({ method: 'POST' }).handler(async () => {
  const user = await getServerUser()
  if (!user) return { ok: false }

  const supabase = createSupabaseAdminClient()
  await supabase
    .from('perfiles')
    .update({ ultima_conexion: new Date().toISOString() })
    .eq('id', user.id)

  return { ok: true }
})

export const getPublicProfileFn = createServerFn({ method: 'GET' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const supabase = createSupabaseAdminClient()

    const [{ data: profile, error: profileError }, { data: negocio }] = await Promise.all([
      supabase
        .from('perfiles')
        .select(
          'id, nombre, estado, municipio, habilidad_empirica, descripcion_profesion, avatar_url, es_pro, verificado, es_fundador, tipo_miembro, celular, ultima_conexion, bloqueado, calificacion_promedio, total_calificaciones',
        )
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('negocios')
        .select('banner_url, items, maps_address, lat, lng')
        .eq('id', userId)
        .maybeSingle(),
    ])

    if (profileError) throw profileError
    if (!profile || profile.bloqueado) throw new Error('Perfil no disponible')

    const online =
      profile.ultima_conexion &&
      Date.now() - new Date(profile.ultima_conexion).getTime() < ONLINE_WINDOW_MS

    return {
      profile: {
        id: profile.id,
        nombre: profile.nombre,
        estado: profile.estado,
        municipio: profile.municipio,
        habilidad_empirica: profile.habilidad_empirica,
        descripcion_profesion: profile.descripcion_profesion,
        avatar_url: profile.avatar_url,
        es_pro: Boolean(profile.es_pro),
        verificado: Boolean(profile.verificado),
        es_fundador: Boolean(profile.es_fundador),
        tipo_miembro: profile.tipo_miembro,
        celular: profile.celular,
        online,
        ultima_conexion: profile.ultima_conexion,
      },
      negocio: negocio ?? null,
    }
  })

export const getOnlineUsersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = createSupabaseAdminClient()
  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, habilidad_empirica, estado, avatar_url, es_pro, ultima_conexion')
    .gte('ultima_conexion', since)
    .eq('bloqueado', false)
    .order('ultima_conexion', { ascending: false })
    .limit(30)

  if (error) {
    if (error.message.includes('does not exist')) return []
    throw error
  }

  return data ?? []
})

export const sendMessageFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { destinatarioId: string; cuerpo: string; asunto?: string; tipo?: 'general' | 'servicio' | 'amistad' | 'informe_pro' }) =>
      d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    if (user.id === data.destinatarioId) throw new Error('No puedes enviarte mensajes a ti mismo')
    if (data.tipo === 'informe_pro') throw new Error('Tipo de mensaje no permitido')

    const supabase = createSupabaseAdminClient()
    const { data: row, error } = await supabase
      .from('mensajes')
      .insert({
        remitente_id: user.id,
        destinatario_id: data.destinatarioId,
        asunto: data.asunto?.trim() || null,
        cuerpo: data.cuerpo.trim(),
        tipo: data.tipo ?? 'general',
      })
      .select('id')
      .single()

    if (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Bandeja de mensajes en configuración. Ejecuta SQL 004 en Supabase.')
      }
      throw error
    }

    return { success: true, id: row.id }
  })

async function fetchInboxMessages(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { data: rows, error } = await supabase
    .from('mensajes')
    .select('id, remitente_id, destinatario_id, asunto, cuerpo, tipo, leido, created_at')
    .or(`remitente_id.eq.${userId},destinatario_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const userIds = [
    ...new Set(
      (rows ?? []).flatMap((row) => [row.remitente_id, row.destinatario_id]).filter(Boolean),
    ),
  ] as string[]

  const { data: profiles } = await supabase
    .from('perfiles')
    .select('id, nombre, avatar_url')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  return (rows ?? []).map((row) => {
    const isIncoming = row.destinatario_id === userId
    const peerId = isIncoming ? row.remitente_id : row.destinatario_id
    const peer = profileMap.get(peerId)
    return {
      id: row.id,
      cuerpo: row.cuerpo,
      asunto: row.asunto,
      tipo: row.tipo,
      leido: row.leido,
      created_at: row.created_at,
      incoming: isIncoming,
      peer: {
        id: peerId,
        nombre: peer?.nombre ?? 'Usuario',
        avatar_url: peer?.avatar_url ?? null,
      },
    }
  })
}

export const getInboxFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireActiveUser()

  try {
    const messages = await fetchInboxMessages(user.id)
    const unread = messages.filter((m) => m.incoming && !m.leido).length
    return { messages, unread }
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('does not exist')) return { messages: [], unread: 0 }
    throw error
  }
})

export const markMessageReadFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('mensajes')
      .update({ leido: true })
      .eq('id', data.id)
      .eq('destinatario_id', user.id)

    if (error) throw error
    return { success: true }
  })

export const getConversationFn = createServerFn({ method: 'GET' })
  .inputValidator((peerId: string) => peerId)
  .handler(async ({ data: peerId }) => {
    const { user, profile } = await requireActiveUser()
    if (!profile?.es_pro) {
      throw new Error('El chat en vivo es exclusivo de ContacNeed PRO. Usa tu bandeja de mensajes en plan gratuito.')
    }
    if (user.id === peerId) throw new Error('Conversación no válida')

    const supabase = createSupabaseAdminClient()

    const [{ data: rows, error }, { data: peerProfile }] = await Promise.all([
      supabase
        .from('mensajes')
        .select('id, remitente_id, destinatario_id, asunto, cuerpo, tipo, leido, created_at')
        .or(
          `and(remitente_id.eq.${user.id},destinatario_id.eq.${peerId}),and(remitente_id.eq.${peerId},destinatario_id.eq.${user.id})`,
        )
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('perfiles')
        .select('id, nombre, avatar_url, ultima_conexion')
        .eq('id', peerId)
        .maybeSingle(),
    ])

    if (error) {
      if (error.message.includes('does not exist')) {
        return {
          peer: {
            id: peerId,
            nombre: 'Usuario',
            avatar_url: null,
            online: false,
          },
          messages: [],
        }
      }
      throw error
    }

    await supabase
      .from('mensajes')
      .update({ leido: true })
      .eq('destinatario_id', user.id)
      .eq('remitente_id', peerId)
      .eq('leido', false)

    const online =
      peerProfile?.ultima_conexion &&
      Date.now() - new Date(peerProfile.ultima_conexion).getTime() < ONLINE_WINDOW_MS

    return {
      peer: {
        id: peerId,
        nombre: peerProfile?.nombre ?? 'Usuario',
        avatar_url: peerProfile?.avatar_url ?? null,
        online: Boolean(online),
      },
      messages: (rows ?? []).map((row) => ({
        id: row.id,
        remitente_id: row.remitente_id,
        destinatario_id: row.destinatario_id,
        asunto: row.asunto,
        cuerpo: row.cuerpo,
        tipo: row.tipo,
        leido: row.leido,
        created_at: row.created_at,
        mine: row.remitente_id === user.id,
      })),
    }
  })

export const getConversationsSummaryFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireActiveUser()

  try {
    const messages = await fetchInboxMessages(user.id)
    const byPeer = new Map<
      string,
      {
        peer: { id: string; nombre: string; avatar_url: string | null }
        lastMessage: { cuerpo: string; created_at: string; incoming: boolean; leido: boolean }
        unreadCount: number
      }
    >()

    for (const msg of messages) {
      const existing = byPeer.get(msg.peer.id)
      if (!existing) {
        byPeer.set(msg.peer.id, {
          peer: msg.peer,
          lastMessage: {
            cuerpo: msg.cuerpo,
            created_at: msg.created_at,
            incoming: msg.incoming,
            leido: msg.leido,
          },
          unreadCount: msg.incoming && !msg.leido ? 1 : 0,
        })
        continue
      }

      if (msg.incoming && !msg.leido) {
        existing.unreadCount += 1
      }
    }

    return [...byPeer.values()].sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('does not exist')) return []
    throw error
  }
})

export const sendContactRequestFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { destinatarioId: string; tipo: 'amistad' | 'servicio'; mensaje?: string }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    if (user.id === data.destinatarioId) throw new Error('Acción no válida')

    const supabase = createSupabaseAdminClient()
    const { data: row, error } = await supabase
      .from('solicitudes_contacto')
      .upsert(
        {
          solicitante_id: user.id,
          destinatario_id: data.destinatarioId,
          tipo: data.tipo,
          mensaje: data.mensaje?.trim() || null,
          estatus: 'pendiente',
        },
        { onConflict: 'solicitante_id,destinatario_id,tipo' },
      )
      .select('id')
      .single()

    if (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Solicitudes de contacto en configuración. Ejecuta SQL 004 en Supabase.')
      }
      throw error
    }

    return { success: true, id: row.id }
  })

export const getContactRequestsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireActiveUser()
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .select('id, solicitante_id, tipo, mensaje, estatus, created_at')
    .eq('destinatario_id', user.id)
    .eq('estatus', 'pendiente')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message.includes('does not exist')) return []
    throw error
  }

  const ids = [...new Set((data ?? []).map((r) => r.solicitante_id))]
  const { data: profiles } = await supabase
    .from('perfiles')
    .select('id, nombre, avatar_url, habilidad_empirica, estado')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  return (data ?? []).map((row) => {
    const solicitante = profileMap.get(row.solicitante_id)
    return {
      id: row.id,
      tipo: row.tipo,
      mensaje: row.mensaje,
      created_at: row.created_at,
      solicitante: {
        id: row.solicitante_id,
        nombre: solicitante?.nombre ?? 'Usuario',
        avatar_url: solicitante?.avatar_url ?? null,
        habilidad_empirica: solicitante?.habilidad_empirica ?? null,
        estado: solicitante?.estado ?? null,
      },
    }
  })
})

export const respondContactRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; accept: boolean }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()

    const { data: request, error: fetchError } = await supabase
      .from('solicitudes_contacto')
      .select('id, solicitante_id, destinatario_id, estatus')
      .eq('id', data.id)
      .eq('destinatario_id', user.id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!request) throw new Error('Solicitud no encontrada')

    const estatus = data.accept ? 'aceptada' : 'rechazada'
    const { error } = await supabase
      .from('solicitudes_contacto')
      .update({ estatus })
      .eq('id', data.id)

    if (error) throw error

    if (data.accept) {
      const pair = [request.solicitante_id, request.destinatario_id].sort()
      await supabase.from('contactos').upsert(
        { usuario_a: pair[0], usuario_b: pair[1] },
        { onConflict: 'usuario_a,usuario_b', ignoreDuplicates: true },
      )
    }

    return { success: true, estatus }
  })
