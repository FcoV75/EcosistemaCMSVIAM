export type DestinoAviso = {
  to: '/escuela' | '/escuela/$slug' | '/admin' | '/mensajes' | '/u/$userId' | '/avisos'
  params?: { slug: string } | { userId: string }
  label: string
}

export function destinoAvisoSeguro(enlace?: string | null): DestinoAviso | null {
  const raw = String(enlace || '').trim()
  if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) return null

  if (raw === '/avisos' || raw.startsWith('/avisos?')) {
    return { to: '/avisos', label: 'Ver avisos' }
  }
  if (raw === '/escuela' || raw.startsWith('/escuela?')) {
    return { to: '/escuela', label: 'Ir a la escuela' }
  }
  if (raw.startsWith('/escuela/')) {
    const slug = raw.slice('/escuela/'.length).split(/[?#]/)[0]
    if (slug && !slug.includes('/')) {
      return { to: '/escuela/$slug', params: { slug }, label: 'Abrir el curso' }
    }
  }
  if (raw === '/admin' || raw.startsWith('/admin?') || raw.startsWith('/admin#')) {
    return { to: '/admin', label: 'Abrir panel admin' }
  }
  if (raw === '/mensajes' || raw.startsWith('/mensajes/') || raw.startsWith('/mensajes?')) {
    return { to: '/mensajes', label: 'Abrir mensajes' }
  }
  if (raw.startsWith('/u/')) {
    const userId = raw.slice('/u/'.length).split(/[?#]/)[0]
    if (userId && !userId.includes('/')) {
      return { to: '/u/$userId', params: { userId }, label: 'Ver perfil' }
    }
  }
  return null
}
