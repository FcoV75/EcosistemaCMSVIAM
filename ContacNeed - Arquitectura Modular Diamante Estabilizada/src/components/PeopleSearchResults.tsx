import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Crown, MapPin, UserRoundSearch } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { searchProfilesFn } from '../server/social.functions'
import type { MexicoState } from '../lib/mexico-states'

type PeopleSearchResultsProps = {
  query: string
  selectedState: MexicoState | ''
}

export function PeopleSearchResults({ query, selectedState }: PeopleSearchResultsProps) {
  const q = query.trim()
  const enabled = q.length >= 2

  const peopleQuery = useQuery({
    queryKey: ['search-profiles', q, selectedState || ''],
    queryFn: () =>
      searchProfilesFn({
        data: { query: q, estado: selectedState || undefined },
      }),
    enabled,
    staleTime: 30_000,
    retry: 1,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  })

  if (!enabled) return null

  const profiles = peopleQuery.data?.profiles ?? []

  return (
    <section className="mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <UserRoundSearch size={16} className="text-amber-400" />
        <h3 className="text-sm font-bold text-white">Personas</h3>
        <span className="text-xs text-purple-300/60">
          {peopleQuery.isFetching && !peopleQuery.data
            ? 'Buscando...'
            : `${profiles.length} resultado${profiles.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {peopleQuery.isError && (
        <p className="rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          No se pudo buscar personas. Intenta de nuevo.
        </p>
      )}

      {!peopleQuery.isFetching && profiles.length === 0 && !peopleQuery.isError && (
        <p className="rounded-xl border border-purple-500/20 bg-slate-900/40 px-3 py-2 text-sm text-purple-200/70">
          No hay personas con “{q}”. Prueba nombre, oficio, profesión o estado.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {profiles.map((person) => (
          <Link
            key={person.id}
            to="/u/$userId"
            params={{ userId: person.id }}
            className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-slate-900/50 p-3 transition hover:border-amber-400/40"
          >
            <img
              src={person.avatar_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border border-amber-400/30 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate font-bold text-white">{person.nombre}</p>
                {person.verificado && <BadgeCheck size={14} className="text-sky-400" />}
                {person.es_pro && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Crown size={10} /> PRO
                  </span>
                )}
                {person.online && (
                  <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    En línea
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-amber-200/80">
                {person.habilidad_empirica || person.tipo_miembro || 'Profesional'}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-purple-300/70">
                <MapPin size={11} />
                {[person.municipio, person.estado].filter(Boolean).join(', ') || 'México'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
