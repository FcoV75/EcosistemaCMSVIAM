type SendRecoveryEmailInput = {
  apiKey: string
  from: string
  to: string
  actionLink: string
}

export function mapRecoveryEmailError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('error sending recovery email')) {
    return 'No se pudo enviar el correo de recuperación. Configura SMTP en Supabase (Authentication → SMTP) o agrega RESEND_API_KEY en Netlify.'
  }

  if (normalized.includes('redirect_to') && normalized.includes('not allowed')) {
    return 'La URL de recuperación no está autorizada en Supabase. Agrega https://contacneed.com/auth/reset en Authentication → URL Configuration → Redirect URLs.'
  }

  if (normalized.includes('rate limit')) {
    return 'Límite de correos alcanzado. Espera unos minutos e inténtalo de nuevo.'
  }

  return message
}

export async function sendRecoveryEmailViaResend(input: SendRecoveryEmailInput) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
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
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    return {
      ok: false as const,
      error: body || `Resend respondió con estado ${response.status}`,
    }
  }

  return { ok: true as const }
}
