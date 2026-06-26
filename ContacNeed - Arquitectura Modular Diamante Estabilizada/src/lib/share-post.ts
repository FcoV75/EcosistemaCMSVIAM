export function getPostShareUrl(postId: string) {
  if (typeof window === 'undefined') return `https://contacneed.com/?post=${postId}`
  return `${window.location.origin}/?post=${postId}`
}

export function buildSharePayload(postId: string, excerpt: string) {
  const url = getPostShareUrl(postId)
  const text = excerpt.trim() || 'Mira esta publicación en ContacNeed'
  return { url, text, full: `${text} ${url}` }
}

export const SHARE_CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: 'bg-emerald-600',
    buildUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: 'bg-blue-600',
    buildUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    color: 'bg-slate-800',
    buildUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: 'bg-sky-600',
    buildUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: 'bg-blue-700',
    buildUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
] as const
