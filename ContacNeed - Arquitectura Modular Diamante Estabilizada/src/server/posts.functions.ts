import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'
import { mapPublicacionToPost } from '../lib/posts-mapper'
import { toYouTubeEmbedUrl } from '../lib/youtube'
import { getDailyPostLimit, getStartOfTodayIso } from '../lib/plan-limits'

type GetPostsInput = {
  estado?: string
  includePending?: boolean
}

type PublicacionRow = {
  id: string
  contenido?: string | null
  url_multimedia?: string | null
  estado?: string | null
  estatus?: string | null
  fecha_creacion?: string | null
  usuario_id?: string | null
}

type PerfilRow = {
  id: string
  nombre?: string | null
  habilidad_empirica?: string | null
  descripcion_profesion?: string | null
  verificado?: boolean | null
  es_fundador?: boolean | null
  avatar_url?: string | null
}

async function attachProfiles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: PublicacionRow[],
) {
  const userIds = [...new Set(posts.map((post) => post.usuario_id).filter(Boolean))] as string[]
  if (userIds.length === 0) return posts.map((post) => ({ ...post, perfiles: null }))

  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('id, nombre, habilidad_empirica, descripcion_profesion, verificado, es_fundador, avatar_url')
    .in('id', userIds)

  if (error) {
    return posts.map((post) => ({ ...post, perfiles: null }))
  }

  const profileById = new Map((profiles ?? []).map((profile: PerfilRow) => [profile.id, profile]))

  return posts.map((post) => ({
    ...post,
    perfiles: post.usuario_id ? profileById.get(post.usuario_id) ?? null : null,
  }))
}

async function attachCommentCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: PublicacionRow[],
) {
  const ids = posts.map((post) => post.id)
  if (ids.length === 0) return new Map<string, number>()

  const { data, error } = await supabase
    .from('comentarios')
    .select('publicacion_id')
    .in('publicacion_id', ids)

  if (error) return new Map<string, number>()

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.publicacion_id, (counts.get(row.publicacion_id) ?? 0) + 1)
  }
  return counts
}

async function attachReactionCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: PublicacionRow[],
) {
  const ids = posts.map((post) => post.id)
  const empty = {
    likes: new Map<string, number>(),
    dislikes: new Map<string, number>(),
  }
  if (ids.length === 0) return empty

  const { data, error } = await supabase
    .from('reacciones')
    .select('publicacion_id, tipo')
    .in('publicacion_id', ids)

  if (error) return empty

  const likes = new Map<string, number>()
  const dislikes = new Map<string, number>()
  for (const row of data ?? []) {
    if (row.tipo === 'dislike') {
      dislikes.set(row.publicacion_id, (dislikes.get(row.publicacion_id) ?? 0) + 1)
    } else {
      likes.set(row.publicacion_id, (likes.get(row.publicacion_id) ?? 0) + 1)
    }
  }
  return { likes, dislikes }
}

async function attachUserReactions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: PublicacionRow[],
  userId: string | null,
) {
  const map = new Map<string, 'like' | 'dislike'>()
  if (!userId || posts.length === 0) return map

  const ids = posts.map((post) => post.id)
  const { data, error } = await supabase
    .from('reacciones')
    .select('publicacion_id, tipo')
    .eq('usuario_id', userId)
    .in('publicacion_id', ids)

  if (error) return map

  for (const row of data ?? []) {
    map.set(row.publicacion_id, row.tipo === 'dislike' ? 'dislike' : 'like')
  }
  return map
}

