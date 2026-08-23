import { createServerFn } from '@tanstack/react-start'
import { askLlm } from '../lib/llm'
import { getServerProfile, getServerUser } from '../lib/auth'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { type SesionViva } from '../lib/cursos-educativos'
import { esPreguntaEscuela, hechosDesdeCatalogo, redactarInformeEscuela } from '../lib/informes-escuela'

async function cargarHechosEscuela() {
  try {
    const supabase = createSupabaseAdminClient()
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('metadata')
      .eq('producto', 'escuela_agenda')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    const sesiones = ((data?.metadata as { sesiones?: SesionViva[] } | null)?.sesiones || []).filter(Boolean)
    return hechosDesdeCatalogo(sesiones)
  } catch {
    return hechosDesdeCatalogo([])
  }
}

const SYSTEM_CONTEXT = `ContacNeed es una red social mexicana que conecta oficios, profesiones y especialidades por estado.
Funciones clave: Pizarra de publicaciones, filtro por 32 estados, Radio IA VIAM, membresía PRO (Stripe o PayPal: $300 MXN/mes, $3,000 MXN/año), registro con oficio/profesión/especialidad, perfil verificado, panel admin solo tras login con is_admin, órgano de encuentro (voz con faro; nunca presenta personas sin veto humano).
Escuela de principios vitalicios (/escuela): educación contínua de vida y salud física y mental. Cursos ya impartidos: «El cuerpo escucha» y «Léete y lee». Recuperación: 200 MXN (no es ContacNeed PRO). Las sesiones en vivo tienen su propia cuota y Zoom solo si el docente los publicó. NUNCA inventes precios, fechas, cupos ni ligas de Zoom. Si no están en los hechos, di que no están publicados. No sustituye médico ni psicoterapia.
Cloudinary sube fotos/videos con preset contacneed_uploads. Soporte técnico: pedir correo, navegador y captura del error.`

const PIZARRA_SKILL = `Cuando pidan qué publicar, ideas de contenido o cómo usar la pizarra, da sugerencias PRÁCTICAS según su oficio/profesión/especialidad:
- Foto propia: antes/después, producto en uso, herramienta, resultado, local o equipo.
- YouTube: tutorial corto, testimonio, recorrido del taller, demo de 1 minuto; pegar el enlace en la publicación.
- Material propio: cotización de ejemplo (sin datos privados), catálogo, certificado, ficha técnica, horario.
Cada idea debe incluir: qué mostrar, un texto corto listo para copiar, y por qué convence en su zona. No hables solo de colores.`

const FAQ_ENTRIES: Record<string, string> = {
  registro:
    'Regístrate en /registro: nombre, email, contraseña, dirección, CP, celular, estado, municipio y tu oficio/profesión/especialidad. La cédula solo aplica a profesionales o especialistas.',
  pro: 'ContacNeed PRO ($300 MXN/mes o $3,000 MXN/año) desbloquea tienda personalizada y mayor visibilidad. Paga con Stripe en "Subir de nivel" o PayPal: paypal.me/JValdezOsorio/300.00MXN (mensual) y /3000.00MXN (anual).',
  publicar:
    'En la Pizarra escribe tu mensaje, adjunta foto/video desde la galería o pega enlace de YouTube. Publica lo de tu oficio: un trabajo reciente, un demo en YouTube o material propio (catálogo, certificado). El botón "Qué publicar" te da ideas concretas.',
  estados:
    'Al entrar ves publicaciones de todos los estados. Usa el selector lateral "Filtrar por estado" para ver solo tu entidad.',
  cloudinary:
    'Si falla la subida de imagen, verifica conexión y vuelve a intentar. El preset correcto es contacneed_uploads en Cloudinary dgkruw6n7.',
  soporte:
    'Para ayuda humana, envía tu correo de cuenta, descripción del problema y captura de pantalla al equipo de ContacNeed.',
  escuela:
    'La Escuela de principios vitalicios está en /escuela. Cursos ya dados: El cuerpo escucha y Léete y lee (200 MXN de recuperación para ver y descargar). Las próximas fechas en vivo muestran el TÍTULO del curso, día, hora y modalidad. Pulsa «Pedir informes» o «Quiero inscribirme»: la IA te orienta y el docente recibe tu solicitud. Nada de esto sustituye al médico ni al psicoterapeuta.',
}

function matchFaq(question: string) {
  const normalized = question.toLowerCase()

  if (esPreguntaEscuela(question)) {
    return redactarInformeEscuela(hechosDesdeCatalogo([]), question)
  }
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
  if (
    normalized.includes('public') ||
    normalized.includes('video') ||
    normalized.includes('youtube') ||
    normalized.includes('pizarra') ||
    normalized.includes('foto') ||
    normalized.includes('contenido')
  ) {
    return FAQ_ENTRIES.publicar
  }
  if (normalized.includes('registr') || normalized.includes('cuenta') || normalized.includes('login')) {
    return FAQ_ENTRIES.registro
  }

  return FAQ_ENTRIES.soporte
}

