import { toYouTubeEmbedUrl } from './youtube'
import { resolveAvatarUrl } from './default-avatar'

export type MappedPost = {
  id: string
  content: string
  mediaUrl: string
  imageUrl: string
  videoUrl: string
  estado: string
  estatus: string
  createdAt: number
  professionalId: string
  likes: number
  dislikes: number
  userReaction: 'like' | 'dislike' | null
  comments: number
  shares: number
  commentList: unknown[]
  authorData: {
    name: string
    avatar: string
    title?: string
    verified?: boolean
    isFounder?: boolean
  }
}

function toMediaFields(url: string | null | undefined) {
  const normalized = toYouTubeEmbedUrl(url ?? '') ?? (url ?? '')
  const media = normalized || ''
  return {
    mediaUrl: media,
    imageUrl: media,
    videoUrl: media,
  }
}

export function mapPublicacionToPost(post: {
  id: string
  contenido?: string | null
  url_multimedia?: string | null
  fecha_creacion?: Date | null
  usuario_id?: string | null
  estado?: string | null
  estatus?: string | null
  perfiles?: {
    nombre?: string | null
    habilidad_empirica?: string | null
    descripcion_profesion?: string | null
    verificado?: boolean | null
    es_fundador?: boolean | null
    avatar_url?: string | null
  } | null
}): MappedPost {
  const media = toMediaFields(post.url_multimedia)
  const userId = post.usuario_id ?? 'anon'
  const profession =
    post.perfiles?.habilidad_empirica?.trim() ||
    post.perfiles?.descripcion_profesion?.split('.')[0]?.trim() ||
    'Profesional'

  return {
    id: post.id,
    content: post.contenido ?? '',
    ...media,
    estado: post.estado ?? '',
    estatus: post.estatus ?? 'aprobado',
    createdAt: post.fecha_creacion?.getTime() ?? Date.now(),
    professionalId: post.usuario_id ?? '',
    likes: 0,
    dislikes: 0,
    userReaction: null,
    comments: 0,
    shares: 0,
    commentList: [],
    authorData: {
      name: post.perfiles?.nombre ?? 'Usuario',
      avatar: resolveAvatarUrl(post.perfiles?.avatar_url, userId, post.perfiles?.nombre),
      title: profession,
      verified: Boolean(post.perfiles?.verificado),
      isFounder: Boolean(post.perfiles?.es_fundador),
    },
  }
}
