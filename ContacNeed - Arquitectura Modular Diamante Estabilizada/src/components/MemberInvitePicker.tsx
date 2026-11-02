import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { X } from 'lucide-react'
import { buscarMiembrosParaInvitarFn } from '../server/grupos-proyectos.functions'

type Persona = {
  id: string
  nombre?: string | null
  habilidad_empirica?: string | null
  estado?: string | null
  avatar_url?: string | null
}

type Props = {
  selected: Persona[]
  onChange: (next: Persona[]) => void
  label?: string
  excludeIds?: string[]
}

export function MemberInvitePicker({
  selected,
  onChange,
  label = 'Invitar miembros (opcional)',
  excludeIds = [],
}: Props) {
  const [q, setQ] = useState('')
  const exclude = new Set([...excludeIds, ...selected.map((p) => p.id)])

  const busqueda = useQuery({
    queryKey: ['invitar-busqueda-picker', q],
    queryFn: () => buscarMiembrosParaInvitarFn({ data: { q } }),
    enabled: q.trim().length >= 2,
  })

  const results = (busqueda.data?.items || []).filter((p: Persona) => !exclude.has(p.id))

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="mb-1 block text-sm text-purple-200/80">{label}</span>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <li
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100"
            >
              <span className="max-w-[10rem] truncate">{p.nombre || 'Usuario'}</span>
              <button
                type="button"
                aria-label={`Quitar a ${p.nombre || 'usuario'}`}
                className="rounded-full p-0.5 hover:bg-amber-500/20"
                onClick={() => onChange(selected.filter((s) => s.id !== p.id))}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, oficio o correo…"
        className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2 text-sm text-white"
      />
      {q.trim().length >= 2 && (
        <ul className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
          {busqueda.isFetching && (
            <li className="px-2 py-1 text-xs text-purple-200/50">Buscando…</li>
          )}
          {!busqueda.isFetching && results.length === 0 && (
            <li className="px-2 py-1 text-xs text-purple-200/50">Sin resultados</li>
          )}
          {results.map((p: Persona) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-white hover:bg-white/10"
                onClick={() => {
                  onChange([...selected, p])
                  setQ('')
                }}
              >
                <span>
                  <span className="font-medium">{p.nombre || 'Sin nombre'}</span>
                  {p.habilidad_empirica && (
                    <span className="ml-2 text-xs text-purple-200/55">{p.habilidad_empirica}</span>
                  )}
                </span>
                <span className="text-[10px] font-bold uppercase text-amber-300">+ Añadir</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-purple-200/45">
        Recibirán una invitación en Avisos. Puedes invitar más personas después desde el chat del
        grupo.
      </p>
    </div>
  )
}
