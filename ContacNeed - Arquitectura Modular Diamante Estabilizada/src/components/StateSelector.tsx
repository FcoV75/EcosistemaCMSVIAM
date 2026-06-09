import { MapPin, Search } from 'lucide-react'
import { DEFAULT_STATE, MEXICO_STATES, type MexicoState } from '../lib/mexico-states'

type StateSelectorProps = {
  value: MexicoState | ''
  onChange: (state: MexicoState | '') => void
}

export function StateSelector({ value, onChange }: StateSelectorProps) {
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
        <span className="text-xs text-gray-500">Sugerido: {DEFAULT_STATE}</span>
      )}
    </div>
  )
}
