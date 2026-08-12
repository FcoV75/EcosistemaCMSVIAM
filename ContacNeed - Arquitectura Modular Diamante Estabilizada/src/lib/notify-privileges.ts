import { getResendConfig, sendPrivilegeEmailViaResend } from './privilege-email'
import { PRODUCTOS_MEMBRESIA, type PlanMembresia, type ProductoMembresia } from './membresias-viam'

export function etiquetaPrivilegioMembresia(producto: ProductoMembresia, plan: PlanMembresia) {
  const base = PRODUCTOS_MEMBRESIA[producto].etiqueta
  const planLabel =
    plan === 'propietario' ? 'Propietario / permanente' : plan === 'anual' ? 'Anual' : 'Mensual'
  return `${base} — ${planLabel}`
}

export async function notifyPrivilegeGrant(input: {
  email: string
  nombre?: string | null
  codigoCms: string
  privilegios: string[]
}) {
  const resend = getResendConfig()
  if (!resend.enabled) {
    return {
      emailed: false as const,
      warning:
        'Privilegio guardado, pero no hay RESEND_API_KEY: no se envió el correo con el código CMS.',
    }
  }

  const sent = await sendPrivilegeEmailViaResend({
    apiKey: resend.apiKey,
    from: resend.from,
    to: input.email,
    nombre: input.nombre,
    codigoCms: input.codigoCms,
    privilegios: input.privilegios,
  })

  if (!sent.ok) {
    return {
      emailed: false as const,
      warning: `Privilegio guardado, pero falló el correo: ${sent.error}`,
    }
  }

  return { emailed: true as const }
}
