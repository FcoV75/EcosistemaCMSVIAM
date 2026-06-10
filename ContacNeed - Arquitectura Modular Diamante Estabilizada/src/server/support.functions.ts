import { createServerFn } from '@tanstack/react-start'

const SYSTEM_CONTEXT = `ContacNeed es una red social mexicana que conecta oficios, profesiones y especialidades por estado.
Funciones clave: Pizarra de publicaciones, filtro por 32 estados, Radio IA VIAM, membresía PRO (Stripe o PayPal: $300 MXN/mes, $3,000 MXN/año), registro con oficio/profesión/especialidad, perfil verificado, panel admin solo tras login con is_admin.
Cloudinary sube fotos/videos con preset contacneed_uploads. Soporte técnico: pedir correo, navegador y captura del error.`

const FAQ_ENTRIES: Record<string, string> = {
  registro:
    'Regístrate en /registro: nombre, email, contraseña, dirección, CP, celular, estado, municipio y tu oficio/profesión/especialidad. La cédula solo aplica a profesionales o especialistas.',
  pro: 'ContacNeed PRO ($300 MXN/mes o $3,000 MXN/año) desbloquea tienda personalizada y mayor visibilidad. Paga con Stripe en "Subir de nivel" o PayPal: paypal.me/JValdezOsorio/300.00MXN (mensual) y /3000.00MXN (anual).',
  publicar:
    'En la Pizarra escribe tu mensaje, adjunta foto/video desde la galería o pega enlace de YouTube. Los videos de YouTube se convierten a embed automáticamente.',
  estados:
    'Usa el selector de estado en la barra superior para ver publicaciones y profesionales de cada entidad de México.',
  cloudinary:
    'Si falla la subida de imagen, verifica conexión y vuelve a intentar. El preset correcto es contacneed_uploads en Cloudinary dgkruw6n7.',
  soporte:
    'Para ayuda humana, envía tu correo de cuenta, descripción del problema y captura de pantalla al equipo de ContacNeed.',
}

function matchFaq(question: string) {
  const normalized = question.toLowerCase()

  if (normalized.includes('cloudinary') || normalized.includes('upload') || normalized.includes('subir')) {
    return FAQ_ENTRIES.cloudinary
  }
  if (
    normalized.includes('pro') ||
    normalized.includes('pago') ||
    normalized.includes('stripe') ||
    normalized.includes('paypal')
  ) {
    return FAQ_ENTRIES.pro
  }
  if (normalized.includes('estado') || normalized.includes('ubicacion') || normalized.includes('ubicación')) {
    return FAQ_ENTRIES.estados
  }
  if (normalized.includes('public') || normalized.includes('video') || normalized.includes('youtube')) {
    return FAQ_ENTRIES.publicar
  }
  if (normalized.includes('registr') || normalized.includes('cuenta') || normalized.includes('login')) {
    return FAQ_ENTRIES.registro
  }

  return FAQ_ENTRIES.soporte
}

export const askSupportBotFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { question: string }) => d)
  .handler(async ({ data }) => {
    const question = data.question.trim()
    if (!question) return { answer: 'Escribe tu pregunta y te ayudo con ContacNeed.' }

    const apiKey = process.env.GEMINI_API_KEY

    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${SYSTEM_CONTEXT}\n\nResponde en español, máximo 4 oraciones, tono cercano y profesional. Si no sabes algo, indica cómo contactar soporte.\n\nUsuario: ${question}`,
                    },
                  ],
                },
              ],
            }),
          },
        )

        if (response.ok) {
          const payload = await response.json()
          const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) return { answer: String(text) }
        }
      } catch {
        // fallback local FAQ
      }
    }

    return { answer: matchFaq(question) }
  })
