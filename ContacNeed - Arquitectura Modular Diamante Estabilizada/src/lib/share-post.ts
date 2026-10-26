export function getPostShareUrl(postId: string) {
  if (typeof window === 'undefined') return `https://contacneed.com/?post=${postId}`
  return `${window.location.origin}/?post=${postId}`
}

export function buildSharePayload(postId: string, excerpt: string) {
  const url = getPostShareUrl(postId)
  const text = excerpt.trim() || 'Mira esta publicación en ContacNeed'
  return { url, text, full: `${text}\n${url}` }
}

export type ShareChannel = {
  id: string
  label: string
  color: string
  /** Abre URL de compartir. Si falta, el modal copia el enlace y abre `openAfterCopy`. */
  buildUrl?: (url: string, text: string) => string
  /** Apps sin sharer web estable: copiar enlace y abrir la red. */
  openAfterCopy?: string
  hint?: string
}

export const SHARE_CHANNELS: ShareChannel[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: 'bg-emerald-600',
    buildUrl: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: 'bg-blue-600',
    buildUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'messenger',
    label: 'Messenger',
    color: 'bg-blue-500',
    buildUrl: (url) =>
      `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(url)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'bg-gradient-to-r from-purple-600 to-pink-500',
    openAfterCopy: 'https://www.instagram.com/',
    hint: 'Copiamos el enlace; pégalo en tu historia, bio o DM.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'bg-zinc-900',
    openAfterCopy: 'https://www.tiktok.com/',
    hint: 'Copiamos el enlace; pégalo en tu bio, comentario o descripción.',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    color: 'bg-slate-800',
    buildUrl: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'threads',
    label: 'Threads',
    color: 'bg-neutral-800',
    buildUrl: (url, text) =>
      `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: 'bg-sky-600',
    buildUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: 'bg-blue-700',
    buildUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'email',
    label: 'Correo',
    color: 'bg-amber-700',
    buildUrl: (url, text) =>
      `mailto:?subject=${encodeURIComponent('Te comparto esto en ContacNeed')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
  {
    id: 'sms',
    label: 'SMS',
    color: 'bg-violet-700',
    buildUrl: (url, text) => `sms:?&body=${encodeURIComponent(`${text}\n${url}`)}`,
  },
]
