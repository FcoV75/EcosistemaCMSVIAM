function storage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function storageGet(kind: 'local' | 'session', key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function storageSet(kind: 'local' | 'session', key: string, value: string) {
  try {
    storage(kind)?.setItem(key, value)
  } catch {
    /* Safari privado / ITP / cuota */
  }
}

export function storageRemove(kind: 'local' | 'session', key: string) {
  try {
    storage(kind)?.removeItem(key)
  } catch {
    /* ignore */
  }
}
