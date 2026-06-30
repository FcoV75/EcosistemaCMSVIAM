import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireProUser } from '../lib/auth'
import { askLlm } from '../lib/llm'

const REPORT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

async function getSystemSenderId(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await supabase
    .from('perfiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function buildMarketContext(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  estado?: string | null,
  oficio?: string | null,
) {
  const [{ data: posts }, { data: profiles }] = await Promise.all([
    supabase
      .from('publicaciones')
      .select('contenido, estado')
      .order('fecha_creacion', { ascending: false })
      .limit(40),
    supabase
      .from('perfiles')
      .select('habilidad_empirica, estado')
      .not('habilidad_empirica', 'is', null)
      .limit(200),
  ])

  const oficios = new Map<string, number>()
  for (const row of profiles ?? []) {
    const key = row.habilidad_empirica?.trim() || 'Sin dato'
    oficios.set(key, (oficios.get(key) ?? 0) + 1)
  }

  const topOficios = [...oficios.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ')

  const samplePosts = (posts ?? [])
    .filter((p) => !estado || p.estado === estado)
    .slice(0, 8)
    .map((p) => (p.contenido ?? '').slice(0, 120))
    .filter(Boolean)
    .join(' | ')

  return [
    `Estado del profesional: ${estado ?? 'México'}`,
    `Oficio del profesional: ${oficio ?? 'general'}`,
    `Oficios más frecuentes en la red: ${topOficios || 'sin datos'}`,
    `Temas recientes en publicaciones: ${samplePosts || 'sin datos'}`,
  ].join('\n')
}

export const generateProMarketReportFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user, profile } = await requireProUser()
  const supabase = createSupabaseAdminClient()

  if (profile?.ultimo_informe_pro) {
    const elapsed = Date.now() - new Date(profile.ultimo_informe_pro).getTime()
    if (elapsed < REPORT_COOLDOWN_MS) {
      const daysLeft = Math.ceil((REPORT_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000))
      throw new Error(`Tu próximo informe PRO estará disponible en ${daysLeft} día(s).`)
    }
  }

  const context = await buildMarketContext(supabase, profile?.estado, profile?.habilidad_empirica)
  const report =
    (await askLlm({
      system:
        'Eres analista de mercado para ContacNeed (oficios en México). Redacta un informe breve, accionable y optimista en español mexicano.',
      user: `Genera un informe PRO con estas secciones numeradas:
1) Tendencias del mercado en su estado/oficio
2) Productos y servicios con mayor demanda
3) 3 ideas de campaña comercial para las próximas 2 semanas
4) Consejo de precios o promoción

Datos:\n${context}`,
      maxSentences: 20,
    })) ??
    `Informe PRO ContacNeed\n\n1) Tendencia: mayor actividad en servicios locales de ${profile?.estado ?? 'tu estado'}.\n2) Demanda: reparaciones, mantenimiento y trabajos visibles en portafolio.\n3) Campañas: publica antes/después, oferta de diagnóstico gratis y testimonios.\n4) Promoción: combina pizarra diaria + anuncio PRO con enlace directo a WhatsApp.`

  const senderId = await getSystemSenderId(supabase)
  if (!senderId) {
    throw new Error('No hay remitente del sistema configurado. Contacta al administrador.')
  }

  const { error: msgError } = await supabase.from('mensajes').insert({
    remitente_id: senderId,
    destinatario_id: user.id,
    asunto: 'Informe PRO · Tendencias y campañas',
    cuerpo: report,
    tipo: 'informe_pro',
    leido: false,
  })

  if (msgError) {
    if (msgError.message.includes('does not exist')) {
      throw new Error('Bandeja de mensajes en configuración. Ejecuta SQL 004 en Supabase.')
    }
    throw msgError
  }

  await supabase
    .from('perfiles')
    .update({ ultimo_informe_pro: new Date().toISOString() })
    .eq('id', user.id)

  return { success: true, preview: report.slice(0, 280) }
})
