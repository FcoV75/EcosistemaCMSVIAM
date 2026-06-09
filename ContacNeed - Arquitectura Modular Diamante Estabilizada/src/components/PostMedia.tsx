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
      <div className="w-full py-10 text-center text-sm text-gray-500 bg-gray-100">
        No se pudo cargar la imagen.
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
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
        <div className="w-full bg-gray-100 max-h-[400px] overflow-hidden flex justify-center items-center">
          <video src={url} controls className="w-full max-h-[400px] bg-black" />
        </div>
      )
    }

    if (embedUrl || isYouTubeUrl(url)) {
      return (
        <div className="w-full bg-gray-100 max-h-[400px] overflow-hidden flex justify-center items-center">
          <iframe
            src={embedUrl ?? url}
            className="w-full aspect-video"
            title="Video de publicación"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }

    if (vimeoMatch) {
      return (
        <div className="w-full bg-gray-100 max-h-[400px] overflow-hidden flex justify-center items-center">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
            className="w-full aspect-video"
            title="Video Vimeo"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }

    if (isCloudinaryUrl(url)) {
      return (
        <div className="w-full bg-gray-100 max-h-[400px] overflow-hidden flex justify-center items-center">
          <SafeCloudinaryImage src={url} alt="Contenido multimedia" />
        </div>
      )
    }

    return (
      <div className="w-full bg-gray-100 max-h-[400px] overflow-hidden flex justify-center items-center">
        <SafeCloudinaryImage src={url} alt="Contenido multimedia" />
      </div>
    )
  } catch {
    return (
      <div className="w-full py-8 text-center text-sm text-red-500 bg-red-50">
        Error al renderizar multimedia.
      </div>
    )
  }
}

export function hasPostMedia(props: PostMediaProps) {
  return Boolean(resolveMediaUrl(props))
}
