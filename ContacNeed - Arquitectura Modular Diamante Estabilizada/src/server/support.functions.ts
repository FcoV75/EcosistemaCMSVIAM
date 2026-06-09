import { createServerFn } from '@tanstack/react-start'

const FAQ_ENTRIES: Record<string, string> = {
  registro:
    'Puedes registrarte gratis como Observador o como profesional. Ve a Iniciar sesión y completa tu perfil con oficio, profesión o especialidad.',
  pro: 'ContacNeed PRO desbloquea tienda personalizada, más publicaciones multimedia y mayor visibilidad local. Usa el botón "Subir de nivel" para pagar con Stripe.',
  publicar:
    'En la Pizarra de Servicios escribe tu contenido, adjunta imagen o enlace de YouTube, y pulsa Publicar. Los videos de YouTube se convierten automáticamente a formato embed.',
  estados:
    'Usa el selector de los 32 estados de México en la barra superior para filtrar publicaciones y profesionales por ubicación.',
  soporte:
    'Si tienes un problema técnico, describe tu error con pantallazo y correo de cuenta. El equipo revisará reportes marcados desde cada publicación.',
}

function matchFaq(question: string) {
  const normalized = question.toLowerCase()

  if (normalized.includes('pro') || normalized.includes('pago') || normalized.includes('stripe')) {
    return FAQ_ENTRIES.pro
  }
  if (normalized.includes('estado') || normalized.includes('ubicacion') || normalized.includes('ubicación')) {
    return FAQ_ENTRIES.estados
  }
  if (normalized.includes('public') || normalized.includes('video') || normalized.includes('youtube')) {
    return FAQ_ENTRIES.publicar
  }
  if (normalized.includes('registr') || normalized.includes('cuenta')) {
    return FAQ_ENTRIES.registro
  }

  return FAQ_ENTRIES.soporte
}

export const askSupportBotFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { question: string }) => d)
  .handler(async ({ data }) => {
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
                      text: `Eres el bot de soporte de ContacNeed, red social de oficios en México. Responde en español, breve y útil. Pregunta: ${data.question}`,
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

    return { answer: matchFaq(data.question) }
  })