function profileLines(profile: Awaited<ReturnType<typeof getServerProfile>>, user: Awaited<ReturnType<typeof getServerUser>>) {
  if (!user) return 'Visitante sin cuenta (puede explorar la pizarra y registrarse gratis).'
  return [
    `Nombre: ${profile?.nombre ?? 'Sin nombre'}`,
    `Estado: ${profile?.estado ?? 'Sin definir'}`,
    `Municipio: ${profile?.municipio ?? 'Sin definir'}`,
    `Oficio/profesión/especialidad: ${profile?.habilidad_empirica ?? 'Sin definir'}`,
    `Descripción: ${profile?.descripcion_profesion ?? 'Sin definir'}`,
    `PRO: ${profile?.es_pro ? 'sí' : 'no'}`,
    `Verificado: ${profile?.verificado ? 'sí' : 'no'}`,
  ].join('\n')
}

function fallbackPostIdeas(oficio: string, estado: string) {
  const rubro = oficio.trim() || 'tu oficio'
  const zona = estado.trim() || 'tu estado'
  return [
    `Foto de un trabajo reciente de ${rubro} en ${zona}: muestra el resultado y escribe «¿Alguien necesita esto esta semana? Cotización sin compromiso».`,
    `Video corto de YouTube (1–3 min) haciendo el proceso de ${rubro}. Pega el enlace y en el texto explica qué van a ver y para quién es.`,
    `Material propio: sube una imagen de tu catálogo, certificado o herramienta y cuenta un caso real (sin datos privados) para generar confianza local.`,
  ]
}

export const getPersonalizedGuideFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  const profile = user ? await getServerProfile(user.id) : null

  const context = profileLines(profile, user)

  const answer = await askLlm({
    system: `${SYSTEM_CONTEXT}

Eres la guía de bienvenida de ContacNeed. Da UN consejo personalizado y accionable (máximo 3 oraciones) para que el usuario aproveche la red según su situación. Menciona funciones concretas: pizarra (fotos, YouTube o material propio de su oficio), filtro por estado, publicar, perfil, tienda, PRO o registro. Tono cercano en español mexicano.`,
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
      tip: `Ya estás en ${profile.estado}. Publica una foto o un YouTube de tu ${profile.habilidad_empirica || 'oficio'} en la Pizarra y configura tu tienda básica en Mi Perfil. Cuando quieras más visibilidad, activa PRO.`,
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

    const user = await getServerUser()
    const profile = user ? await getServerProfile(user.id) : null
    const context = profileLines(profile, user)

    if (esPreguntaEscuela(question)) {
      try {
        const hechos = await cargarHechosEscuela()
        return { answer: redactarInformeEscuela(hechos, question) }
      } catch {
        return { answer: redactarInformeEscuela(hechosDesdeCatalogo([]), question) }
      }
    }

    const answer = await askLlm({
      system: `${SYSTEM_CONTEXT}

${PIZARRA_SKILL}

Eres el asistente de la pizarra y soporte de ContacNeed. Responde en español mexicano, máximo 6 oraciones, tono cercano y profesional.
Si piden ideas de publicación, da 2 o 3 sugerencias concretas (foto, YouTube o material propio) según el oficio del perfil.
Nunca inventes precios de la Escuela, cuotas en vivo ni ligas de Zoom.
Si no sabes algo técnico, indica cómo contactar soporte.
Perfil actual:
${context}`,
      user: question,
      maxSentences: 6,
      maxTokens: 900,
    })

    if (answer) return { answer }

    return { answer: matchFaq(question) }
  })

export const sugerirPublicacionPizarraFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { pista?: string }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    const profile = user ? await getServerProfile(user.id) : null
    const oficio = profile?.habilidad_empirica?.trim() || ''
    const estado = profile?.estado?.trim() || ''
    const descripcion = profile?.descripcion_profesion?.trim() || ''
    const pista = (data.pista || '').trim()

    const answer = await askLlm({
      system: `Eres editor de contenido para la pizarra de ContacNeed. Devuelve SOLO JSON:
{"ideas":["...","...","..."]}
Tres ideas prácticas y distintas: 1) foto propia, 2) YouTube o video, 3) material propio del oficio.
Cada idea es 1 o 2 oraciones en español mexicano, listas para copiar o adaptar. Nada de paletas de color.`,
      user: `Oficio: ${oficio || 'sin oficio en perfil'}
Estado: ${estado || 'México'}
Descripción: ${descripcion || 'sin descripción'}
Pista del usuario: ${pista || 'quiere ideas para publicar hoy'}
¿Tiene cuenta?: ${user ? 'sí' : 'no'}`,
      maxSentences: 8,
      maxTokens: 700,
    })

    const fallback = fallbackPostIdeas(oficio, estado)
    if (!answer) return { ideas: fallback }

    const match = answer.match(/\{[\s\S]*\}/)
    if (!match) return { ideas: fallback }
    try {
      const parsed = JSON.parse(match[0]) as { ideas?: unknown }
      const ideas = Array.isArray(parsed.ideas)
        ? parsed.ideas.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
        : []
      return { ideas: ideas.length ? ideas : fallback }
    } catch {
      return { ideas: fallback }
    }
  })
