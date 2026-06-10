import { mapPublicacionToPost } from './posts-mapper'

type PublicacionRow = {
  id: string
  contenido?: string | null
  url_multimedia?: string | null
  estado?: string | null
  estatus?: string | null
  fecha_creacion?: string | null
  usuario_id?: string | null
}

type PerfilRow = {
  id: string
  nombre?: string | null
  habilidad_empirica?: string | null
  descripcion_profesion?: string | null
  verificado?: boolean | null
  es_fundador?: boolean | null
}

function getPublicSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (!url || !key) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Netlify. Agrégalas y vuelve a desplegar.',
    )
  }

  return { url, key }
}

async function supabaseRest<T>(path: string): Promise<T> {
  const { url, key } = getPublicSupabaseConfig()

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Supabase respondió ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function attachProfiles(posts: PublicacionRow[]) {
  const userIds = [...new Set(posts.map((post) => post.usuario_id).filter(Boolean))] as string[]
  if (userIds.length === 0) return posts.map((post) => ({ ...post, perfiles: null }))

  try {
    const ids = userIds.map((id) => `"${id}"`).join(',')
    const profiles = await supabaseRest<PerfilRow[]>(
      `perfiles?select=id,nombre,habilidad_empirica,descripcion_profesion,verificado,es_fundador&id=in.(${ids})`,
    )
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

    return posts.map((post) => ({
      ...post,
      perfiles: post.usuario_id ? profileById.get(post.usuario_id) ?? null : null,
    }))
  } catch {
    return posts.map((post) => ({ ...post, perfiles: null }))
  }
}

export async function fetchPublicPosts(estado?: string) {
  let path =
    'publicaciones?select=id,contenido,url_multimedia,estado,estatus,fecha_creacion,usuario_id' +
    '&or=(estatus.eq.aprobado,estatus.is.null)' +
    '&order=fecha_creacion.desc'

  if (estado?.trim()) {
    path += `&estado=eq.${encodeURIComponent(estado.trim())}`
  }

  const posts = await supabaseRest<PublicacionRow[]>(path)
  const withProfiles = await attachProfiles(posts ?? [])

  return withProfiles.map((post) =>
    mapPublicacionToPost({
      ...post,
      fecha_creacion: post.fecha_creacion ? new Date(post.fecha_creacion) : null,
      perfiles: post.perfiles
        ? {
            nombre: post.perfiles.nombre,
            habilidad_empirica: post.perfiles.habilidad_empirica,
            descripcion_profesion: post.perfiles.descripcion_profesion,
            verificado: post.perfiles.verificado,
            es_fundador: post.perfiles.es_fundador,
          }
        : null,
    }),
  )
}
