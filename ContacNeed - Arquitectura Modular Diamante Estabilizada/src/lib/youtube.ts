const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i

export function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export function toYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.includes('youtube.com/embed/')) return url

  const videoId = extractYouTubeId(url)
  if (!videoId) return null

  return `https://www.youtube.com/embed/${videoId}`
}

export function isYouTubeUrl(url: string): boolean {
  return Boolean(extractYouTubeId(url) || url.includes('youtube.com/embed/'))
}

export function isCloudinaryUrl(url: string): boolean {
  return /res\.cloudinary\.com/i.test(url)
}
