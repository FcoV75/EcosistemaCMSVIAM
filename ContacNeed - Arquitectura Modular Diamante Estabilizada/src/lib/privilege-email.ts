import { getSiteUrl } from './site-url'

type ResendBase = {
  apiKey: string
  from: string
  to: string
}

export async function sendResendEmail(input: ResendBase & { subject: string; html: string }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
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

export type PrivilegeEmailInput = ResendBase & {
  nombre?: string | null
  codigoCms: string
  privilegios: string[]
}

/** Aviso unificado de privilegios + código CMS del ecosistema. */
export async function sendPrivilegeEmailViaResend(input: PrivilegeEmailInput) {
  const site = getSiteUrl()
  const loginUrl = `${site}/login`
  const ecosistemaUrl = 'https://centromultidisciplinarioags.com/mi-ecosistema'
  const nombre = input.nombre?.trim() || 'profesional ContacNeed'
  const lista = input.privilegios.map((p) => `<li style="margin:0 0 6px">${p}</li>`).join('')

  return sendResendEmail({
    apiKey: input.apiKey,
    from: input.from,
    to: input.to,
    subject: `Tus accesos ContacNeed / Ecosistema VIAM — código ${input.codigoCms}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;max-width:560px">
        <h2 style="margin:0 0 12px;color:#111">Accesos activados</h2>
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Se activaron privilegios en tu cuenta del ecosistema ContacNeed / VIAM:</p>
        <ul style="padding-left:18px;margin:12px 0">${lista}</ul>
        <p style="margin:18px 0 8px"><strong>Tu código unificado del ecosistema:</strong></p>
        <p style="font-size:22px;font-weight:800;letter-spacing:1px;background:#111;color:#f5d76e;display:inline-block;padding:10px 16px;border-radius:10px;margin:0">
          ${input.codigoCms}
        </p>
        <p style="margin:18px 0 8px">Úsalo con la misma cuenta ContacNeed:</p>
        <p>
          <a href="${loginUrl}" style="display:inline-block;padding:12px 18px;background:#d4a017;color:#111;text-decoration:none;border-radius:8px;font-weight:700;margin-right:8px">
            Entrar a ContacNeed
          </a>
          <a href="${ecosistemaUrl}" style="display:inline-block;padding:12px 18px;background:#1e293b;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
            Mi Ecosistema
          </a>
        </p>
        <p style="color:#555;font-size:13px;margin-top:20px">
          Guarda este correo. El código te sirve para ContacNeed PRO, Sincronía Nexus, Video Diamante y el Curso de Promotores según lo que te hayan otorgado.
        </p>
      </div>
    `,
  })
}

export async function sendSignupConfirmEmailViaResend(
  input: ResendBase & { actionLink: string; nombre?: string | null },
) {
  const nombre = input.nombre?.trim() || 'nuevo miembro'
  return sendResendEmail({
    apiKey: input.apiKey,
    from: input.from,
    to: input.to,
    subject: 'Confirma tu correo en ContacNeed',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Bienvenido/a a ContacNeed</h2>
        <p>Hola <strong>${nombre}</strong>, confirma tu correo para activar tu cuenta.</p>
        <p>
          <a href="${input.actionLink}" style="display:inline-block;padding:12px 18px;background:#d4a017;color:#111;text-decoration:none;border-radius:8px;font-weight:700">
            Confirmar mi correo
          </a>
        </p>
        <p style="color:#666;font-size:13px">
          En la página pulsa el botón <strong>Confirmar mi correo</strong>. El enlace caduca; si falla, pide uno nuevo desde esa misma pantalla.
        </p>
        <p style="color:#666;font-size:13px">Si no creaste esta cuenta, ignora este mensaje.</p>
      </div>
    `,
  })
}

export function getResendConfig() {
  const apiKey = String(process.env.RESEND_API_KEY ?? '').trim()
  const from = String(process.env.RESEND_FROM ?? 'ContacNeed <noreply@contacneed.com>').trim()
  return { apiKey, from, enabled: Boolean(apiKey) }
}
