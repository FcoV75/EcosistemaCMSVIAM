import type { CmsPlusNivel } from '../lib/cms-plus'
import { getCmsPlusTier } from '../lib/cms-plus'

const TONE: Record<CmsPlusNivel, string> = {
  plata: 'border-slate-300/50 bg-slate-800/80 text-slate-100',
  oro: 'border-amber-400/55 bg-amber-950/70 text-amber-100',
  platino: 'border-cyan-300/55 bg-cyan-950/70 text-cyan-50',
  diamante: 'border-violet-300/55 bg-violet-950/70 text-violet-100',
}

export function CmsPlusBadge({
  nivel,
  size = 'md',
}: {
  nivel: CmsPlusNivel | string | null | undefined
  size?: 'sm' | 'md'
}) {
  if (!nivel || !['plata', 'oro', 'platino', 'diamante'].includes(nivel)) return null
  const tier = getCmsPlusTier(nivel)
  if (!tier) return null
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${TONE[tier.id]} ${pad}`}
      title={`Círculo CMS-Plus · ${tier.nombre}`}
    >
      <span aria-hidden>◆</span>
      {tier.nombre}
    </span>
  )
}
