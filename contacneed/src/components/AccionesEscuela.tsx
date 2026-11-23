import { useMutation } from '@tanstack/react-query'
import { abrirSoporte } from '../lib/abrir-soporte'
import { PRECIO_RECUPERACION_MXN } from '../lib/cursos-educativos'
import { solicitarInteresEscuelaFn } from '../server/cursos-educativos.functions'

type AccionesEscuelaProps = {
  slug: string
  titulo: string
  sesionId?: string
  loggedIn: boolean
}

function preguntaInformes(titulo: string) {
  return `Pido informes concretos de «${titulo}». ¿De qué trata, cuánto cuesta la recuperación (${PRECIO_RECUPERACION_MXN} MXN), si ya se impartió o está programado, y cómo me inscribo o lo veo en ContacNeed?`
}

function preguntaInscripcion(titulo: string) {
  return `Quiero inscribirme a «${titulo}». Recuperación de cursos ya dados: ${PRECIO_RECUPERACION_MXN} MXN. ¿Qué fechas en vivo hay, qué cuota aplica y cómo reservo?`
}

export function AccionesEscuela({ slug, titulo, sesionId, loggedIn }: AccionesEscuelaProps) {
  const mutation = useMutation({
    mutationFn: (interes: 'informes' | 'inscripcion') =>
      solicitarInteresEscuelaFn({ data: { slug, sesionId, interes } }),
    onSuccess: (result) => abrirSoporte(result.pregunta),
    onError: (error, interes) => {
      const text = error instanceof Error ? error.message : ''
      // Nunca bloquear con alert vacío: la IA responde con hechos del catálogo.
      abrirSoporte(
        interes === 'inscripcion' ? preguntaInscripcion(titulo) : preguntaInformes(titulo),
      )
      if (loggedIn && text && !/sesión|login|iniciar/i.test(text)) {
        console.warn('escuela interes:', text)
      }
    },
  })

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => {
          if (!loggedIn) {
            abrirSoporte(preguntaInformes(titulo))
            return
          }
          mutation.mutate('informes')
        }}
        className="rounded-xl border border-sky-400/40 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-500/10 disabled:opacity-50"
      >
        {mutation.isPending ? 'Enviando...' : 'Pedir informes'}
      </button>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => {
          if (!loggedIn) {
            abrirSoporte(
              `${preguntaInscripcion(titulo)} Necesito iniciar sesión en ContacNeed para dejar mi solicitud al docente.`,
            )
            return
          }
          mutation.mutate('inscripcion')
        }}
        className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
      >
        Quiero inscribirme
      </button>
    </div>
  )
}
