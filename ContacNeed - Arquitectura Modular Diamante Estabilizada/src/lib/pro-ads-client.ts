import { fetchActiveAds } from './ads-client'

type ProProfile = {
  id: string
  nombre?: string | null
  descripcion_profesion?: string | null
  estado?: string | null
  es_pro?: boolean | null
  verificado?: boolean | null
  avatar_url?: string | null
  titulo?: string
  cuerpo?: string | null
  imagen_url?: string | null
  enlace_url?: string | null
}

function getPublicSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return null
  return { url, key }
}

async function fetchProProfilesFromDb(): Promise<ProProfile[]> {
  const config = getPublicSupabaseConfig()
  if (!config) return []

  const path =
    'perfiles_pro_publicos?select=id,nombre,descripcion_profesion,estado,verificado,avatar_url,es_pro' +
    '&order=id.desc&limit=8'

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  })

  if (!response.ok) return []
  return (await response.json()) as ProProfile[]
}

export async function fetchProPanelItems(estado?: string): Promise<ProProfile[]> {
  const [ads, profiles] = await Promise.all([
    fetchActiveAds(estado, 'pro').catch(() => []),
    fetchProProfilesFromDb(),
  ])

  const adItems: ProProfile[] = ads.map((ad) => ({
    id: ad.id,
    nombre: ad.titulo,
    descripcion_profesion: ad.cuerpo,
    estado: ad.estado,
    imagen_url: ad.imagen_url,
    enlace_url: ad.enlace_url,
    es_pro: true,
    verificado: true,
  }))

  const profileItems = profiles.filter((p) => !estado || !p.estado || p.estado === estado)

  return [...adItems, ...profileItems].slice(0, 10)
}
