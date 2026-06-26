import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

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

    browserClient = createBrowserClient(url, key)
  }

  return browserClient
}

export function chatRoomId(userA: string, userB: string) {
  return [userA, userB].sort().join(':')
}