function toMappedPost(
  post: PublicacionRow & { perfiles?: PerfilRow | null },
  commentCount = 0,
  reactionCounts?: { likes: number; dislikes: number; userReaction?: 'like' | 'dislike' | null },
) {
  const mapped = mapPublicacionToPost({
    ...post,
    fecha_creacion: post.fecha_creacion ? new Date(post.fecha_creacion) : null,
    perfiles: post.perfiles
      ? {
          nombre: post.perfiles.nombre,
          habilidad_empirica: post.perfiles.habilidad_empirica,
          descripcion_profesion: post.perfiles.descripcion_profesion,
          verificado: post.perfiles.verificado,
          es_fundador: post.perfiles.es_fundador,
          avatar_url: post.perfiles.avatar_url,
        }
      : null,
  })
  return {
    ...mapped,
    likes: reactionCounts?.likes ?? 0,
    dislikes: reactionCounts?.dislikes ?? 0,
    userReaction: reactionCounts?.userReaction ?? null,
    comments: commentCount,
  }
}

export const getPosts = createServerFn({ method: 'GET' })
  .inputValidator((d: GetPostsInput) => d ?? {})
  .handler(async ({ data }) => {
    const estado = data?.estado?.trim()
    const includePending = Boolean(data?.includePending)
    const supabase = createSupabaseAdminClient()
    const authClient = createSupabaseServerClient()
    const {
      data: { user: currentUser },
    } = await authClient.auth.getUser()

    let query = supabase
      .from('publicaciones')
      .select(
        'id, contenido, url_multimedia, estado, estatus, fecha_creacion, usuario_id',
      )
      .order('fecha_creacion', { ascending: false })

    if (!includePending) {
      query = query.or('estatus.eq.aprobado,estatus.is.null')
    }

    if (estado) {
      query = query.eq('estado', estado)
    }

    const { data: posts, error } = await query
    if (error) throw error

    const postsWithProfiles = await attachProfiles(supabase, posts ?? [])
    const commentCounts = await attachCommentCounts(supabase, postsWithProfiles)
    const reactionCounts = await attachReactionCounts(supabase, postsWithProfiles)
    const userReactions = await attachUserReactions(supabase, postsWithProfiles, currentUser?.id ?? null)

    return postsWithProfiles.map((post) =>
      toMappedPost(post, commentCounts.get(post.id) ?? 0, {
        likes: reactionCounts.likes.get(post.id) ?? 0,
        dislikes: reactionCounts.dislikes.get(post.id) ?? 0,
        userReaction: userReactions.get(post.id) ?? null,
      }),
    )
  })

export const createPostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const { user, profile } = await requireActiveUser()

    const content = data.content ?? ''
    const incomingMedia = data.mediaUrl || data.imageUrl || data.videoUrl || null
    let mediaUrl = incomingMedia ? String(incomingMedia) : null

    if (mediaUrl) {
      mediaUrl = toYouTubeEmbedUrl(mediaUrl) ?? mediaUrl
    }

    if (!content.trim() && !mediaUrl) {
      throw new Error('Escribe contenido o adjunta multimedia')
    }

    const isPro = Boolean(profile?.es_pro)
    const postLimit = getDailyPostLimit(isPro)
    const startOfDay = getStartOfTodayIso()
    const { count: postsToday, error: countError } = await createSupabaseAdminClient()
      .from('publicaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .gte('fecha_creacion', startOfDay)

    if (countError) throw countError
    if ((postsToday ?? 0) >= postLimit) {
      throw new Error(
        isPro
          ? `Límite PRO alcanzado: ${postLimit} publicaciones por día. Vuelve mañana.`
          : `Plan gratuito: máximo ${postLimit} publicaciones al día. Activa PRO para hasta 30 diarias.`,
      )
    }

    const supabase = createSupabaseAdminClient()
    const { data: post, error } = await supabase
      .from('publicaciones')
      .insert({
        usuario_id: user.id,
        contenido: content,
        url_multimedia: mediaUrl,
        estado: data.estado ?? profile?.estado ?? null,
        estatus: 'aprobado',
      })
      .select(
        'id, contenido, url_multimedia, estado, estatus, fecha_creacion, usuario_id',
      )
      .single()

    if (error) throw error

    return toMappedPost({
      ...post,
      perfiles: profile
        ? {
            id: user.id,
            nombre: profile.nombre,
            habilidad_empirica: profile.habilidad_empirica,
            descripcion_profesion: profile.descripcion_profesion,
            verificado: profile.verificado,
            es_fundador: profile.es_fundador,
            avatar_url: profile.avatar_url,
          }
        : null,
    })
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('publicaciones').delete().eq('id', data.id)
    if (error) throw error
    return { success: true }
  })

