import { useMutation } from '@tanstack/react-query'
import { abrirSoporte } from '../lib/abrir-soporte'
import { solicitarInteresEscuelaFn } from '../server/cursos-educativos.functions'

type AccionesEscuelaProps = {
  slug: string
  titulo: string
  sesionId?: string
  loggedIn: boolean
}

export function AccionesEscuela({ slug, titulo, sesionId, loggedIn }: AccionesEscuelaProps) {
  const mutation = useMutation({
    mutationFn: (interes: 'informes' | 'inscripcion') =>
      solicitarInteresEscuelaFn({ data: { slug, sesionId, interes } }),
    onSuccess: (result) => abrirSoporte(result.pregunta),
    onError: (error) => {
      const text = error instanceof Error ? error.message : 'No se pudo registrar tu solicitud'
      if (!loggedIn || text.toLowerCase().includes('iniciar sesión')) {
        abrirSoporte(
          `Pido informes de «${titulo}». ¿De qué trata, cuándo se imparte y cómo me inscribo? Necesito iniciar sesión para dejar mi solicitud al docente.`,
        )
        return
      }
      alert(text)
    },
  })

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate('informes')}
        className="rounded-xl border border-sky-400/40 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-500/10 disabled:opacity-50"
      >
        {mutation.isPending ? 'Enviando...' : 'Pedir informes'}
      </button>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate('inscripcion')}
        className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
      >
        Quiero inscribirme
      </button>
    </div>
  )
}
