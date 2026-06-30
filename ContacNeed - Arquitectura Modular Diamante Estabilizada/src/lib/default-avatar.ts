const FALLBACK_COLORS = ['7c3aed', 'c2410c', '0891b2', 'ca8a04', '059669']

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function isPlaceholderAvatarUrl(url?: string | null) {
  const value = url?.trim() ?? ''
  if (!value) return true
  return value.includes('pravatar.cc') || value.includes('ui-avatars.com/api')
}

export function getDefaultAvatarUrl(seed: string, name?: string | null) {
  const initial = (name?.trim()?.[0] ?? seed.replace(/-/g, '').slice(0, 1) ?? '?').toUpperCase()
  const color = FALLBACK_COLORS[hashString(seed) % FALLBACK_COLORS.length]
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=${color}&color=fff&size=128&bold=true`
}

export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  seed: string,
  name?: string | null,
) {
  const trimmed = avatarUrl?.trim()
  if (trimmed && !isPlaceholderAvatarUrl(trimmed)) return trimmed
  return getDefaultAvatarUrl(seed, name)
}
