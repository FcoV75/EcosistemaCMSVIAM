import { useState } from 'react'
import { isCloudinaryUrl, isYouTubeUrl, toYouTubeEmbedUrl } from '../lib/youtube'

type PostMediaProps = {
  mediaUrl?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  mediaType?: string
}

function resolveMediaUrl({ mediaUrl, imageUrl, videoUrl }: PostMediaProps) {
  return mediaUrl || imageUrl || videoUrl || ''
}

function SafeCloudinaryImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex w-full items-center justify-center py-12 text-sm text-purple-200/60">
        No se pudo cargar la imagen.
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function MediaFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-4 pt-1">
      <div className="overflow-hidden rounded-2xl border border-purple-500/20 bg-slate-900/60 shadow-inner shadow-purple-900/20">
        {children}
      </div>
    </div>
  )
}

export function PostMedia(props: PostMediaProps) {
  try {
    const url = resolveMediaUrl(props)
    if (!url) return null

    const embedUrl = toYouTubeEmbedUrl(url)
    const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i)

    if (url.endsWith('.mp4') || url.endsWith('.mov') || props.mediaType === 'video') {
      return (
        <MediaFrame>
          <div className="aspect-video w-full bg-black">
            <video src={url} controls className="h-full w-full object-contain" />
          </div>
        </MediaFrame>
      )
    }

    if (embedUrl || isYouTubeUrl(url)) {
      return (
        <MediaFrame>
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={embedUrl ?? url}
              className="absolute inset-0 h-full w-full border-0"
              title="Video de publicación"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </MediaFrame>
      )
    }

    if (vimeoMatch) {
      return (
        <MediaFrame>
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
              className="absolute inset-0 h-full w-full border-0"
              title="Video Vimeo"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        </MediaFrame>
      )
    }

    if (isCloudinaryUrl(url) || url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
      return (
        <MediaFrame>
          <div className="flex max-h-[520px] min-h-[200px] w-full items-center justify-center bg-slate-950/40">
            <SafeCloudinaryImage src={url} alt="Contenido multimedia" />
          </div>
        </MediaFrame>
      )
    }

    return (
      <MediaFrame>
        <div className="flex max-h-[520px] min-h-[200px] w-full items-center justify-center bg-slate-950/40">
          <SafeCloudinaryImage src={url} alt="Contenido multimedia" />
        </div>
      </MediaFrame>
    )
  } catch {
    return (
      <div className="mx-4 mb-4 rounded-xl border border-red-400/30 bg-red-950/30 py-6 text-center text-sm text-red-200">
        Error al renderizar multimedia.
      </div>
    )
  }
}

export function hasPostMedia(props: PostMediaProps) {
  return Boolean(resolveMediaUrl(props))
}
