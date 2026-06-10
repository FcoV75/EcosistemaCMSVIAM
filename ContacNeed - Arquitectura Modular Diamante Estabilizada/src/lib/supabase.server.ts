import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import { SUPABASE_ANON_KEY, SUPABASE_PROJECT_URL } from './supabase-config'

export function createSupabaseServerClient() {
  const supabaseUrl = SUPABASE_PROJECT_URL
  const supabaseKey = SUPABASE_ANON_KEY

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          setCookie(name, value, options)
        })
      },
    },
  })
}
