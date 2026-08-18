import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { getServerUser, requireActiveUser } from '../lib/auth'
import { crearNotificacion } from '../lib/notificaciones'
import { resolveAvatarUrl } from '../lib/default-avatar'

const ONLINE_WINDOW_MS = 5 * 60 * 1000

function contactPair(userA: string, userB: string) {
  return [userA, userB].sort() as [string, string]
}

async function sonContactos(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userA: string,
  userB: string,
) {
  const [a, b] = contactPair(userA, userB)
  const { data } = await supabase
    .from('contactos')
    .select('id')
    .eq('usuario_a', a)
    .eq('usuario_b', b)
    .maybeSingle()
  return Boolean(data?.id)
}

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
    const viewer = await getServerUser()

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

    let esContacto = false
    let solicitudPendiente: 'amistad' | 'servicio' | null = null
    if (viewer?.id && viewer.id !== userId) {
      esContacto = await sonContactos(supabase, viewer.id, userId)
      const { data: pending } = await supabase
        .from('solicitudes_contacto')
        .select('tipo')
        .eq('solicitante_id', viewer.id)
        .eq('destinatario_id', userId)
        .eq('estatus', 'pendiente')
        .limit(5)
      if (pending?.some((p) => p.tipo === 'servicio')) solicitudPendiente = 'servicio'
      else if (pending?.some((p) => p.tipo === 'amistad')) solicitudPendiente = 'amistad'
    }

    return {
      profile: {
        id: profile.id,
        nombre: profile.nombre,
        estado: profile.estado,
        municipio: profile.municipio,
        habilidad_empirica: profile.habilidad_empirica,
        descripcion_profesion: profile.descripcion_profesion,
        avatar_url: resolveAvatarUrl(profile.avatar_url, profile.id, profile.nombre),
        es_pro: Boolean(profile.es_pro),
        verificado: Boolean(profile.verificado),
        es_fundador: Boolean(profile.es_fundador),
        tipo_miembro: profile.tipo_miembro,
        celular: profile.celular,
        online,
        ultima_conexion: profile.ultima_conexion,
        calificacion_promedio: profile.calificacion_promedio,
        total_calificaciones: profile.total_calificaciones,
      },
      negocio: negocio ?? null,
      relacion: {
        esContacto,
        solicitudPendiente,
        puedeChatear: esContacto,
      },
    }
  })

