const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i

export function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export function toYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.includes('youtube.com/embed/')) {
    if (/[?&]playsinline=/.test(url)) return url
    return url.includes('?') ? `${url}&playsinline=1` : `${url}?playsinline=1`
  }

  const videoId = extractYouTubeId(url)
  if (!videoId) return null

  return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`
}

export function isYouTubeUrl(url: string): boolean {
  return Boolean(extractYouTubeId(url) || url.includes('youtube.com/embed/'))
}

export function toYouTubeThumbnail(url: string): string | null {
  const videoId = extractYouTubeId(url)
  if (!videoId) return null
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function isCloudinaryUrl(url: string): boolean {
  return /res\.cloudinary\.com/i.test(url)
}
