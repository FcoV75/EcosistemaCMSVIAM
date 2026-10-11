import { sendResendEmail } from './privilege-email'

type SendRecoveryEmailInput = {
  apiKey: string
  from: string
  to: string
  actionLink: string
}

/** Traduce errores de Resend/Supabase a mensajes claros en español. */
export function mapResendSendError(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('domain is not verified') ||
    normalized.includes('contacneed.com domain is not verified') ||
    (normalized.includes('validation_error') && normalized.includes('domain'))
  ) {
    return 'El dominio contacneed.com aún no está verificado en Resend. Entra a https://resend.com/domains, agrega contacneed.com, configura los DNS (SPF/DKIM) y espera a que diga Verified. Luego usa RESEND_FROM como: ContacNeed <noreply@contacneed.com>.'
  }

  if (normalized.includes('from') && (normalized.includes('not allowed') || normalized.includes('invalid'))) {
    return 'RESEND_FROM no es válido. Usa un correo del dominio verificado, por ejemplo: ContacNeed <noreply@contacneed.com>.'
  }

  if (normalized.includes('api key') || normalized.includes('unauthorized') || normalized.includes('"statuscode":401')) {
    return 'RESEND_API_KEY inválida o faltante en Netlify. Revisa Environment variables.'
  }

  return message
}

export function mapRecoveryEmailError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('error sending recovery email')) {
    return 'No se pudo enviar el correo de recuperación. Configura SMTP en Supabase (Authentication → SMTP) o agrega RESEND_API_KEY en Netlify.'
  }

  if (normalized.includes('redirect_to') && normalized.includes('not allowed')) {
    return 'La URL de recuperación no está autorizada en Supabase. Agrega https://contacneed.com/auth/reset y https://contacneed.com/auth/confirm en Authentication → URL Configuration → Redirect URLs.'
  }

  if (normalized.includes('rate limit')) {
    return 'Límite de correos alcanzados. Espera unos minutos e inténtalo de nuevo.'
  }

  return mapResendSendError(message)
}

/** Errores que no deben revelar si el correo existe. */
export function isSoftRecoveryLookupError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('user not found') ||
    normalized.includes('unable to find') ||
    normalized.includes('no user found') ||
    normalized.includes('user does not exist') ||
    (normalized.includes('email') && normalized.includes('not found'))
  )
}

export async function sendRecoveryEmailViaResend(input: SendRecoveryEmailInput) {
  return sendResendEmail({
    apiKey: input.apiKey,
    from: input.from,
    to: input.to,
    subject: 'Restablece tu contraseña en ContacNeed',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Recuperación de contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en ContacNeed.</p>
        <p>
          <a href="${input.actionLink}" style="display:inline-block;padding:12px 18px;background:#d4a017;color:#111;text-decoration:none;border-radius:8px;font-weight:700">
            Crear nueva contraseña
          </a>
        </p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <p style="color:#666;font-size:13px">El enlace expira en 24 horas.</p>
      </div>
    `,
  })
}
