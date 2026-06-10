function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

export const SUPABASE_PROJECT_URL = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')

export const SUPABASE_ANON_KEY = readEnv(
  'SUPABASE_ANON_KEY',
  'SUPABASE_KEY',
  'VITE_SUPABASE_ANON_KEY',
)

export function assertSupabaseConfigured() {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Faltan variables de Supabase. Configura SUPABASE_URL y SUPABASE_ANON_KEY en Netlify.',
    )
  }
}
