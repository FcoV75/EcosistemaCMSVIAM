import { MapPin, Search } from 'lucide-react'
import { MEXICO_STATES, type MexicoState } from '../lib/mexico-states'

type StateSelectorProps = {
  value: MexicoState | ''
  onChange: (state: MexicoState | '') => void
  variant?: 'inline' | 'sidebar'
}

export function StateSelector({ value, onChange, variant = 'inline' }: StateSelectorProps) {
  if (variant === 'sidebar') {
    return (
      <div className="cn-glass rounded-2xl border border-purple-500/20 p-4">
        <label htmlFor="estado-filter" className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
          <MapPin size={16} className="text-amber-400" />
          Filtrar por estado
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-purple-300/50"
          />
          <select
            id="estado-filter"
            value={value}
            onChange={(event) => onChange(event.target.value as MexicoState | '')}
            className="w-full rounded-xl border border-purple-500/30 bg-slate-900/60 py-2.5 pl-9 pr-3 text-sm font-medium text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          >
            <option value="">Todos los estados</option>
            {MEXICO_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>
        {!value && (
          <p className="mt-2 text-[11px] text-purple-200/50">
            Vista general de México. Elige tu estado para ver contenido local.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor="estado-filter" className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <MapPin size={16} className="text-amber-600" />
        Filtrar por estado
      </label>
      <div className="relative flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <select
          id="estado-filter"
          value={value}
          onChange={(event) => onChange(event.target.value as MexicoState | '')}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-slate-800 focus:border-amber-500 focus:ring-amber-500"
        >
          <option value="">Todos los estados</option>
          {MEXICO_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      {!value && (
        <span className="text-xs text-gray-500">Vista general · elige tu estado para filtrar</span>
      )}
    </div>
  )
}
