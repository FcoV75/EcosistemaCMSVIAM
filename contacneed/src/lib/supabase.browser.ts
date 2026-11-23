import { createBrowserClient } from '@supabase/ssr'
import { storageGet, storageRemove, storageSet } from './safe-storage'

let browserClient: ReturnType<typeof createBrowserClient> | null = null
const memoryStore = new Map<string, string>()

const safariSafeAuthStorage = {
  getItem: (key: string) => {
    const cached = memoryStore.get(key)
    if (cached != null) return cached
    const stored = storageGet('local', key)
    if (stored != null) memoryStore.set(key, stored)
    return stored
  },
  setItem: (key: string, value: string) => {
    memoryStore.set(key, value)
    storageSet('local', key, value)
  },
  removeItem: (key: string) => {
    memoryStore.delete(key)
    storageRemove('local', key)
  },
}

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client solo está disponible en el cliente')
  }

  if (!browserClient) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
    }

    browserClient = createBrowserClient(url, key, {
      auth: {
        storage: safariSafeAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return browserClient
}

export function chatRoomId(userA: string, userB: string) {
  return [userA, userB].sort().join(':')
}
