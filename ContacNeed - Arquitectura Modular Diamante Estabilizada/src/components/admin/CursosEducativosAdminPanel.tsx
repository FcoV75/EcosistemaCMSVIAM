import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CalendarPlus, GraduationCap, Link2, Unlock } from 'lucide-react'
import {
  guardarAgendaAdminFn,
  listEscuelaAdminFn,
  otorgarCursoAdminFn,
} from '../../server/cursos-educativos.functions'
import { etiquetaCuota, type ModalidadImparticion, type SesionViva } from '../../lib/cursos-educativos'

export function CursosEducativosAdminPanel() {
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['admin-cursos-educativos'],
    queryFn: () => listEscuelaAdminFn(),
  })
  const [email, setEmail] = useState('')
  const [slug, setSlug] = useState('el-cuerpo-escucha')
  const [msg, setMsg] = useState<string | null>(null)
  const [sesion, setSesion] = useState({
    slug: 'el-cuerpo-escucha',
    fecha: '',
    hora: '',
    modalidad: 'Zoom' as ModalidadImparticion,
    cuotaMxn: '',
    lugarOEnlace: '',
    notas: '',
  })

  const otorgarMutation = useMutation({
    mutationFn: () => otorgarCursoAdminFn({ data: { email: email.trim(), slug } }),
    onSuccess: (result) => {
      setMsg(
        result.userLinked
          ? `Acceso otorgado a ${result.email}.`
          : `Acceso anotado para ${result.email}. Se vinculará al entrar con ese correo.`,
      )
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['admin-cursos-educativos'] })
    },
    onError: (error) => setMsg(error instanceof Error ? error.message : 'No se pudo otorgar'),
  })

  const agendaMutation = useMutation({
    mutationFn: (sesiones: SesionViva[]) => guardarAgendaAdminFn({ data: { sesiones } }),
    onSuccess: (result) => {
      setMsg(`Agenda actualizada (${result.total} sesión${result.total === 1 ? '' : 'es'}).`)
      queryClient.invalidateQueries({ queryKey: ['admin-cursos-educativos'] })
    },
    onError: (error) => setMsg(error instanceof Error ? error.message : 'No se pudo guardar la agenda'),
  })

  const dados = (listQuery.data?.cursos ?? []).filter((c) => c.estado === 'dado')
  const programados = (listQuery.data?.cursos ?? []).filter((c) => c.estado === 'programado')
  const sesiones = listQuery.data?.sesiones ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-emerald-300" />
          <h2 className="text-lg font-bold text-emerald-300">
            {listQuery.data?.titulo || 'Cursos Educativos'}
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-300">{listQuery.data?.lema}</p>
        <p className="mt-2 text-sm text-slate-400">
          Aquí administras los cursos que impartirás por Zoom o de forma presencial, y la cuota de
          recuperación de ${listQuery.data?.precioRecuperacion ?? 200} MXN de los ya dados.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/escuela"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10"
          >
            <Link2 size={16} />
            Abrir escuela pública
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h3 className="text-base font-bold text-amber-300">Cursos ya dados</h3>
        <p className="mt-1 text-sm text-slate-400">
          El alumno paga $200 MXN, observa el material y luego lo descarga. Tú puedes previsualizar sin
          pagar.
        </p>
        <ul className="mt-3 space-y-3">
          {dados.map((curso) => (
            <li
              key={curso.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3"
            >
              <div>
                <p className="font-semibold text-amber-200">{curso.titulo}</p>
                <p className="text-xs text-slate-400">
                  {curso.etapas} etapas · {curso.modalidad} · {curso.cuotaImparticion}
                </p>
              </div>
              <a
                href={`/escuela/${curso.slug}`}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold"
              >
                Previsualizar
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-500/25 bg-slate-900/80 p-4">
        <h3 className="text-base font-bold text-sky-300">Programados a futuro</h3>
        <p className="mt-1 text-sm text-slate-400">
          Se muestran en la escuela pública para generar expectativa. Aún no se abren ni se venden.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {programados.map((curso) => (
            <li key={curso.slug} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
              <p className="font-semibold text-sky-200">{curso.titulo}</p>
              <p className="text-xs text-slate-400">Fecha: {curso.fechaProgramada || 'Por anunciar'}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-amber-500/25 bg-slate-900/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarPlus size={18} className="text-amber-300" />
          <h3 className="text-base font-bold text-amber-300">Impartición en vivo (Zoom o presencial)</h3>
        </div>
        <p className="text-sm text-slate-400">
          Publica la próxima fecha y la cuota de impartición. Eso aparece en la escuela para que el
          alumno se entusiasme y reserve.
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!sesion.fecha) return
            const next: SesionViva = {
              id: `${Date.now()}`,
              ...sesion,
            }
            agendaMutation.mutate([...sesiones, next])
            setSesion({ ...sesion, fecha: '', hora: '', cuotaMxn: '', lugarOEnlace: '', notas: '' })
          }}
        >
          <select
            value={sesion.slug}
            onChange={(e) => setSesion({ ...sesion, slug: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            {(listQuery.data?.cursos ?? []).map((curso) => (
              <option key={curso.slug} value={curso.slug}>
                {curso.titulo}
              </option>
            ))}
          </select>
          <select
            value={sesion.modalidad}
            onChange={(e) => setSesion({ ...sesion, modalidad: e.target.value as ModalidadImparticion })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="Zoom">Zoom</option>
            <option value="Presencial">Presencial</option>
            <option value="Zoom y presencial">Zoom y presencial</option>
          </select>
          <input
            type="date"
            required
            value={sesion.fecha}
            onChange={(e) => setSesion({ ...sesion, fecha: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={sesion.hora}
            onChange={(e) => setSesion({ ...sesion, hora: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={sesion.cuotaMxn}
            onChange={(e) => setSesion({ ...sesion, cuotaMxn: e.target.value })}
            placeholder="Cuota de impartición (MXN)"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={sesion.lugarOEnlace}
            onChange={(e) => setSesion({ ...sesion, lugarOEnlace: e.target.value })}
            placeholder="Lugar o enlace Zoom"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <textarea
            value={sesion.notas}
            onChange={(e) => setSesion({ ...sesion, notas: e.target.value })}
            placeholder="Notas para el alumno (cupo, qué llevar, etc.)"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="submit"
            disabled={agendaMutation.isPending}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 md:col-span-2 disabled:opacity-50"
          >
            {agendaMutation.isPending ? 'Publicando...' : 'Publicar sesión en la escuela'}
          </button>
        </form>

        <ul className="mt-4 space-y-2 text-sm">
          {sesiones.length === 0 && <li className="text-slate-500">Aún no hay sesiones publicadas.</li>}
          {sesiones.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <span>
                <strong className="text-amber-100">{item.titulo || item.slug}</strong>
                <span className="block text-slate-300">
                  {item.fecha} {item.hora} · {item.modalidad} ·{' '}
                  {item.cuotaMxn ? etiquetaCuota(item.cuotaMxn).replace(/^ · /, '') : 'cuota por definir'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => agendaMutation.mutate(sesiones.filter((s) => s.id !== item.id))}
                className="rounded-lg bg-red-700 px-2 py-1 text-xs font-semibold"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Unlock size={18} className="text-emerald-300" />
          <h3 className="text-base font-bold text-emerald-300">Otorgar acceso de recuperación</h3>
        </div>
        <form
          className="mt-3 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!email.trim()) return
            setMsg(null)
            otorgarMutation.mutate()
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo del alumno"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            {dados.map((curso) => (
              <option key={curso.slug} value={curso.slug}>
                {curso.titulo}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={otorgarMutation.isPending}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold md:col-span-2 disabled:opacity-50"
          >
            {otorgarMutation.isPending ? 'Otorgando...' : 'Otorgar acceso'}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-sky-200">{msg}</p>}
      </section>

      <section className="rounded-2xl border border-sky-500/20 bg-slate-900/80 p-4">
        <h3 className="text-base font-bold text-sky-200">Informes e inscripciones pedidas</h3>
        <p className="mt-1 text-sm text-slate-400">
          Llegan cuando alguien pulsa «Pedir informes» o «Quiero inscribirme» en la escuela. La IA los
          orienta y tú ves aquí a quién contactar.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(listQuery.data?.intereses ?? []).length === 0 && (
            <li className="text-slate-500">Aún no hay solicitudes.</li>
          )}
          {(listQuery.data?.intereses ?? []).map((row) => {
            const meta = (row.metadata || {}) as {
              titulo?: string
              curso_slug?: string
              email?: string
              nombre?: string
              fecha?: string
            }
            return (
              <li key={row.id} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                <p className="font-semibold text-sky-100">
                  {meta.titulo || meta.curso_slug || 'Curso'} · {row.plan === 'inscripcion' ? 'inscripción' : 'informes'}
                </p>
                <p className="text-xs text-slate-400">
                  {meta.nombre || 'Alumno'} · {meta.email || 'sin correo'}
                  {meta.fecha ? ` · fecha ${meta.fecha}` : ''}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h3 className="text-base font-bold">Compras de recuperación</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-3 py-2">Curso</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(listQuery.data?.compras ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-slate-500">
                    {listQuery.isLoading ? 'Cargando...' : 'Aún no hay accesos.'}
                  </td>
                </tr>
              )}
              {(listQuery.data?.compras ?? []).map((row) => {
                const meta = (row.metadata || {}) as { curso_slug?: string; email?: string; source?: string }
                return (
                  <tr key={row.id} className="border-b border-slate-800/80">
                    <td className="px-3 py-2">{meta.curso_slug || '—'}</td>
                    <td className="px-3 py-2">{meta.email || '—'}</td>
                    <td className="px-3 py-2">{meta.source || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {row.created_at ? new Date(row.created_at).toLocaleDateString('es-MX') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
