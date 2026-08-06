import { getSupabaseBrowserSessionFn } from '../server/auth.functions'
import { CMS_VIAM_URL } from './promotores-viam'

/** Abre el curso en CMS VIAM con tokens de la sesión ContacNeed (mismo Supabase). */
export async function buildCursoPromotoresUrl(path = '/curso-promotores') {
  const session = await getSupabaseBrowserSessionFn()
  const url = new URL(path, CMS_VIAM_URL)
  if (session?.access_token && session?.refresh_token) {
    url.hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }).toString()
  }
  return url.toString()
}
