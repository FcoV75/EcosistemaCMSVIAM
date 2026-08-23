import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Download, Lock, Presentation } from 'lucide-react'
import { AccionesEscuela } from '../components/AccionesEscuela'
import { LugarSesion } from '../components/LugarSesion'
import { etiquetaCuota } from '../lib/cursos-educativos'
import { AppShell } from '../components/AppShell'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import {
  confirmEscuelaCheckoutFn,
  createEscuelaCheckoutFn,
  getCursoAccesoFn,
  getCursoDocumentoFn,
} from '../server/cursos-educativos.functions'

export const Route = createFileRoute('/escuela/$slug')({
  loader: ({ params }) => getCursoAccesoFn({ data: { slug: params.slug } }),
  component: CursoEscuelaPage,
})

function CursoEscuelaPage() {
  const data = Route.useLoaderData()
  const { slug } = Route.useParams()
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [tab, setTab] = useState<'lecciones' | 'diapositivas'>('lecciones')
  const [html, setHtml] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const checkoutMutation = useMutation({
    mutationFn: () => createEscuelaCheckoutFn({ data: { slug } }),
    onSuccess: (result) => {
      if (result.already) {
        window.location.reload()
        return
      }
      if (result.url) window.location.href = result.url
    },
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo iniciar el pago'),
  })

  const confirmMutation = useMutation({
    mutationFn: (sessionId: string) => confirmEscuelaCheckoutFn({ data: { sessionId } }),
    onSuccess: () => window.location.replace(`/escuela/${slug}`),
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo confirmar el pago'),
  })

  const docMutation = useMutation({
    mutationFn: (kind: 'lecciones' | 'diapositivas' | 'zip') =>
      getCursoDocumentoFn({ data: { slug, kind } }),
    onSuccess: (result, kind) => {
      if (kind === 'zip' && result.zipUrl) {
        const a = document.createElement('a')
        a.href = result.zipUrl
        a.download = result.filename || 'curso.zip'
        a.click()
        return
      }
      if (result.html) setHtml(result.html)
    },
    onError: (error) => setLoadError(error instanceof Error ? error.message : 'No se pudo abrir'),
  })

  useEffect(() => {
    const sessionId = search?.get('session_id')
    if (search?.get('payment_success') === 'true' && sessionId) {
      confirmMutation.mutate(sessionId)
    }
  }, [])

  useEffect(() => {
    if (!data.unlocked) return
    setLoadError(null)
    docMutation.mutate(tab)
  }, [data.unlocked, tab, slug])

  const srcDoc = useMemo(() => html, [html])

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="space-y-5">
        <Link to="/escuela" className="text-sm font-semibold text-amber-300 hover:underline">
          ← Volver a la escuela
        </Link>
        <header className="rounded-2xl border border-amber-400/25 bg-slate-950/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
            {data.curso.estado === 'dado' ? 'Curso ya impartido' : 'Programado'}
          </p>
          <h1 className="mt-1 text-3xl font-black text-amber-100">{data.curso.titulo}</h1>
          <p className="mt-2 text-sm text-slate-300">{data.curso.resumen}</p>
          {(data.esDocente || data.esAdmin) && (
            <p className="mt-3 text-xs font-semibold text-emerald-200">
              Entraste como docente: puedes abrir y descargar todos los cursos dados sin pagar la
              recuperación.
            </p>
          )}
        </header>

        {!data.unlocked && data.curso.estado === 'dado' && (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-5">
            <div className="mb-2 flex items-center gap-2 text-amber-200">
              <Lock size={18} />
              <h2 className="text-lg font-bold">Cuota de recuperación · ${data.precioRecuperacion} MXN</h2>
            </div>
            <p className="text-sm text-slate-300">
              Este curso ya se impartió. Con la cuota de recuperación lo observas con libertad y luego
              lo descargas a tu dispositivo. Inicia sesión en ContacNeed para pagar.
            </p>
            <button
              type="button"
              disabled={checkoutMutation.isPending}
              onClick={() => {
                if (!data.loggedIn) {
                  alert('Inicia sesión en ContacNeed (arriba a la derecha) y vuelve a pulsar para pagar la cuota de recuperación.')
                  return
                }
                checkoutMutation.mutate()
              }}
              className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {checkoutMutation.isPending
                ? 'Abriendo Stripe...'
                : data.loggedIn
                  ? `Pagar $${data.precioRecuperacion} MXN`
                  : 'Inicia sesión y paga $200 MXN'}
            </button>
            {confirmMutation.isPending && (
              <p className="mt-3 text-sm text-sky-200">Confirmando tu pago...</p>
            )}
          </section>
        )}

        {(data.curso.estado === 'programado' || (data.sesiones ?? []).length > 0) && (
          <section className="rounded-2xl border border-sky-400/25 bg-slate-950/60 p-5">
            <h2 className="text-lg font-bold text-sky-100">
              {data.curso.estado === 'programado' ? 'Este curso está programado' : 'Próximas fechas en vivo'}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {data.curso.estado === 'programado'
                ? 'Todavía no se abre el material grabado. Pide informes o inscríbete a la fecha en vivo: la IA te orienta y el docente recibe tu solicitud.'
                : 'Además del material ya impartido, puedes pedir informes o inscribirte a una sesión en vivo.'}
            </p>
            {(data.sesiones ?? []).length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {data.sesiones.map((sesion) => (
                  <li key={sesion.id} className="rounded-xl border border-slate-800 px-3 py-2">
                    <p className="font-bold text-sky-100">{sesion.titulo}</p>
                    <p>
                      {sesion.fecha}
                      {sesion.hora ? ` · ${sesion.hora}` : ''} · {sesion.modalidad}
                      {etiquetaCuota(sesion.cuotaMxn)}
                    </p>
                    <LugarSesion valor={sesion.lugarOEnlace} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <AccionesEscuela
                slug={slug}
                titulo={data.curso.titulo}
                sesionId={data.sesiones?.[0]?.id}
                loggedIn={data.loggedIn}
              />
            </div>
          </section>
        )}

        {data.unlocked && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('lecciones')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === 'lecciones' ? 'bg-amber-500 text-slate-950' : 'border border-slate-700'
                }`}
              >
                Lecciones
              </button>
              <button
                type="button"
                onClick={() => setTab('diapositivas')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === 'diapositivas' ? 'bg-amber-500 text-slate-950' : 'border border-slate-700'
                }`}
              >
                <Presentation size={16} />
                Diapositivas
              </button>
              <button
                type="button"
                disabled={docMutation.isPending}
                onClick={() => docMutation.mutate('zip')}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-100"
              >
                <Download size={16} />
                Descargar curso
              </button>
            </div>
            {loadError && <p className="text-sm text-red-300">{loadError}</p>}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
              {srcDoc ? (
                <iframe title={data.curso.titulo} srcDoc={srcDoc} className="h-[78vh] w-full border-0" />
              ) : (
                <p className="px-4 py-10 text-center text-sm text-slate-400">Cargando material...</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
