import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../lib/supabase.server'
import { requireActiveUser } from '../lib/auth'
import { mapPublicacionToPost } from '../lib/posts-mapper'
import { toYouTubeEmbedUrl } from '../lib/youtube'

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
}

async function attachProfiles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: PublicacionRow[],
) {
  const userIds = [...new Set(posts.map((post) => post.usuario_id).filter(Boolean))] as string[]
  if (userIds.length === 0) return posts.map((post) => ({ ...post, perfiles: null }))

  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('id, nombre, habilidad_empirica, descripcion_profesion, verificado, es_fundador')
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

function toMappedPost(
  post: PublicacionRow & { perfiles?: PerfilRow | null },
  commentCount = 0,
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
        }
      : null,
  })
  return { ...mapped, comments: commentCount }
}

export const getPosts = createServerFn({ method: 'GET' })
  .inputValidator((d: GetPostsInput) => d ?? {})
  .handler(async ({ data }) => {
    const estado = data?.estado?.trim()
    const includePending = Boolean(data?.includePending)
    const supabase = createSupabaseAdminClient()

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
    return postsWithProfiles.map((post) => toMappedPost(post, commentCounts.get(post.id) ?? 0))
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
      comment: { id: row.id, text: row.contenido, user_id: row.usuario_id },
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

    return (rows ?? []).map((row) => ({
      id: row.id,
      text: row.contenido,
      user_id: row.usuario_id,
    }))
  })
