type ProProfile = {
  id: string
  nombre?: string | null
  descripcion_profesion?: string | null
  estado?: string | null
  es_pro?: boolean | null
  verificado?: boolean | null
}

function getPublicSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return null
  return { url, key }
}

export async function fetchProProfiles(): Promise<ProProfile[]> {
  const config = getPublicSupabaseConfig()
  if (!config) return []

  const path =
    'perfiles?select=id,nombre,descripcion_profesion,estado,es_pro,verificado' +
    '&es_pro=eq.true&order=fecha_registro.desc&limit=8'

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  })

  if (!response.ok) return []
  return (await response.json()) as ProProfile[]
}
