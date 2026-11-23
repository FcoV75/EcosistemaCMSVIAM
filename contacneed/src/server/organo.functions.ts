import { createServerFn } from '@tanstack/react-start'
import { askLlm } from '../lib/llm'
import { getServerUser } from '../lib/auth'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { resolveAvatarUrl } from '../lib/default-avatar'
import { parecePedidoEncuentro } from '../lib/organo-contratos'

export type CandidatoEncuentro = {
  id: string
  nombre: string
  estado: string | null
  municipio: string | null
  oficio: string | null
  verificado: boolean
  avatar_url: string | null
}

function extraerOficio(question: string) {
  const limpio = question
    .replace(/\b(necesito|busco|quiero|un|una|el|la|de|en|por|favor|quien|quién|hace|ofrece)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpio.slice(0, 80) || question.slice(0, 80)
}

export const proponerEncuentroFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { necesidad: string; estado?: string }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    const necesidad = data.necesidad.trim()
    if (necesidad.length < 3) {
      return {
        ok: false as const,
        veto: 'presentar_contacto' as const,
        ejecutado: false as const,
        mensaje: 'Describe qué oficio o ayuda buscas. El órgano no adivina a quién presentar.',
        candidatos: [] as CandidatoEncuentro[],
      }
    }

    if (!parecePedidoEncuentro(necesidad)) {
      return {
        ok: true as const,
        veto: 'presentar_contacto' as const,
        ejecutado: false as const,
        mensaje:
          'No detecté un pedido de encuentro. Prueba “necesito un fisioterapeuta en Aguascalientes”. Nadie recibirá mensaje hasta que tú lo confirmes.',
        candidatos: [] as CandidatoEncuentro[],
      }
    }

    const q = extraerOficio(necesidad).toLowerCase()
    const supabase = createSupabaseAdminClient()
    let query = supabase
      .from('perfiles')
      .select(
        'id, nombre, estado, municipio, habilidad_empirica, descripcion_profesion, avatar_url, verificado, bloqueado',
      )
      .eq('bloqueado', false)
      .order('nombre', { ascending: true })
      .limit(400)

    const estado = data.estado?.trim()
    if (estado) query = query.eq('estado', estado)

    const { data: rows, error } = await query
    if (error) throw new Error(error.message)

    const candidatos: CandidatoEncuentro[] = (rows ?? [])
      .filter((row) => row.id !== user?.id)
      .filter((row) => {
        const haystack = [row.nombre, row.habilidad_empirica, row.descripcion_profesion, row.estado, row.municipio]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q) || q.split(' ').filter((w) => w.length > 3).some((w) => haystack.includes(w))
      })
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        nombre: row.nombre ?? 'Profesional',
        estado: row.estado,
        municipio: row.municipio,
        oficio: row.habilidad_empirica,
        verificado: Boolean(row.verificado),
        avatar_url: resolveAvatarUrl(row.avatar_url, row.id, row.nombre),
      }))

    return {
      ok: true as const,
      veto: 'presentar_contacto' as const,
      ejecutado: false as const,
      mensaje: candidatos.length
        ? 'Propuesta de encuentro. El órgano no enviará solicitud ni mensaje. Abre el perfil y decide tú.'
        : 'No encontré perfiles con esa necesidad. Prueba otro oficio o quita el filtro de estado. Nadie fue contactado.',
      candidatos,
    }
  })

export const orientarOrganoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { question: string }) => d)
  .handler(async ({ data }) => {
    const question = data.question.trim()
    if (!question) {
      return {
        answer: 'Habla o escribe qué oficio necesitas. El faro se enciende solo con tu permiso.',
        encuentro: false,
      }
    }

    const answer = await askLlm({
      system: `Eres el skill de encuentro de Sincronía Nexus dentro de ContacNeed.
Nunca presentas personas, nunca mandas mensajes, nunca pides cámara.
Si el usuario busca un oficio, dile que vas a proponer perfiles y que el veto humano decide.
Máximo 3 oraciones, español mexicano, cálido y concreto.`,
      user: question,
      maxSentences: 3,
    })

    return {
      answer:
        answer ||
        'Puedo proponerte perfiles de la red. No enviaré ninguna solicitud hasta que tú lo confirmes en su ficha.',
      encuentro: parecePedidoEncuentro(question),
    }
  })
