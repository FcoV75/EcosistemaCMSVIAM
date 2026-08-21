import { useState } from 'react'
import { toFeedImageUrl } from '../lib/media-url'
import { isCloudinaryUrl, isYouTubeUrl, toYouTubeEmbedUrl, toYouTubeThumbnail } from '../lib/youtube'

type PostMediaProps = {
  mediaUrl?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  mediaType?: string
  /** Versión compacta para comentarios / embeds pequeños */
  compact?: boolean
}

function resolveMediaUrl({ mediaUrl, imageUrl, videoUrl }: PostMediaProps) {
  return mediaUrl || imageUrl || videoUrl || ''
}

function SafeCloudinaryImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  const displaySrc = toFeedImageUrl(src)

  if (failed) {
    return (
      <div className="flex w-full items-center justify-center py-12 text-sm text-purple-200/60">
        No se pudo cargar la imagen.
      </div>
    )
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className="h-full w-full object-contain"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

function LazyYouTube({ url, compact }: { url: string; compact?: boolean }) {
  const [active, setActive] = useState(false)
  const embedUrl = toYouTubeEmbedUrl(url) ?? url
  const thumb = toYouTubeThumbnail(url)

  if (active) {
    return (
      <iframe
        src={embedUrl}
        className="absolute inset-0 h-full w-full border-0"
        title="Video de publicación"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className="absolute inset-0 flex h-full w-full items-center justify-center bg-black"
      aria-label="Reproducir video de YouTube"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span
        className={`relative z-10 rounded-full bg-red-600 font-bold text-white shadow-lg ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
      >
        Ver video
      </span>
    </button>
  )
}

function LazyVimeo({ videoId, compact }: { videoId: string; compact?: boolean }) {
  const [active, setActive] = useState(false)

  if (active) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${videoId}?playsinline=1`}
        className="absolute inset-0 h-full w-full border-0"
        title="Video Vimeo"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-950"
      aria-label="Reproducir video de Vimeo"
    >
      <span
        className={`rounded-full bg-sky-600 font-bold text-white ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
      >
        Ver video
      </span>
    </button>
  )
}

function MediaFrame({
  children,
  compact,
}: {
  children: React.ReactNode
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-purple-500/20 bg-slate-900/60">
        {children}
      </div>
    )
  }
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
    const compact = Boolean(props.compact)
    const maxH = compact ? 'max-h-56' : 'max-h-[420px]'
    const minH = compact ? 'min-h-[120px]' : 'min-h-[180px]'

    const embedUrl = toYouTubeEmbedUrl(url)
    const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i)

    if (url.endsWith('.mp4') || url.endsWith('.mov') || props.mediaType === 'video') {
      return (
        <MediaFrame compact={compact}>
          <div className={`aspect-video w-full bg-black ${compact ? 'max-h-56' : ''}`}>
            <video
              src={url}
              controls
              playsInline
              preload="none"
              className="h-full w-full object-contain"
            />
          </div>
        </MediaFrame>
      )
    }

    if (embedUrl || isYouTubeUrl(url)) {
      return (
        <MediaFrame compact={compact}>
          <div className="relative aspect-video w-full bg-black">
            <LazyYouTube url={url} compact={compact} />
          </div>
        </MediaFrame>
      )
    }

    if (vimeoMatch) {
      return (
        <MediaFrame compact={compact}>
          <div className="relative aspect-video w-full bg-black">
            <LazyVimeo videoId={vimeoMatch[1]} compact={compact} />
          </div>
        </MediaFrame>
      )
    }

    if (isCloudinaryUrl(url) || url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
      return (
        <MediaFrame compact={compact}>
          <div className={`flex ${maxH} ${minH} w-full items-center justify-center bg-slate-950/40`}>
            <SafeCloudinaryImage src={url} alt="Contenido multimedia" />
          </div>
        </MediaFrame>
      )
    }

    return (
      <MediaFrame compact={compact}>
        <div className={`flex ${maxH} ${minH} w-full items-center justify-center bg-slate-950/40`}>
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
