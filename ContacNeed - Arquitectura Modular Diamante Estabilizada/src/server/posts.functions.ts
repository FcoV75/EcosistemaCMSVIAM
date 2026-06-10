import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../lib/supabase.server'
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
  tipo_archivo?: string | null
  estado?: string | null
  estatus?: string | null
  fecha_creacion?: string | null
  usuario_id?: string | null
}

type PerfilRow = {
  id: string
  nombre?: string | null
  descripcion_profesion?: string | null
}

async function attachProfiles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: PublicacionRow[],
) {
  const userIds = [...new Set(posts.map((post) => post.usuario_id).filter(Boolean))] as string[]
  if (userIds.length === 0) return posts.map((post) => ({ ...post, perfiles: null }))

  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('id, nombre, descripcion_profesion')
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

function toMappedPost(post: PublicacionRow & { perfiles?: PerfilRow | null }) {
  return mapPublicacionToPost({
    ...post,
    fecha_creacion: post.fecha_creacion ? new Date(post.fecha_creacion) : null,
    perfiles: post.perfiles
      ? {
          nombre: post.perfiles.nombre,
          descripcion_profesion: post.perfiles.descripcion_profesion,
        }
      : null,
  })
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
        'id, contenido, url_multimedia, tipo_archivo, estado, estatus, fecha_creacion, usuario_id',
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
    return postsWithProfiles.map(toMappedPost)
  })

export const createPostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) throw new Error('Not authenticated')

    const content = data.content ?? ''
    const incomingMedia = data.mediaUrl || data.imageUrl || data.videoUrl || null
    let mediaUrl = incomingMedia ? String(incomingMedia) : null

    if (mediaUrl) {
      mediaUrl = toYouTubeEmbedUrl(mediaUrl) ?? mediaUrl
    }

    const { data: profile } = await createSupabaseAdminClient()
      .from('perfiles')
      .select('estado, nombre, descripcion_profesion')
      .eq('id', authData.user.id)
      .maybeSingle()

    const { data: post, error } = await createSupabaseAdminClient()
      .from('publicaciones')
      .insert({
        usuario_id: authData.user.id,
        contenido: content,
        url_multimedia: mediaUrl,
        estado: data.estado ?? profile?.estado ?? null,
        estatus: 'aprobado',
        tipo_archivo: data.tipo_archivo ?? null,
      })
      .select(
        'id, contenido, url_multimedia, tipo_archivo, estado, estatus, fecha_creacion, usuario_id',
      )
      .single()

    if (error) throw error

    return toMappedPost({
      ...post,
      perfiles: profile
        ? {
            id: authData.user.id,
            nombre: profile.nombre,
            descripcion_profesion: profile.descripcion_profesion,
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
  .inputValidator((d: any) => d)
  .handler(async () => {
    return { success: true }
  })
