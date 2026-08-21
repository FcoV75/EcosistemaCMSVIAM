/** Downscale Cloudinary images so iPhone Safari does not decode 12MP photos in the feed. */
export function toFeedImageUrl(url: string, width = 1080): string {
  if (!url) return url
  try {
    if (!/res\.cloudinary\.com/i.test(url) || !url.includes('/upload/')) return url
    if (url.includes('/video/upload/') || url.includes('/raw/upload/')) return url
    const marker = '/upload/'
    const idx = url.indexOf(marker)
    if (idx < 0) return url
    const after = url.slice(idx + marker.length)
    if (/(?:^|\/)(?:f_auto|q_auto|c_limit|w_\d+)/.test(after.split('/')[0] ?? '')) return url
    return `${url.slice(0, idx + marker.length)}f_auto,q_auto,c_limit,w_${width}/${after}`
  } catch {
    return url
  }
}

export function toFeedAvatarUrl(url: string) {
  return toFeedImageUrl(url, 128)
}
