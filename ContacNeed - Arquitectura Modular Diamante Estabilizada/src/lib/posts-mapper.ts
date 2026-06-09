import { toYouTubeEmbedUrl } from './youtube'

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
  comments: number
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
  perfiles?: { full_name?: string | null; specialty?: string | null } | null
}): MappedPost {
  const media = toMediaFields(post.url_multimedia)
  const userId = post.usuario_id ?? 'anon'

  return {
    id: post.id,
    content: post.contenido ?? '',
    ...media,
    estado: post.estado ?? '',
    estatus: post.estatus ?? 'aprobado',
    createdAt: post.fecha_creacion?.getTime() ?? Date.now(),
    professionalId: post.usuario_id ?? '',
    likes: 0,
    comments: 0,
    commentList: [],
    authorData: {
      name: post.perfiles?.full_name ?? 'Usuario',
      avatar: `https://i.pravatar.cc/150?u=${userId}`,
      title: post.perfiles?.specialty ?? 'Profesional',
      verified: false,
      isFounder: false,
    },
  }
}
