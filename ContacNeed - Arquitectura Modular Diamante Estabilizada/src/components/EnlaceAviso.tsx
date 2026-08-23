import { Link } from '@tanstack/react-router'
import { destinoAvisoSeguro } from '../lib/avisos-enlaces'
import { useIdentity } from '../lib/identity-context'

export function EnlaceAviso({ enlace }: { enlace?: string | null }) {
  const { isAdmin } = useIdentity()
  const dest = destinoAvisoSeguro(enlace)
  if (!dest) return null

  if (dest.to === '/admin' && !isAdmin) {
    return (
      <p className="mt-2 text-xs text-amber-200/80">
        Este aviso es del panel del docente. El detalle ya está en el texto de arriba.
      </p>
    )
  }

  const className = 'mt-2 inline-flex text-xs font-semibold text-amber-300 hover:underline'

  if (dest.to === '/escuela/$slug' && dest.params && 'slug' in dest.params) {
    return (
      <Link to="/escuela/$slug" params={{ slug: dest.params.slug }} className={className}>
        {dest.label}
      </Link>
    )
  }
  if (dest.to === '/u/$userId' && dest.params && 'userId' in dest.params) {
    return (
      <Link to="/u/$userId" params={{ userId: dest.params.userId }} className={className}>
        {dest.label}
      </Link>
    )
  }
  if (dest.to === '/escuela') {
    return (
      <Link to="/escuela" className={className}>
        {dest.label}
      </Link>
    )
  }
  if (dest.to === '/admin') {
    return (
      <Link to="/admin" className={className}>
        {dest.label}
      </Link>
    )
  }
  if (dest.to === '/mensajes') {
    return (
      <Link to="/mensajes" className={className}>
        {dest.label}
      </Link>
    )
  }
  return (
    <Link to="/avisos" className={className}>
      {dest.label}
    </Link>
  )
}