export const updatePostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from('publicaciones')
      .update({ contenido: data.content })
      .eq('id', data.id)
    if (error) throw error
    return { success: true }
  })

export const reportContentFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from('publicaciones')
      .update({ estatus: 'pendiente' })
      .eq('id', data.postId)
    if (error) throw error
    return { success: true }
  })

export const addCommentFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { postId: string; comment: { text: string } | string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const text =
      typeof data.comment === 'string' ? data.comment.trim() : data.comment.text?.trim() ?? ''

    if (!text) throw new Error('El comentario está vacío')

    const { data: profile } = await supabase
      .from('perfiles')
      .select('nombre, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    const { data: row, error } = await supabase
      .from('comentarios')
      .insert({
        publicacion_id: data.postId,
        usuario_id: user.id,
        contenido: text,
      })
      .select('id, contenido, usuario_id')
      .single()

    if (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Comentarios en configuración. Ejecuta la migración SQL en Supabase.')
      }
      throw error
    }

    return {
      success: true,
      comment: {
        id: row.id,
        text: row.contenido,
        user_id: row.usuario_id,
        author_name: profile?.nombre ?? 'Usuario',
        author_avatar: profile?.avatar_url ?? null,
        created_at: new Date().toISOString(),
      },
    }
  })

export const toggleReactionFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { postId: string; tipo: 'like' | 'dislike' }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()

    const { data: existing, error: fetchError } = await supabase
      .from('reacciones')
      .select('id, tipo')
      .eq('publicacion_id', data.postId)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (fetchError) {
      if (fetchError.message.includes('does not exist')) {
        throw new Error('Reacciones en configuración. Ejecuta SQL 004 en Supabase.')
      }
      throw fetchError
    }

    if (existing?.tipo === data.tipo) {
      await supabase.from('reacciones').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('reacciones').update({ tipo: data.tipo }).eq('id', existing.id)
    } else {
      await supabase.from('reacciones').insert({
        publicacion_id: data.postId,
        usuario_id: user.id,
        tipo: data.tipo,
      })
    }

    const { data: rows } = await supabase
      .from('reacciones')
      .select('tipo')
      .eq('publicacion_id', data.postId)

    let likes = 0
    let dislikes = 0
    for (const row of rows ?? []) {
      if (row.tipo === 'dislike') dislikes += 1
      else likes += 1
    }

    const { data: current } = await supabase
      .from('reacciones')
      .select('tipo')
      .eq('publicacion_id', data.postId)
      .eq('usuario_id', user.id)
      .maybeSingle()

    return {
      likes,
      dislikes,
      userReaction: current ? (current.tipo === 'dislike' ? 'dislike' : 'like') : null,
    }
  })

export const getCommentsFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseAdminClient()
    const { data: rows, error } = await supabase
      .from('comentarios')
      .select('id, contenido, usuario_id, fecha_creacion')
      .eq('publicacion_id', data.postId)
      .order('fecha_creacion', { ascending: true })

    if (error) {
      if (error.message.includes('does not exist')) return []
      throw error
    }

    const userIds = [...new Set((rows ?? []).map((row) => row.usuario_id))]
    const { data: profiles } = await supabase
      .from('perfiles')
      .select('id, nombre, avatar_url')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    return (rows ?? []).map((row) => {
      const author = profileMap.get(row.usuario_id)
      return {
        id: row.id,
        text: row.contenido,
        user_id: row.usuario_id,
        author_name: author?.nombre ?? 'Usuario',
        author_avatar: author?.avatar_url ?? null,
        created_at: row.fecha_creacion,
      }
    })
  })
