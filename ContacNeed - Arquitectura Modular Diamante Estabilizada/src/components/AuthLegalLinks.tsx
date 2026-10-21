import { Link } from '@tanstack/react-router'

/** Pie legal visible en login/registro (requerido por Google OAuth branding). */
export function AuthLegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed text-purple-300/55 ${className}`}>
      Al continuar aceptas las{' '}
      <Link to="/terminos" className="text-amber-300/90 hover:underline">
        Condiciones de servicio
      </Link>{' '}
      y la{' '}
      <Link to="/privacidad" className="text-amber-300/90 hover:underline">
        Política de privacidad
      </Link>
      .
    </p>
  )
}
