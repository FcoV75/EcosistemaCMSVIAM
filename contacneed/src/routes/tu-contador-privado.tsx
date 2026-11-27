import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CheckCircle2, Wallet } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ContadorPrivadoApp } from '../components/contador/ContadorPrivadoApp'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { CONTADOR_DISCLAIMER, CONTADOR_PRECIOS_PUBLICOS } from '../lib/contador-privado'
import { getServerUserFn } from '../server/auth.functions'
import { getContadorAccessFn } from '../server/contador.functions'
import {
  confirmStripeSessionFn,
  createContadorCheckoutFn,
} from '../server/stripe.functions'

export const Route = createFileRoute('/tu-contador-privado')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    payment_success: search.payment_success === 'true' || search.payment_success === true,
    payment_cancelled: search.payment_cancelled === 'true' || search.payment_cancelled === true,
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: TuContadorPrivadoPage,
})

function TuContadorPrivadoPage() {
  const { payment_success, session_id } = Route.useSearch()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [payMsg, setPayMsg] = useState<string | null>(null)

  const accessQuery = useQuery({
    queryKey: ['contador-access'],
    queryFn: () => getContadorAccessFn(),
  })

  const confirmMutation = useMutation({
    mutationFn: (sessionId: string) => confirmStripeSessionFn({ data: { sessionId } }),
    onSuccess: () => {
      setPayMsg('Suscripción a Tu Contador Privado activada.')
      queryClient.invalidateQueries({ queryKey: ['contador-access'] })
    },
    onError: (e) => setPayMsg(e instanceof Error ? e.message : 'No se pudo confirmar el pago'),
  })

  const checkoutMutation = useMutation({
    mutationFn: () => createContadorCheckoutFn(),
    onSuccess: (result) => {
      if ('alreadyActive' in result && result.alreadyActive) {
        setPayMsg(`Acceso listo: ${result.precioLabel}`)
        queryClient.invalidateQueries({ queryKey: ['contador-access'] })
        return
      }
      if ('url' in result && result.url) {
        window.location.href = result.url
        return
      }
      setPayMsg('No se obtuvo URL de pago')
    },
    onError: (e) => setPayMsg(e instanceof Error ? e.message : 'Error al iniciar pago'),
  })

  useEffect(() => {
    if (payment_success && session_id && !confirmMutation.isPending && !confirmMutation.isSuccess) {
      confirmMutation.mutate(session_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment_success, session_id])

  const access = accessQuery.data
  const unlocked = Boolean(access?.ok)

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="space-y-4">
        <div className="cn-glass flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/25 p-4 md:p-5">
          <Wallet className="text-emerald-300" size={22} />
          <h1 className="text-2xl font-black text-white">Tu Contador Privado</h1>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
            Oficios / PyME
          </span>
          <SectionHelpHint
            title="¿Para quién es?"
            text="Control mensual de ingresos, egresos y recordatorios fiscales para oficios con tienda. No sustituye a un contador ni presenta trámites ante el SAT."
          />
        </div>

        {payMsg && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-50">
            {payMsg}
          </p>
        )}

        {accessQuery.isLoading ? (
          <p className="text-sm text-slate-400">Verificando acceso…</p>
        ) : unlocked ? (
          <ContadorPrivadoApp />
        ) : (
          <section className="cn-glass space-y-5 rounded-2xl border border-emerald-400/25 p-5 md:p-6">
            <div>
              <h2 className="text-lg font-bold text-emerald-100">Ordena tu negocio mes a mes</h2>
              <p className="mt-1 text-sm text-slate-300">
                Ideal si tienes oficio o emprendimiento y quieres llevar ingresos, egresos, saldo y
                recordatorios fiscales mes a mes. Entras, configuras tu negocio y empiezas a
                registrar movimientos — sin rodeos.
              </p>
              <p className="mt-2 text-base font-semibold text-amber-200">
                Tu cuota: {access?.precioLabel || '—'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONTADOR_PRECIOS_PUBLICOS.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm"
                >
                  <p className="font-semibold text-slate-100">{p.label}</p>
                  <p className="mt-1 text-lg font-black text-emerald-200">
                    {p.precioMensualMxn === 0
                      ? 'Gratis'
                      : `$${p.precioMensualMxn.toLocaleString('es-MX')}/mes`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{p.descripcion}</p>
                </div>
              ))}
            </div>

            <ul className="space-y-2 text-sm text-slate-300">
              {[
                'Ingresos y egresos por mes con categorías claras',
                'Saldo automático y cierre de mes',
                'Checklist SAT educativo (recordatorios, no trámite)',
                'Fotos de tickets / comprobantes',
                'Exportación anual para ti o tu contador humano',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={16} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <p className="rounded-xl border border-amber-400/25 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
              {CONTADOR_DISCLAIMER}
            </p>

            <button
              type="button"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
              className="cn-btn-metallic rounded-xl px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {checkoutMutation.isPending
                ? 'Preparando pago…'
                : access?.precioMensualMxn === 0
                  ? 'Activar gratis'
                  : `Suscribirme · ${access?.precioLabel || ''}`}
            </button>
          </section>
        )}
      </div>
    </AppShell>
  )
}
