import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BookOpen, CalendarClock, Lock } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { PRECIO_RECUPERACION_MXN } from '../lib/cursos-educativos'
import { getEscuelaPublicaFn } from '../server/cursos-educativos.functions'

export const Route = createFileRoute('/escuela')({
  loader: () => getEscuelaPublicaFn(),
  component: EscuelaPage,
})

function EscuelaPage() {
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const data = Route.useLoaderData()

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="space-y-6">
        <header className="overflow-hidden rounded-3xl border border-amber-400/25 bg-slate-950/70">
          <img
            src="/cursos-assets/el-cuerpo-escucha/01-portada-cuerpo-escucha.jpg"
            alt=""
            className="h-48 w-full object-cover sm:h-64"
          />
          <div className="p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">ContacNeed</p>
            <h1 className="mt-1 font-serif text-3xl font-black text-amber-100 sm:text-4xl">{data.titulo}</h1>
            <p className="mt-2 text-lg text-purple-100">{data.lema}</p>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Aquí solo se publican los cursos ya impartidos y los que vienen. Los ya dados se abren con
              una cuota de recuperación de ${data.precioRecuperacion} MXN: los observas con libertad y
              después los descargas. La impartición en vivo (Zoom o presencial) tiene su propia cuota,
              anunciada en cada fecha.
            </p>
          </div>
        </header>

        {data.sesiones.length > 0 && (
          <section className="rounded-2xl border border-sky-400/25 bg-slate-950/60 p-5">
            <div className="mb-3 flex items-center gap-2 text-sky-200">
              <CalendarClock size={18} />
              <h2 className="text-lg font-bold">Próximas imparticiones</h2>
            </div>
            <ul className="space-y-2 text-sm">
              {data.sesiones.map((sesion) => (
                <li key={sesion.id} className="rounded-xl border border-slate-800 px-3 py-2">
                  <strong>
                    {sesion.fecha}
                    {sesion.hora ? ` · ${sesion.hora}` : ''}
                  </strong>{' '}
                  · {sesion.modalidad}
                  {sesion.cuotaMxn ? ` · $${sesion.cuotaMxn} MXN` : ''}
                  {sesion.notas ? <span className="block text-slate-400">{sesion.notas}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          {data.cursos.map((curso) => {
            const mio = data.misSlugs.includes(curso.slug)
            const dado = curso.estado === 'dado'
            return (
              <article
                key={curso.slug}
                className="overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/70"
              >
                <img src={curso.portada} alt="" className="h-40 w-full object-cover" />
                <div className="space-y-3 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    {dado ? 'Ya impartido' : 'Programado'}
                  </p>
                  <h3 className="text-xl font-black text-amber-100">{curso.titulo}</h3>
                  <p className="text-sm text-slate-300">{curso.resumen}</p>
                  {dado ? (
                    <p className="text-xs text-slate-400">
                      Recuperación ${PRECIO_RECUPERACION_MXN} MXN · ver y descargar
                    </p>
                  ) : (
                    <p className="text-xs text-sky-200">Fecha: {curso.fechaProgramada || 'Por anunciar'}</p>
                  )}
                  {dado ? (
                    <Link
                      to="/escuela/$slug"
                      params={{ slug: curso.slug }}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950"
                    >
                      {mio ? <BookOpen size={16} /> : <Lock size={16} />}
                      {mio ? 'Abrir mi curso' : 'Ver y adquirir'}
                    </Link>
                  ) : (
                    <span className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400">
                      Próximamente
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </AppShell>
  )
}
