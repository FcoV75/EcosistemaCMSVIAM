import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ONBOARDING_STEPS,
} from '../lib/onboarding-guide'
import { getPersonalizedGuideFn } from '../server/support.functions'

type NewUserGuideProps = {
  open: boolean
  onClose: (remember?: boolean) => void
  autoOpened?: boolean
}

export function NewUserGuide({ open, onClose, autoOpened }: NewUserGuideProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = ONBOARDING_STEPS[stepIndex]
  const Icon = step.icon
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1

  const guideQuery = useQuery({
    queryKey: ['personalized-guide'],
    queryFn: () => getPersonalizedGuideFn(),
    enabled: open,
    staleTime: 1000 * 60 * 10,
  })

  useEffect(() => {
    if (open) setStepIndex(0)
  }, [open])

  if (!open) return null

  const handleClose = (remember: boolean) => {
    onClose(remember)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="cn-glass relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-500/25 shadow-2xl">
        <button
          type="button"
          onClick={() => handleClose(false)}
          className="absolute right-4 top-4 z-10 text-purple-200 hover:text-white"
          aria-label="Cerrar guía"
        >
          <X size={18} />
        </button>

        <div className={`bg-gradient-to-r ${step.accent} px-6 pb-8 pt-6`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">
            Guía ContacNeed · Paso {stepIndex + 1} de {ONBOARDING_STEPS.length}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Icon className="text-white" size={24} />
            </div>
            <h2 className="text-xl font-black text-white">{step.title}</h2>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-purple-100/90">{step.description}</p>

          {stepIndex === 0 && (
            <div className="rounded-xl border border-purple-500/20 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-300">
                <Sparkles size={14} />
                Consejo personalizado
              </div>
              <p className="text-sm text-purple-100/85">
                {guideQuery.isLoading
                  ? 'Preparando recomendación para ti...'
                  : guideQuery.data?.tip ?? 'Explora la pizarra y filtra por tu estado cuando quieras ver contenido local.'}
              </p>
            </div>
          )}

          <div className="flex justify-center gap-1.5">
            {ONBOARDING_STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStepIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === stepIndex ? 'w-6 bg-amber-400' : 'w-2 bg-purple-500/30 hover:bg-purple-400/50'
                }`}
                aria-label={`Ir al paso ${index + 1}`}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/30 px-4 py-2.5 text-sm font-semibold text-purple-100 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(ONBOARDING_STEPS.length - 1, i + 1))}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-bold text-slate-950"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-bold text-slate-950"
              >
                ¡Empezar a usar ContacNeed!
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-purple-500/15 pt-3 text-xs text-purple-200/60">
            {autoOpened ? (
              <button type="button" onClick={() => handleClose(true)} className="hover:text-purple-100">
                No volver a mostrar
              </button>
            ) : (
              <span />
            )}
            <Link to="/registro" onClick={() => handleClose(false)} className="font-semibold text-amber-300 hover:text-amber-200">
              Crear cuenta gratis →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Panel reutilizable para la pestaña Guía del perfil */
export function SmartGuidePanel() {
  const guideQuery = useQuery({
    queryKey: ['personalized-guide'],
    queryFn: () => getPersonalizedGuideFn(),
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2 font-bold text-amber-900">
          <Sparkles size={18} />
          Tu consejo del día
        </div>
        <p className="text-sm text-amber-950/90">
          {guideQuery.isLoading
            ? 'Generando recomendación...'
            : guideQuery.data?.tip ?? 'Completa tu perfil y publica en la pizarra para ganar visibilidad.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ONBOARDING_STEPS.map((item) => {
          const StepIcon = item.icon
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm"
            >
              <div className={`mb-3 inline-flex rounded-lg bg-gradient-to-r ${item.accent} p-2 text-white`}>
                <StepIcon size={18} />
              </div>
              <h3 className="font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
