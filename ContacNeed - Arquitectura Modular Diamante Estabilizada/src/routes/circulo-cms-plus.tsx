import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Calendar,
  Check,
  Copy,
  Crown,
  HeartHandshake,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { CmsPlusBadge } from '../components/CmsPlusBadge'
import { useIdentity } from '../lib/identity-context'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { CMS_PLUS_NIVELES, type CmsPlusBilling, type CmsPlusNivel } from '../lib/cms-plus'

const CALENDLY_CMS = 'https://calendly.com/multidisciplinarioags'
import {
  aceptarCirculoCmsPlusFn,
  getCmsPlusCatalogoFn,
  getMiCmsPlusFn,
  invitarCirculoCmsPlusFn,
} from '../server/cms-plus.functions'
import { confirmStripeSessionFn, createCmsPlusCheckoutFn } from '../server/stripe.functions'

type CirculoSearch = {
  invite?: string
  payment_success?: string
  payment_cancelled?: string
  session_id?: string
}

function readCirculoSearch(): CirculoSearch {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    invite: params.get('invite') || undefined,
    payment_success: params.get('payment_success') || undefined,
    payment_cancelled: params.get('payment_cancelled') || undefined,
    session_id: params.get('session_id') || undefined,
  }
}

export const Route = createFileRoute('/circulo-cms-plus')({
  component: CirculoCmsPlusPage,
})

const TIER_ACCENT: Record<CmsPlusNivel, string> = {
  plata: 'border-slate-400/40 from-slate-800/80 to-slate-950/90',
  oro: 'border-amber-400/45 from-amber-950/50 to-slate-950/90',
  platino: 'border-cyan-300/40 from-cyan-950/45 to-slate-950/90',
  diamante: 'border-violet-300/45 from-violet-950/50 to-slate-950/90',
}

function CirculoCmsPlusPage() {
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <CirculoCmsPlusContent onOpenStripe={() => setShowStripeModal(true)} />
    </AppShell>
  )
}

