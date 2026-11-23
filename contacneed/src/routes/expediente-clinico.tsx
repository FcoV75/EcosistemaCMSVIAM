import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CheckCircle2, Stethoscope } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ExpedienteClinicoApp } from '../components/expediente/ExpedienteClinicoApp'
import { SectionHelpHint } from '../components/SectionHelpHint'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { EXPEDIENTE_PRECIOS_PUBLICOS } from '../lib/expediente-clinico'
import { getServerUserFn } from '../server/auth.functions'
import { getExpedienteAccessFn } from '../server/expediente.functions'
import {
  confirmStripeSessionFn,
  createExpedienteCheckoutFn,
} from '../server/stripe.functions'

export const Route = createFileRoute('/expediente-clinico')({
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
  component: ExpedienteClinicoPage,
})

function ExpedienteClinicoPage() {
  const { payment_success, session_id } = Route.useSearch()
  const queryClient = useQueryClient()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [payMsg, setPayMsg] = useState<string | null>(null)

  const accessQuery = useQuery({
    queryKey: ['expediente-access'],
    queryFn: () => getExpedienteAccessFn(),
  })

  const confirmMutation = useMutation({
    mutationFn: (sessionId: string) => confirmStripeSessionFn({ data: { sessionId } }),
    onSuccess: () => {
      setPayMsg('Suscripción al expediente clínico activada.')
      queryClient.invalidateQueries({ queryKey: ['expediente-access'] })
    },
    onError: (e) => setPayMsg(e instanceof Error ? e.message : 'No se pudo confirmar el pago'),
  })

  const checkoutMutation = useMutation({
    mutationFn: () => createExpedienteCheckoutFn(),
    onSuccess: (result) => {
      if ('alreadyActive' in result && result.alreadyActive) {
        setPayMsg(`Acceso listo: ${result.precioLabel}`)
        queryClient.invalidateQueries({ queryKey: ['expediente-access'] })
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
        <div className="cn-glass flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 p-4 md:p-5">
          <Stethoscope className="text-cyan-300" size={22} />
          <h1 className="text-2xl font-black text-white">Expediente clínico normativo</h1>
          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
            Médico / paramédico
          </span>
          <SectionHelpHint
            title="¿Para quién es?"
            text="Herramienta de control de pacientes alineada a NOM-004 y NOM-024. Solo rama médica y paramédica. Cada profesional opera su propio consultorio aislado."
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
          <ExpedienteClinicoApp variant="page" />
        ) : (
          <section className="cn-glass space-y-5 rounded-2xl border border-cyan-400/25 p-5 md:p-6">
            <div>
              <h2 className="text-lg font-bold text-cyan-100">Activa tu consultorio digital</h2>
              <p className="mt-1 text-sm text-slate-300">
                Historia clínica, notas de evolución selladas, grabación de consulta y separación
                Miembros ContacNeed / No miembros. Precio según tu nivel CMS-Plus:
              </p>
              <p className="mt-2 text-base font-semibold text-emerald-200">
                Tu cuota: {access?.precioLabel || '—'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EXPEDIENTE_PRECIOS_PUBLICOS.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm"
                >
                  <p className="font-semibold text-slate-100">{p.label}</p>
                  <p className="mt-1 text-lg font-black text-cyan-200">
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
                'Datos del profesional responsable en cada nota (NOM-004 5.2 / 5.10)',
                'Historia clínica + evolución inmutable (sellado cronológico)',
                'Grabación de audio de la consulta adjunta a la nota',
                'Filtro Miembros vs No miembros para control de tu práctica',
                'Respaldo JSON exportable (continuidad ≥ 5 años)',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={16} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

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
