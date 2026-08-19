import { createServerFn } from '@tanstack/react-start'
import { requireActiveUser } from '../lib/auth'
import { askLlm } from '../lib/llm'

export type ConsejoTienda = {
  titulo: string
  texto: string
}

export type IdeasTiendaResult = {
  ok: true
  remaining: number
  limit: number
  reused: boolean
  promocion: ConsejoTienda
  objecion: { objecion: string; respuesta: string }
}

const DAILY_LIMIT = 1
const dailyByUser = new Map<
  string,
  { day: string; count: number; last: Omit<IdeasTiendaResult, 'ok' | 'remaining' | 'limit' | 'reused'> }
>()

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function slotFor(userId: string) {
  const day = todayKey()
  const current = dailyByUser.get(userId)
  if (!current || current.day !== day) {
    const fresh = { day, count: 0, last: fallbackIdeas('oficio', '', '') }
    dailyByUser.set(userId, fresh)
    return fresh
  }
  return current
}

function fallbackIdeas(oficio: string, estado: string, extra: string): Omit<
  IdeasTiendaResult,
  'ok' | 'remaining' | 'limit' | 'reused'
> {
  const rubro = oficio.trim() || 'tu oficio'
  const lugar = estado.trim() || 'tu zona'
  const detalle = extra.trim()
  return {
    promocion: {
      titulo: 'Promoción y tienda esta semana',
      texto: `Sube a la tienda una foto clara de un trabajo reciente de ${rubro} (antes/después o el producto listo) y publícala también en la pizarra de ${lugar} con un llamado concreto: precio, rango o “cotización sin compromiso”. Actualiza el banner si ya tiene más de un mes: que se vea el resultado, no solo el logo.${detalle ? ` Enfócate en esto que comentaste: ${detalle.slice(0, 180)}.` : ''}`,
    },
    objecion: {
      objecion: '«Está caro» o «lo pienso y te aviso»',
      respuesta: `No bajes el precio de golpe. Explica qué incluye (material, tiempo, garantía o entrega) y ofrece una opción más chica o un anticipo. Pregunta qué les preocupa exactamente: tiempo, presupuesto o confianza. Cierra con una prueba visible: foto de un caso similar o un video corto de YouTube de tu proceso.`,
    },
  }
}

function parseIdeas(raw: string, oficio: string, estado: string, extra: string) {
  const fallback = fallbackIdeas(oficio, estado, extra)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return fallback
  try {
    const parsed = JSON.parse(match[0]) as {
      promocion?: { titulo?: string; texto?: string }
      objecion?: { objecion?: string; respuesta?: string }
    }
    return {
      promocion: {
        titulo: String(parsed.promocion?.titulo || fallback.promocion.titulo).slice(0, 80),
        texto: String(parsed.promocion?.texto || fallback.promocion.texto).slice(0, 700),
      },
      objecion: {
        objecion: String(parsed.objecion?.objecion || fallback.objecion.objecion).slice(0, 160),
        respuesta: String(parsed.objecion?.respuesta || fallback.objecion.respuesta).slice(0, 700),
      },
    }
  } catch {
    return fallback
  }
}

export const generarIdeasTiendaFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { prompt?: string }) => d)
  .handler(async ({ data }): Promise<IdeasTiendaResult> => {
    const { user, profile } = await requireActiveUser()
    const slot = slotFor(user.id)
    const remainingBefore = Math.max(0, DAILY_LIMIT - slot.count)

    if (remainingBefore <= 0 && slot.last) {
      return {
        ok: true,
        remaining: 0,
        limit: DAILY_LIMIT,
        reused: true,
        ...slot.last,
      }
    }

    const oficio = profile?.habilidad_empirica?.trim() || 'oficio o profesión'
    const estado = profile?.estado?.trim() || ''
    const descripcion = profile?.descripcion_profesion?.trim() || ''
    const extra = (data.prompt || '').trim()

    const answer = await askLlm({
      system: `Eres asesor comercial de ContacNeed (red mexicana de oficios). Devuelves SOLO JSON válido, sin markdown.
Formato:
{"promocion":{"titulo":"...","texto":"..."},"objecion":{"objecion":"...","respuesta":"..."}}
Reglas:
- Un consejo práctico para promocionar el producto/servicio Y actualizar la tienda (fotos, precios, banner, pizarra, YouTube o material propio).
- Una objeción de venta común de ESE rubro y cómo vencerla en español mexicano, cercano, sin relleno.
- Nada de paleta de colores genérica (azul/gris) salvo que el usuario lo pida.
- Cada texto: 2 a 4 oraciones, accionable hoy.`,
      user: `Oficio: ${oficio}
Estado: ${estado || 'México'}
Descripción del perfil: ${descripcion || 'sin descripción'}
Lo que el usuario quiere destacar: ${extra || 'no especificó; usa el oficio'}
PRO: ${profile?.es_pro ? 'sí' : 'no'}`,
      maxSentences: 12,
      maxTokens: 900,
    })

    const ideas = answer ? parseIdeas(answer, oficio, estado, extra) : fallbackIdeas(oficio, estado, extra)
    slot.count += 1
    slot.last = ideas
    dailyByUser.set(user.id, slot)

    return {
      ok: true,
      remaining: Math.max(0, DAILY_LIMIT - slot.count),
      limit: DAILY_LIMIT,
      reused: false,
      ...ideas,
    }
  })
