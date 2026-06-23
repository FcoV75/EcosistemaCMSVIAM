import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'

function getSupabasePublicEnv() {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  const url = String(
    process.env.SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      viteEnv.VITE_SUPABASE_URL ??
      '',
  ).trim()

  const key = String(
    process.env.SUPABASE_ANON_KEY ??
      process.env.SUPABASE_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      viteEnv.VITE_SUPABASE_ANON_KEY ??
      '',
  ).trim()

  if (!url || !key) {
    throw new Error(
      'Faltan variables de Supabase. Configura SUPABASE_URL y SUPABASE_ANON_KEY en Netlify.',
    )
  }

  return { url, key }
}

function getSupabaseServiceEnv() {
  const viteEnv = import.meta.env as Record<string, string | undefined>

  const url = String(
    process.env.SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      viteEnv.VITE_SUPABASE_URL ??
      '',
  ).trim()

  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  if (!url || !serviceKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en Netlify. Sin ella no se guardan publicaciones, perfil ni tienda.',
    )
  }

  return { url, key: serviceKey }
}

export function createSupabaseAdminClient() {
  const { url, key } = getSupabaseServiceEnv()

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createSupabaseServerClient() {
  const { url, key } = getSupabasePublicEnv()

  return createServerClient(url, key, {
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
