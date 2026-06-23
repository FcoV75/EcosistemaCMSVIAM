import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Crown, ExternalLink, Sparkles } from 'lucide-react'
import { fetchProPanelItems } from '../lib/pro-ads-client'
import type { MexicoState } from '../lib/mexico-states'

type ProAdPanelProps = {
  selectedState: MexicoState | ''
  onOpenStripe: () => void
}

export function ProAdPanel({ selectedState, onOpenStripe }: ProAdPanelProps) {
  const prosQuery = useQuery({
    queryKey: ['pro-panel', selectedState],
    queryFn: () => fetchProPanelItems(selectedState || undefined),
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
          {selectedState
            ? `Especialistas premium en ${selectedState}.`
            : 'Anuncios destacados de especialistas premium en ContacNeed.'}
        </p>
      </div>

      {pros.map((pro) => (
        <ProCard key={pro.id} pro={pro} />
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

function ProCard({
  pro,
}: {
  pro: {
    id: string
    nombre?: string | null
    descripcion_profesion?: string | null
    estado?: string | null
    verificado?: boolean | null
    avatar_url?: string | null
    imagen_url?: string | null
    enlace_url?: string | null
  }
}) {
  const avatar = pro.imagen_url || pro.avatar_url || `https://i.pravatar.cc/80?u=${pro.id}`
  const body = (
    <div className="cn-pro-card rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-900/50 to-slate-900/80 p-4 shadow-lg shadow-purple-500/10 transition hover:border-amber-400/40">
      <div className="flex items-start gap-3">
        <img
          src={avatar}
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
        {pro.enlace_url && <ExternalLink size={14} className="shrink-0 text-amber-300/70" />}
      </div>
      <div className="mt-3 flex items-center gap-1">
        <Crown size={12} className="text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Miembro PRO</span>
      </div>
    </div>
  )

  if (pro.enlace_url) {
    return (
      <a href={pro.enlace_url} target="_blank" rel="noopener noreferrer" className="block">
        {body}
      </a>
    )
  }

  return body
}
