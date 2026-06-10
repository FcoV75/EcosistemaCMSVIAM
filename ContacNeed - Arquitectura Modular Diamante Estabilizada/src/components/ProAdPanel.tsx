import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Crown, Sparkles } from 'lucide-react'
import { fetchProProfiles } from '../lib/pro-ads-client'

type ProAdPanelProps = {
  onOpenStripe: () => void
}

const spotlightAds = [
  {
    title: 'Visibilidad Premium',
    body: 'Aparece en el panel PRO y destaca tus servicios con brillo dorado.',
    tag: 'Destacado',
  },
  {
    title: 'Tienda sin límites',
    body: 'Sube más imágenes y videos en tu perfil de negocio.',
    tag: 'Exclusivo',
  },
]

export function ProAdPanel({ onOpenStripe }: ProAdPanelProps) {
  const prosQuery = useQuery({
    queryKey: ['pro-profiles'],
    queryFn: fetchProProfiles,
    staleTime: 60_000,
  })

  const pros = prosQuery.data ?? []

  return (
    <aside className="space-y-4">
      <div className="cn-glass cn-glow-gold rounded-2xl border border-amber-400/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Crown className="text-amber-400" size={20} />
          <h2 className="text-sm font-bold text-white">Espacio PRO</h2>
          <Sparkles className="ml-auto text-amber-300/80" size={16} />
        </div>
        <p className="text-xs leading-relaxed text-purple-100/80">
          Anuncios destacados de especialistas premium en ContacNeed.
        </p>
      </div>

      {spotlightAds.map((ad) => (
        <div
          key={ad.title}
          className="cn-pro-card group cursor-pointer rounded-2xl border border-amber-400/40 bg-gradient-to-br from-purple-950/80 via-slate-900/90 to-amber-950/40 p-4 shadow-lg shadow-amber-500/10 transition hover:border-amber-300/60 hover:shadow-amber-500/25"
          onClick={onOpenStripe}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onOpenStripe()
          }}
          role="button"
          tabIndex={0}
        >
          <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            {ad.tag}
          </span>
          <h3 className="mt-2 text-sm font-bold text-white group-hover:text-amber-200">{ad.title}</h3>
          <p className="mt-1 text-xs text-purple-100/70">{ad.body}</p>
        </div>
      ))}

      {pros.map((pro) => (
        <div
          key={pro.id}
          className="cn-pro-card rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-900/50 to-slate-900/80 p-4 shadow-lg shadow-purple-500/10"
        >
          <div className="flex items-start gap-3">
            <img
              src={`https://i.pravatar.cc/80?u=${pro.id}`}
              alt={pro.nombre ?? 'Profesional PRO'}
              className="h-11 w-11 rounded-full border-2 border-amber-400/50 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold text-white">{pro.nombre ?? 'Profesional PRO'}</p>
                {pro.verificado && <BadgeCheck size={14} className="shrink-0 text-sky-400" />}
              </div>
              <p className="line-clamp-2 text-xs text-purple-100/70">
                {pro.descripcion_profesion ?? 'Especialista verificado en ContacNeed'}
              </p>
              {pro.estado && (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
                  {pro.estado}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <Crown size={12} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Miembro PRO</span>
          </div>
        </div>
      ))}

      {pros.length === 0 && !prosQuery.isLoading && (
        <p className="rounded-xl border border-purple-500/20 bg-purple-950/30 px-3 py-2 text-xs text-purple-200/60">
          Sé el primer anuncio PRO visible en tu estado.
        </p>
      )}

      <button
        type="button"
        onClick={onOpenStripe}
        className="w-full rounded-xl border border-dashed border-amber-400/40 py-3 text-xs font-semibold text-amber-300 transition hover:border-amber-300 hover:bg-amber-500/10"
      >
        + Publicar mi anuncio PRO
      </button>
    </aside>
  )
}