export const searchProfilesFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { query: string; estado?: string }) => d)
  .handler(async ({ data }) => {
    const q = data.query.trim().toLowerCase()
    if (q.length < 2) return { profiles: [] as const }

    const supabase = createSupabaseAdminClient()
    // Evita filtros .or(ilike) frágiles de PostgREST (espacios/caracteres) que
    // pueden colgar o fallar la búsqueda y “atorar” el buscador en el cliente.
    let query = supabase
      .from('perfiles')
      .select(
        'id, nombre, estado, municipio, habilidad_empirica, descripcion_profesion, avatar_url, es_pro, verificado, tipo_miembro, ultima_conexion',
      )
      .eq('bloqueado', false)
      .order('nombre', { ascending: true })
      .limit(400)

    const estado = data.estado?.trim()
    if (estado) query = query.eq('estado', estado)

    const { data: rows, error } = await query
    if (error) throw new Error(error.message)

    const profiles = (rows ?? [])
      .filter((row) => {
        const haystack = [
          row.nombre,
          row.habilidad_empirica,
          row.descripcion_profesion,
          row.estado,
          row.municipio,
          row.tipo_miembro,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 24)
      .map((row) => ({
        id: row.id,
        nombre: row.nombre ?? 'Profesional',
        estado: row.estado,
        municipio: row.municipio,
        habilidad_empirica: row.habilidad_empirica,
        descripcion_profesion: row.descripcion_profesion,
        tipo_miembro: row.tipo_miembro,
        es_pro: Boolean(row.es_pro),
        verificado: Boolean(row.verificado),
        avatar_url: resolveAvatarUrl(row.avatar_url, row.id, row.nombre),
        online:
          Boolean(row.ultima_conexion) &&
          Date.now() - new Date(row.ultima_conexion).getTime() < ONLINE_WINDOW_MS,
      }))

    return { profiles }
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
    (d: {
      destinatarioId: string
      cuerpo?: string
      asunto?: string
      tipo?: 'general' | 'servicio' | 'amistad' | 'informe_pro'
      adjunto?: {
        url: string
        mimeType?: string | null
        fileName?: string | null
        sizeBytes?: number | null
      } | null
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    if (user.id === data.destinatarioId) throw new Error('No puedes enviarte mensajes a ti mismo')
    if (data.tipo === 'informe_pro') throw new Error('Tipo de mensaje no permitido')

    const supabase = createSupabaseAdminClient()
    const tipo = data.tipo ?? 'general'
    const adjuntoUrl = data.adjunto?.url?.trim() || null
    const cuerpoRaw = data.cuerpo?.trim() ?? ''
    const cuerpo = cuerpoRaw || (adjuntoUrl ? '📎' : '')
    if (!cuerpo) throw new Error('Escribe un mensaje o adjunta un archivo.')

    // Chat / mensajes libres solo entre contactos (amistad o servicio aceptado).
    // Las solicitudes de servicio van por sendContactRequestFn.
    if (tipo === 'general' || tipo === 'amistad') {
      const ok = await sonContactos(supabase, user.id, data.destinatarioId)
      if (!ok) {
        throw new Error(
          'Para chatear o escribir libremente primero deben aceptar tu solicitud de amistad o de servicio.',
        )
      }
    }

    if (tipo === 'servicio' && cuerpoRaw.length < 20) {
      throw new Error('Describe con más detalle el servicio que necesitas (mínimo 20 caracteres).')
    }

    const payload: Record<string, unknown> = {
      remitente_id: user.id,
      destinatario_id: data.destinatarioId,
      asunto: data.asunto?.trim() || null,
      cuerpo,
      tipo,
    }

    if (adjuntoUrl) {
      payload.url_adjunto = adjuntoUrl
      payload.tipo_mime = data.adjunto?.mimeType?.trim() || null
      payload.nombre_archivo = data.adjunto?.fileName?.trim() || null
      payload.tamanio_bytes =
        typeof data.adjunto?.sizeBytes === 'number' && data.adjunto.sizeBytes >= 0
          ? Math.round(data.adjunto.sizeBytes)
          : null
    }

    const { data: row, error } = await supabase
      .from('mensajes')
      .insert(payload)
      .select('id, url_adjunto, tipo_mime, nombre_archivo, tamanio_bytes')
      .single()

    if (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Bandeja de mensajes en configuración. Ejecuta SQL 004 en Supabase.')
      }
      if (
        error.message.includes('url_adjunto') ||
        error.message.includes('tipo_mime') ||
        error.message.includes('nombre_archivo') ||
        error.message.includes('tamanio_bytes')
      ) {
        throw new Error('Falta la migración 013 en Supabase (adjuntos en chat).')
      }
      throw error
    }

    const { data: sender } = await supabase
      .from('perfiles')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle()

    const preview =
      cuerpoRaw ||
      (row.nombre_archivo ? `📎 ${row.nombre_archivo}` : adjuntoUrl ? '📎 Archivo adjunto' : cuerpo)

    await crearNotificacion(supabase, {
      usuarioId: data.destinatarioId,
      tipo: tipo === 'servicio' ? 'solicitud_servicio' : 'mensaje',
      titulo:
        tipo === 'servicio'
          ? `Detalle de servicio de ${sender?.nombre || 'un usuario'}`
          : `Nuevo mensaje de ${sender?.nombre || 'un contacto'}`,
      cuerpo: String(preview).slice(0, 140),
      enlace: '/mensajes',
      metadata: { mensaje_id: row.id, remitente_id: user.id, tipo },
    })

    return {
      success: true,
      id: row.id,
      adjunto: adjuntoUrl
        ? {
            url: row.url_adjunto ?? adjuntoUrl,
            mimeType: row.tipo_mime ?? data.adjunto?.mimeType ?? null,
            fileName: row.nombre_archivo ?? data.adjunto?.fileName ?? null,
            sizeBytes: row.tamanio_bytes ?? data.adjunto?.sizeBytes ?? null,
          }
        : null,
    }
  })


async function fetchInboxMessages(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { data: rows, error } = await supabase
    .from('mensajes')
    .select(
      'id, remitente_id, destinatario_id, asunto, cuerpo, tipo, leido, created_at, url_adjunto, tipo_mime, nombre_archivo, tamanio_bytes',
    )
    .or(`remitente_id.eq.${userId},destinatario_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    // Migración 013 aún no aplicada
    if (
      error.message.includes('url_adjunto') ||
      error.message.includes('tipo_mime') ||
      error.message.includes('nombre_archivo') ||
      error.message.includes('tamanio_bytes')
    ) {
      const legacy = await supabase
        .from('mensajes')
        .select('id, remitente_id, destinatario_id, asunto, cuerpo, tipo, leido, created_at')
        .or(`remitente_id.eq.${userId},destinatario_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (legacy.error) throw legacy.error
      return mapInboxRows(supabase, userId, legacy.data ?? [])
    }
    throw error
  }

  return mapInboxRows(supabase, userId, rows ?? [])
}

async function mapInboxRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  rows: Array<{
    id: string
    remitente_id: string
    destinatario_id: string
    asunto: string | null
    cuerpo: string
    tipo: string
    leido: boolean
    created_at: string
    url_adjunto?: string | null
    tipo_mime?: string | null
    nombre_archivo?: string | null
    tamanio_bytes?: number | null
  }>,
) {
  const userIds = [
    ...new Set(rows.flatMap((row) => [row.remitente_id, row.destinatario_id]).filter(Boolean)),
  ] as string[]

  const { data: profiles } = await supabase
    .from('perfiles')
    .select('id, nombre, avatar_url')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  return rows.map((row) => {
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
      url_adjunto: row.url_adjunto ?? null,
      tipo_mime: row.tipo_mime ?? null,
      nombre_archivo: row.nombre_archivo ?? null,
      tamanio_bytes: row.tamanio_bytes ?? null,
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
    const ok = await sonContactos(supabase, user.id, peerId)
    if (!ok) {
      throw new Error(
        'El chat en vivo se habilita cuando acepten tu solicitud de amistad o de servicio.',
      )
    }

    const [{ data: rows, error }, { data: peerProfile }] = await Promise.all([
      supabase
        .from('mensajes')
        .select(
          'id, remitente_id, destinatario_id, asunto, cuerpo, tipo, leido, created_at, url_adjunto, tipo_mime, nombre_archivo, tamanio_bytes',
        )
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
      if (
        error.message.includes('url_adjunto') ||
        error.message.includes('tipo_mime') ||
        error.message.includes('nombre_archivo') ||
        error.message.includes('tamanio_bytes')
      ) {
        throw new Error('Falta la migración 013 en Supabase (adjuntos en chat).')
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
        url_adjunto: row.url_adjunto ?? null,
        tipo_mime: row.tipo_mime ?? null,
        nombre_archivo: row.nombre_archivo ?? null,
        tamanio_bytes: row.tamanio_bytes ?? null,
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
        lastMessage: {
          cuerpo: string
          created_at: string
          incoming: boolean
          leido: boolean
          url_adjunto?: string | null
          nombre_archivo?: string | null
        }
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
            url_adjunto: msg.url_adjunto ?? null,
            nombre_archivo: msg.nombre_archivo ?? null,
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

    const mensaje = data.mensaje?.trim() || ''
    if (data.tipo === 'servicio') {
      if (mensaje.length < 20) {
        throw new Error(
          'En la solicitud de servicio describe con claridad qué necesitas (mínimo 20 caracteres).',
        )
      }
    }

    const supabase = createSupabaseAdminClient()

    if (await sonContactos(supabase, user.id, data.destinatarioId)) {
      throw new Error('Ya eres contacto de esta persona. Puedes escribirle o chatear desde Mensajes.')
    }

    const { data: row, error } = await supabase
      .from('solicitudes_contacto')
      .upsert(
        {
          solicitante_id: user.id,
          destinatario_id: data.destinatarioId,
          tipo: data.tipo,
          mensaje: mensaje || null,
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

    const { data: sender } = await supabase
      .from('perfiles')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle()

    await crearNotificacion(supabase, {
      usuarioId: data.destinatarioId,
      tipo: data.tipo === 'servicio' ? 'solicitud_servicio' : 'solicitud_amistad',
      titulo:
        data.tipo === 'servicio'
          ? `Solicitud de servicio de ${sender?.nombre || 'un usuario'}`
          : `Solicitud de amistad de ${sender?.nombre || 'un usuario'}`,
      cuerpo: mensaje || 'Tienes una nueva solicitud pendiente.',
      enlace: '/mensajes',
      metadata: { solicitud_id: row.id, tipo: data.tipo },
    })

    // Copia en bandeja para que el detalle del servicio quede documentado.
    if (data.tipo === 'servicio' && mensaje) {
      await supabase.from('mensajes').insert({
        remitente_id: user.id,
        destinatario_id: data.destinatarioId,
        asunto: 'Solicitud de servicio',
        cuerpo: mensaje,
        tipo: 'servicio',
      })
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

      const { data: accepter } = await supabase
        .from('perfiles')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle()

      await crearNotificacion(supabase, {
        usuarioId: request.solicitante_id,
        tipo: 'general',
        titulo: `${accepter?.nombre || 'Un usuario'} aceptó tu solicitud`,
        cuerpo: 'Ya pueden escribirse y usar el chat (si tienen PRO).',
        enlace: '/mensajes',
        metadata: { solicitud_id: request.id },
      })
    }

    return { success: true, estatus }
  })
