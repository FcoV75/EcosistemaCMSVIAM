import { createServerFn } from '@tanstack/react-start'
import { prisma } from '../lib/prisma.server'
import { createSupabaseServerClient } from '../lib/supabase.server'
import { mapPublicacionToPost } from '../lib/posts-mapper'
import { toYouTubeEmbedUrl } from '../lib/youtube'

type GetPostsInput = {
  estado?: string
  includePending?: boolean
}

function buildApprovedFilter(includePending: boolean) {
  if (includePending) return {}
  return {
    OR: [{ estatus: 'aprobado' }, { estatus: null }],
  }
}

export const getPosts = createServerFn({ method: 'GET' })
  .inputValidator((d: GetPostsInput) => d ?? {})
  .handler(async ({ data }) => {
    const estado = data?.estado?.trim()
    const includePending = Boolean(data?.includePending)

    const postsData = await prisma.publicaciones.findMany({
      where: {
        ...buildApprovedFilter(includePending),
        ...(estado ? { estado } : {}),
      },
      orderBy: { fecha_creacion: 'desc' },
      include: {
        perfiles: {
          select: {
            full_name: true,
            specialty: true,
          },
        },
      },
    })

    return postsData.map(mapPublicacionToPost)
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

    const profile = await prisma.perfiles.findUnique({
      where: { id: authData.user.id },
      select: { estado: true },
    })

    const post = await prisma.publicaciones.create({
      data: {
        usuario_id: authData.user.id,
        contenido: content,
        url_multimedia: mediaUrl,
        estado: data.estado ?? profile?.estado ?? null,
        estatus: 'aprobado',
        tipo_archivo: data.tipo_archivo ?? null,
      },
      include: {
        perfiles: {
          select: {
            full_name: true,
            specialty: true,
          },
        },
      },
    })

    return mapPublicacionToPost(post)
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    await prisma.publicaciones.delete({ where: { id: data.id } })
    return { success: true }
  })

export const updatePostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    await prisma.publicaciones.update({
      where: { id: data.id },
      data: { contenido: data.content },
    })
    return { success: true }
  })

export const reportContentFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    await prisma.publicaciones.update({
      where: { id: data.postId },
      data: { estatus: 'pendiente' },
    })
    return { success: true }
  })

export const addCommentFn = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async () => {
    return { success: true }
  })
