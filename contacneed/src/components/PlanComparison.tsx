import { Check, Crown, Sparkles } from 'lucide-react'
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES, PRO_EXTRA_ADS_PACK_PRICE_MXN, PRO_EXTRA_ADS_PACK_SIZE } from '../lib/plan-limits'

type PlanComparisonProps = {
  isPro?: boolean
  compact?: boolean
}

export function PlanComparison({ isPro, compact }: PlanComparisonProps) {
  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
      <div className="rounded-2xl border border-purple-500/20 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-300">Plan gratuito</p>
        <ul className="space-y-2">
          {FREE_PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm text-purple-100/85">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-slate-900/50 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Crown size={14} />
          ContacNeed PRO
        </p>
        <ul className="space-y-2">
          {PRO_PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm text-amber-50/90">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-400" />
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-amber-200/70">
          Anuncios extra: +{PRO_EXTRA_ADS_PACK_SIZE} por ${PRO_EXTRA_ADS_PACK_PRICE_MXN} MXN
          (recurrente en mensual · pago único en anual).
        </p>
        {isPro && (
          <p className="mt-2 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-200">
            Tu plan PRO está activo
          </p>
        )}
      </div>
    </div>
  )
}