function CirculoCmsPlusContent({ onOpenStripe }: { onOpenStripe: () => void }) {
  const { user } = useIdentity()
  const queryClient = useQueryClient()
  const [billing, setBilling] = useState<CmsPlusBilling>('mensual')
  const [inviteEmail, setInviteEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [checkoutNivel, setCheckoutNivel] = useState<CmsPlusNivel | null>(null)
  const [copied, setCopied] = useState(false)
  const [search] = useState<CirculoSearch>(() => readCirculoSearch())

  const catalogoQuery = useQuery({
    queryKey: ['cms-plus-catalogo'],
    queryFn: () => getCmsPlusCatalogoFn(),
  })
  const miQuery = useQuery({
    queryKey: ['mi-cms-plus'],
    queryFn: () => getMiCmsPlusFn(),
  })

  useEffect(() => {
    const sessionId = search.session_id
    if (search.payment_success === 'true' && sessionId) {
      confirmStripeSessionFn({ data: { sessionId } })
        .then(() => {
          setMsg('¡Bienvenido al Círculo CMS-Plus! Tu membresía ya está activa.')
          queryClient.invalidateQueries({ queryKey: ['mi-cms-plus'] })
        })
        .catch((err) => {
          setMsg(err instanceof Error ? err.message : 'Pago recibido; activando membresía…')
          queryClient.invalidateQueries({ queryKey: ['mi-cms-plus'] })
        })
    } else if (search.payment_cancelled === 'true') {
      setMsg('Pago cancelado. Puedes elegir tu nivel cuando quieras.')
    }
  }, [search.payment_success, search.payment_cancelled, search.session_id, queryClient])

  useEffect(() => {
    if (!search.invite || !user) return
    aceptarCirculoCmsPlusFn({ data: { token: search.invite } })
      .then(() => {
        setMsg('Entraste al círculo de cuidado. Disfruta el descuento en consultas.')
        queryClient.invalidateQueries({ queryKey: ['mi-cms-plus'] })
      })
      .catch((err) => {
        setMsg(err instanceof Error ? err.message : 'No se pudo aceptar la invitación')
      })
  }, [search.invite, user, queryClient])

  const checkoutMutation = useMutation({
    mutationFn: (payload: { nivel: CmsPlusNivel; billing: CmsPlusBilling }) =>
      createCmsPlusCheckoutFn({ data: payload }),
    onSuccess: (result) => {
      window.location.href = result.url
    },
    onError: (error) => {
      setCheckoutNivel(null)
      setMsg(error instanceof Error ? error.message : 'No se pudo iniciar el pago')
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () => invitarCirculoCmsPlusFn({ data: { email: inviteEmail || undefined } }),
    onSuccess: async (result) => {
      setMsg(`Invitación lista. Enlace: ${result.inviteUrl}`)
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['mi-cms-plus'] })
      try {
        await navigator.clipboard.writeText(result.inviteUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        /* ignore */
      }
    },
    onError: (error) => {
      setMsg(error instanceof Error ? error.message : 'No se pudo crear la invitación')
    },
  })

  const membership = miQuery.data?.membership
  const niveles = catalogoQuery.data?.niveles || []
  const manifiesto = catalogoQuery.data?.manifiesto

  const activeTierLabel = useMemo(() => {
    if (!membership?.active || !membership.tier) return null
    return `${membership.tier.nombre} · ${membership.billing === 'anual' ? 'Anual' : 'Mensual'}`
  }, [membership])

  const renovacion = useMemo(() => {
    if (!membership?.active || membership.permanent || !membership.expiresAt) return null
    const ms = new Date(membership.expiresAt).getTime() - Date.now()
    const dias = Math.ceil(ms / 86400000)
    if (Number.isNaN(dias)) return null
    return { dias, fecha: new Date(membership.expiresAt).toLocaleDateString('es-MX') }
  }, [membership])

  const upgradeSugerido = useMemo(() => {
    if (!membership?.active || !membership.nivel) return null
    const orden: CmsPlusNivel[] = ['plata', 'oro', 'platino', 'diamante']
    const idx = orden.indexOf(membership.nivel)
    if (idx < 0 || idx >= orden.length - 1) return null
    return CMS_PLUS_NIVELES.find((t) => t.id === orden[idx + 1]) || null
  }, [membership])

  const startCheckout = (nivel: CmsPlusNivel) => {
    if (!user) {
      setMsg('Inicia sesión para unirte al Círculo CMS-Plus.')
      return
    }
    setCheckoutNivel(nivel)
    setMsg(null)
    checkoutMutation.mutate({ nivel, billing })
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-slate-950 via-indigo-950/70 to-amber-950/40 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/80">
          Ecosistema CMS VIAM
        </p>
        <h1 className="mt-2 font-serif text-3xl font-black text-amber-50 sm:text-4xl">
          Círculo CMS-Plus Membresías
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-purple-100/90 sm:text-base">
          {manifiesto ||
            'Club de salud física, mental y de expansión económica. El Plus integra Sincronía Nexus, ContacNeed, IA VIAM y Video Diamante.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge icon={<HeartHandshake size={14} />} text="Salud física y mental" />
          <Badge icon={<Sparkles size={14} />} text="Plus digital completo" />
          <Badge icon={<Users size={14} />} text="Círculo de cuidado" />
          <Badge icon={<Shield size={14} />} text="No es pirámide" />
        </div>
        {activeTierLabel && membership?.nivel && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CmsPlusBadge nivel={membership.nivel} />
            <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-100">
              <Crown size={16} />
              Tu membresía activa: {activeTierLabel}
            </p>
          </div>
        )}
      </header>

      {msg && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-50">
          {msg}
        </div>
      )}

      {membership?.active && renovacion && renovacion.dias <= 7 && (
        <section className="rounded-2xl border border-rose-400/35 bg-rose-950/25 p-5">
          <h2 className="text-lg font-bold text-rose-100">
            {renovacion.dias <= 0
              ? 'Tu periodo de pago venció o vence hoy'
              : `Tu periodo de pago se acerca · ${renovacion.dias} día${renovacion.dias === 1 ? '' : 's'}`}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Fecha de renovación: {renovacion.fecha}. Renueva para no interrumpir créditos, círculo ni Plus
            digital.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => membership.nivel && startCheckout(membership.nivel)}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white"
            >
              Renovar {membership.tier?.nombre || 'mi nivel'}
            </button>
            {upgradeSugerido && (
              <button
                type="button"
                onClick={() => startCheckout(upgradeSugerido.id)}
                className="rounded-xl border border-amber-400/50 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100"
              >
                Subir a {upgradeSugerido.nombre} (${upgradeSugerido.precioMensualMxn}/mes)
              </button>
            )}
          </div>
        </section>
      )}

      {membership?.active && upgradeSugerido && (!renovacion || renovacion.dias > 7) && (
        <section className="rounded-2xl border border-violet-400/30 bg-violet-950/20 p-5">
          <h2 className="text-lg font-bold text-violet-100">Oferta al renovar: sube de nivel</h2>
          <p className="mt-1 text-sm text-slate-300">
            Estás en {membership.tier?.nombre}. Al pagar tu mensualidad puedes pasar a{' '}
            <strong className="text-violet-100">{upgradeSugerido.nombre}</strong> (
            {upgradeSugerido.creditosSalud} créditos · {upgradeSugerido.beneficiariosMax} beneficiarios ·{' '}
            {upgradeSugerido.descuentoCirculoPct}% dto).
          </p>
          <button
            type="button"
            onClick={() => startCheckout(upgradeSugerido.id)}
            className="mt-3 rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white"
          >
            Conocer {upgradeSugerido.nombre}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-amber-100">Elige tu ritmo</h2>
          <div className="inline-flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setBilling('mensual')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                billing === 'mensual' ? 'bg-amber-500 text-slate-950' : 'text-purple-100'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBilling('anual')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                billing === 'anual' ? 'bg-amber-500 text-slate-950' : 'text-purple-100'
              }`}
            >
              Anual (~2 meses de regalo)
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {niveles.map((tier) => {
            const precio =
              billing === 'anual' ? tier.precioAnualMxn : tier.precioMensualMxn
            const isMine = membership?.active && membership.nivel === tier.id
            return (
              <article
                key={tier.id}
                className={`rounded-2xl border bg-gradient-to-br p-5 ${TIER_ACCENT[tier.id as CmsPlusNivel]} ${
                  tier.highlight ? 'ring-1 ring-amber-300/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-200/80">
                      {tier.highlight ? 'Recomendado' : 'Nivel'}
                    </p>
                    <h3 className="text-2xl font-black text-white">{tier.nombre}</h3>
                    <p className="mt-1 text-sm text-purple-100/85">{tier.tagline}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-100">${precio}</p>
                    <p className="text-xs text-slate-300">
                      MXN / {billing === 'anual' ? 'año' : 'mes'}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5">
                  <li className="flex gap-2 text-sm text-slate-100">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    {tier.creditosSalud} créditos de salud / mes
                  </li>
                  {tier.plusResumen.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-100">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                  <li className="flex gap-2 text-sm text-slate-100">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    Círculo: {tier.beneficiariosMax} beneficiarios · {tier.descuentoCirculoPct}% dto.
                  </li>
                  <li className="flex gap-2 text-sm text-slate-100">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    Aporte Fondo de Cuidado: ${tier.aporteFondoMxn}/mes
                  </li>
                </ul>

                <button
                  type="button"
                  disabled={checkoutMutation.isPending && checkoutNivel === tier.id}
                  onClick={() => startCheckout(tier.id as CmsPlusNivel)}
                  className="cn-btn-metallic mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60"
                >
                  <Crown size={16} />
                  {isMine
                    ? 'Renovar / mantener'
                    : checkoutMutation.isPending && checkoutNivel === tier.id
                      ? 'Redirigiendo a Stripe…'
                      : `Unirme a ${tier.nombre}`}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      {membership?.active && membership.nivel && (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-950/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-emerald-100">Tus créditos de salud</h2>
                <CmsPlusBadge nivel={membership.nivel} size="sm" />
              </div>
              {miQuery.data?.creditos ? (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <Stat label="Disponibles" value={String(miQuery.data.creditos.disponibles)} />
                  <Stat label="Asignados" value={String(miQuery.data.creditos.allotment)} />
                  <Stat label="Usados" value={String(miQuery.data.creditos.usados)} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-300">Cargando créditos del periodo…</p>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Periodo {miQuery.data?.creditos?.periodo || '—'}. Los créditos se renuevan cada mes y
                puedes acumular hasta 2 periodos.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-950/20 p-5 lg:col-span-1">
              <h2 className="text-lg font-bold text-cyan-100">Tu círculo de cuidado</h2>
              <p className="mt-1 text-sm text-slate-300">
                Invita hasta {membership.tier?.beneficiariosMax ?? '—'} personas. Descuento{' '}
                {membership.tier?.descuentoCirculoPct ?? '—'}% en consultas. No es pirámide.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Correo opcional del invitado"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                />
                <button
                  type="button"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                  className="rounded-xl border border-cyan-300/40 bg-cyan-900/40 px-4 py-2 text-sm font-semibold text-cyan-50 disabled:opacity-60"
                >
                  {inviteMutation.isPending ? 'Creando…' : copied ? '¡Enlace copiado!' : 'Crear invitación'}
                </button>
              </div>
              <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
                {(miQuery.data?.circulo || []).length === 0 && (
                  <li className="text-sm text-slate-400">Aún no hay invitaciones.</li>
                )}
                {(miQuery.data?.circulo || []).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
                  >
                    <span className="text-purple-100">
                      {item.email_invitado || 'Sin correo'} · {item.status}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-cyan-200"
                      onClick={async () => {
                        const url = `${window.location.origin}/circulo-cms-plus?invite=${item.token}`
                        await navigator.clipboard.writeText(url)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      }}
                    >
                      <Copy size={12} />
                      Copiar
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-5">
              <h2 className="text-lg font-bold text-amber-100">Citas CMS · Calendly</h2>
              <p className="mt-1 text-sm text-slate-300">
                Programa tus consultas o las de tus beneficiarios con la misma app de citas de la
                página principal del CMS.
              </p>
              <a
                href={CALENDLY_CMS}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950"
              >
                <Calendar size={16} />
                Abrir app de citas
              </a>
              <p className="mt-2 break-all text-xs text-slate-400">{CALENDLY_CMS}</p>
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-amber-400/20 bg-slate-950/60 p-5">
        <h2 className="text-lg font-bold text-amber-100">Qué incluye el Plus</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Sincronía Nexus', 'Rituales, calma y bitácora emocional'],
            ['ContacNeed', 'Perfil PRO, grupos, avisos y oficios'],
            ['IA VIAM', 'Orientación práctica para vida y oficio'],
            ['Video Diamante', 'Clips para proyectar tu marca'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <p className="font-semibold text-amber-100">{title}</p>
              <p className="mt-1 text-sm text-slate-300">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-400">
          ¿Solo quieres ContacNeed PRO clásico?{' '}
          <button
            type="button"
            className="font-semibold text-amber-200 underline"
            onClick={onOpenStripe}
          >
            Ver plan PRO individual
          </button>
          {' · '}
          <Link to="/profile" className="font-semibold text-amber-200 underline">
            Ir a Mi Perfil
          </Link>
        </p>
      </section>
    </div>
  )
}

function Badge({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-purple-100">
      {icon}
      {text}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-center">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}
