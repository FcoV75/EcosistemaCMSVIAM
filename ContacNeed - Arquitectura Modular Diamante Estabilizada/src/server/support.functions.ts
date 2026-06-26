import { createServerFn } from '@tanstack/react-start'
import { askLlm } from '../lib/llm'
import { getServerProfile, getServerUser } from '../lib/auth'

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
    'Al entrar ves publicaciones de todos los estados. Usa el selector lateral "Filtrar por estado" para ver solo tu entidad.',
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

export const getPersonalizedGuideFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  const profile = user ? await getServerProfile(user.id) : null

  const context = user
    ? [
        `Nombre: ${profile?.nombre ?? 'Sin nombre'}`,
        `Estado: ${profile?.estado ?? 'Sin definir'}`,
        `Oficio: ${profile?.habilidad_empirica ?? 'Sin definir'}`,
        `PRO: ${profile?.es_pro ? 'sí' : 'no'}`,
        `Verificado: ${profile?.verificado ? 'sí' : 'no'}`,
      ].join('\n')
    : 'Visitante sin cuenta (puede explorar la pizarra y registrarse gratis).'

  const answer = await askLlm({
    system: `${SYSTEM_CONTEXT}

Eres la guía de bienvenida de ContacNeed. Da UN consejo personalizado y accionable (máximo 3 oraciones) para que el usuario aproveche la red según su situación. Menciona funciones concretas: pizarra, filtro por estado, publicar, perfil, tienda, PRO o registro. Tono cercano en español mexicano.`,
    user: `Perfil del usuario:\n${context}\n\n¿Qué debería hacer primero en ContacNeed?`,
    maxSentences: 3,
  })

  if (answer) return { tip: answer }

  if (!user) {
    return {
      tip: 'Explora la pizarra con "Todos los estados", filtra por tu entidad en el menú lateral y regístrate para publicar tu oficio.',
    }
  }

  if (!profile?.estado) {
    return {
      tip: 'Completa tu estado y oficio en Mi Perfil para que te encuentren al filtrar por tu región. Luego publica una foto de tu trabajo en la Pizarra.',
    }
  }

  if (!profile?.es_pro) {
    return {
      tip: `Ya estás en ${profile.estado}. Publica contenido visual en la Pizarra y configura tu tienda básica gratis en Mi Perfil. Cuando quieras más visibilidad, activa PRO.`,
    }
  }

  return {
    tip: 'Publica tu anuncio PRO desde el menú lateral, mantén tu tienda actualizada y responde comentarios para generar confianza local.',
  }
})

export const askSupportBotFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { question: string }) => d)
  .handler(async ({ data }) => {
    const question = data.question.trim()
    if (!question) return { answer: 'Escribe tu pregunta y te ayudo con ContacNeed.' }

    const answer = await askLlm({
      system: `${SYSTEM_CONTEXT}\n\nResponde en español, máximo 4 oraciones, tono cercano y profesional. Si no sabes algo, indica cómo contactar soporte.`,
      user: question,
      maxSentences: 4,
    })

    if (answer) return { answer }

    return { answer: matchFaq(question) }
  })
