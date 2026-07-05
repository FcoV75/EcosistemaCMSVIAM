import { useMutation } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { useIdentity } from '../lib/identity-context'
import { calificarPerfilFn } from '../server/gamificacion.functions'

type ProfileRatingProps = {
  userId: string
  promedio?: number | null
  total?: number
}

export function ProfileRating({ userId, promedio, total }: ProfileRatingProps) {
  const { user } = useIdentity()
  const [estrellas, setEstrellas] = useState(5)
  const [conducta, setConducta] = useState<'eficiente' | 'ineficiente' | 'neutral'>('eficiente')
  const [localPromedio, setLocalPromedio] = useState(promedio)
  const [localTotal, setLocalTotal] = useState(total ?? 0)

  const mutation = useMutation({
    mutationFn: () =>
      calificarPerfilFn({
        data: { calificadoId: userId, estrellas, conducta },
      }),
    onSuccess: (result) => {
      setLocalPromedio(result.promedio)
      setLocalTotal(result.total)
      alert('¡Gracias! Tu calificación ayuda a la comunidad.')
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'No se pudo calificar'),
  })

  if (!user || user.id === userId) {
    return (
      <div className="rounded-xl border border-purple-500/20 bg-slate-900/50 p-4">
        <p className="text-sm text-purple-200/80">
          Reputación:{' '}
          <strong className="text-amber-300">
            {localPromedio ? `${localPromedio.toFixed(1)} ★` : 'Sin calificaciones aún'}
          </strong>
          {localTotal ? ` (${localTotal} valoraciones)` : null}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-purple-500/20 bg-slate-900/50 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-200">Califica a este profesional</p>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEstrellas(n)}
            className={n <= estrellas ? 'text-amber-400' : 'text-slate-600'}
          >
            <Star size={22} fill={n <= estrellas ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(['eficiente', 'neutral', 'ineficiente'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setConducta(c)}
            className={`rounded-lg px-2 py-1 font-semibold ${
              conducta === c ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {c === 'eficiente' ? 'Eficiente' : c === 'ineficiente' ? 'Ineficiente' : 'Neutral'}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
      >
        {mutation.isPending ? 'Enviando...' : 'Enviar calificación'}
      </button>
    </div>
  )
}
