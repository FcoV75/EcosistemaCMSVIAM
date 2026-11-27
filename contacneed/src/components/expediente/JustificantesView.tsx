import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  FileBadge2,
  Loader2,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react'
import {
  createExpedienteJustificanteFn,
  listExpedienteJustificantesFn,
  listExpedientePacientesFn,
  softDeleteExpedienteJustificanteFn,
} from '../../server/expediente.functions'
import {
  JUSTIFICANTE_DISCLAIMER,
  JUSTIFICANTE_TIPOS,
  calcEdad,
  diasEntreFechas,
  type JustificanteTipo,
} from '../../lib/expediente-clinico'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const glass = 'rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl'
const inputCls =
  'w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50'
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400'
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50'

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Error inesperado'
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

type Props = {
  profesional: Row | null
  prefillPacienteId?: string | null
}

export function JustificantesView({ profesional, prefillPacienteId }: Props) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'list' | 'new' | 'print'>('list')
  const [selected, setSelected] = useState<Row | null>(null)
  const [error, setError] = useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['expediente', 'justificantes', q],
    queryFn: () => listExpedienteJustificantesFn({ data: { q } }),
  })
  const pacientesQ = useQuery({
    queryKey: ['expediente', 'pacientes', 'just'],
    queryFn: () => listExpedientePacientesFn({ data: { filtro: 'todos' } }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => softDeleteExpedienteJustificanteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expediente', 'justificantes'] })
      if (selected) setSelected(null)
      setMode('list')
    },
    onError: (e) => setError(errMsg(e)),
  })

  useEffect(() => {
    if (prefillPacienteId) {
      setMode('new')
    }
  }, [prefillPacienteId])

  const rows = (listQ.data?.justificantes as Row[] | undefined) || []

  if (mode === 'new') {
    return (
      <JustificanteForm
        profesional={profesional}
        pacientes={(pacientesQ.data?.pacientes as Row[] | undefined) || []}
        prefillPacienteId={prefillPacienteId}
        onCancel={() => setMode('list')}
        onCreated={(j) => {
          qc.invalidateQueries({ queryKey: ['expediente', 'justificantes'] })
          setSelected(j)
          setMode('print')
        }}
      />
    )
  }

  if (mode === 'print' && selected) {
    return (
      <JustificantePrint
        justificante={selected}
        profesional={profesional}
        onBack={() => setMode('list')}
        onDelete={() => {
          if (window.confirm(`¿Archivar el justificante ${selected.folio}?`)) delMut.mutate(selected.id)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Buscar folio, paciente, diagnóstico…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className={btnPrimary} onClick={() => setMode('new')}>
          <Plus className="h-4 w-4" /> Nuevo justificante
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {listQ.isError && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {errMsg(listQ.error)}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Emite constancias para el patrón, escuela u otra institución. Se imprimen con logo y datos de tu clínica.
        {` ${JUSTIFICANTE_DISCLAIMER}`}
      </p>

      {listQ.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando justificantes…
        </div>
      ) : rows.length === 0 ? (
        <div className={`${glass} p-8 text-center text-sm text-slate-400`}>
          Aún no hay justificantes. Crea el primero para un paciente.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                className={`${glass} w-full p-4 text-left transition hover:border-cyan-400/40`}
                onClick={() => {
                  setSelected(j)
                  setMode('print')
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{j.paciente_nombre}</p>
                    <p className="text-[11px] text-slate-400">
                      {j.folio} · {JUSTIFICANTE_TIPOS.find((t) => t.id === j.tipo)?.label || j.tipo}
                    </p>
                  </div>
                  <FileBadge2 className="h-4 w-4 shrink-0 text-cyan-300" />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-300">{j.diagnostico}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Emitido {formatFecha(j.fecha_emision)}
                  {j.dias_reposo > 0 ? ` · ${j.dias_reposo} día(s) de reposo` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function JustificanteForm({
  profesional,
  pacientes,
  prefillPacienteId,
  onCancel,
  onCreated,
}: {
  profesional: Row | null
  pacientes: Row[]
  prefillPacienteId?: string | null
  onCancel: () => void
  onCreated: (j: Row) => void
}) {
  const [pacienteId, setPacienteId] = useState(prefillPacienteId || '')
  const [tipo, setTipo] = useState<JustificanteTipo>('laboral')
  const [destinatario, setDestinatario] = useState('')
  const [nombre, setNombre] = useState('')
  const [edad, setEdad] = useState('')
  const [sexo, setSexo] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [cie10, setCie10] = useState('')
  const [emision, setEmision] = useState(hoyISO())
  const [inicio, setInicio] = useState(hoyISO())
  const [fin, setFin] = useState(hoyISO())
  const [recomendaciones, setRecomendaciones] = useState(
    'Se sugiere reposo relativo y seguimiento médico según evolución clínica.',
  )
  const [observaciones, setObservaciones] = useState('')
  const [lugar, setLugar] = useState('')
  const [error, setError] = useState<string | null>(null)

  const dias = useMemo(() => diasEntreFechas(inicio, fin), [inicio, fin])

  useEffect(() => {
    if (!pacienteId) return
    const p = pacientes.find((x) => x.id === pacienteId)
    if (!p) return
    setNombre(String(p.nombre_completo || ''))
    setSexo(String(p.sexo || ''))
    const e = calcEdad(String(p.fecha_nacimiento || ''))
    setEdad(e == null ? '' : String(e))
    if (p.diagnostico) setDiagnostico(String(p.diagnostico))
  }, [pacienteId, pacientes])

  const mut = useMutation({
    mutationFn: () =>
      createExpedienteJustificanteFn({
        data: {
          pacienteId: pacienteId || undefined,
          tipo,
          destinatario,
          paciente_nombre: nombre,
          paciente_edad: edad ? Number(edad) : null,
          paciente_sexo: sexo || undefined,
          diagnostico,
          cie10,
          fecha_emision: emision,
          fecha_inicio_reposo: inicio || undefined,
          fecha_fin_reposo: fin || undefined,
          dias_reposo: dias,
          recomendaciones,
          observaciones,
          lugar_emision: lugar || profesional?.domicilio_establecimiento || undefined,
        },
      }),
    onSuccess: (res) => onCreated(res.justificante as Row),
    onError: (e) => setError(errMsg(e)),
  })

  const tipoHint = JUSTIFICANTE_TIPOS.find((t) => t.id === tipo)?.hint

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        mut.mutate()
      }}
    >
      <div className={`${glass} space-y-3 p-4`}>
        <h3 className="text-sm font-bold text-cyan-200">Nuevo justificante médico</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Paciente del expediente (opcional)</label>
            <select className={inputCls} value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
              <option value="">— Escribir manualmente —</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo} · {p.numero_expediente}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tipo *</label>
            <select
              className={inputCls}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as JustificanteTipo)}
            >
              {JUSTIFICANTE_TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {tipoHint && <p className="mt-1 text-[11px] text-slate-500">{tipoHint}</p>}
          </div>
          <div>
            <label className={labelCls}>Destinatario (empresa / escuela)</label>
            <input
              className={inputCls}
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="A quien corresponda / RH / Escuela"
            />
          </div>
          <div>
            <label className={labelCls}>Nombre del paciente *</label>
            <input className={inputCls} required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Edad</label>
              <input className={inputCls} inputMode="numeric" value={edad} onChange={(e) => setEdad(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Sexo</label>
              <select className={inputCls} value={sexo} onChange={(e) => setSexo(e.target.value)}>
                <option value="">—</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Intersexual">Intersexual</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Diagnóstico / motivo de atención *</label>
            <textarea
              className={inputCls}
              rows={3}
              required
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>CIE-10 (opcional)</label>
            <input
              className={inputCls}
              value={cie10}
              onChange={(e) => setCie10(e.target.value.toUpperCase())}
              placeholder="Ej. J06.9"
            />
          </div>
          <div>
            <label className={labelCls}>Fecha de emisión *</label>
            <input type="date" className={inputCls} required value={emision} onChange={(e) => setEmision(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Inicio de reposo</label>
            <input type="date" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fin de reposo</label>
            <input type="date" className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Días de reposo</label>
            <input className={inputCls} readOnly value={dias ? String(dias) : '0'} />
          </div>
          <div>
            <label className={labelCls}>Lugar de emisión</label>
            <input
              className={inputCls}
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ciudad, Estado"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Recomendaciones</label>
            <textarea
              className={inputCls}
              rows={2}
              value={recomendaciones}
              onChange={(e) => setRecomendaciones(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Observaciones</label>
            <textarea
              className={inputCls}
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className={btnPrimary} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBadge2 className="h-4 w-4" />}
          Emitir y sellar
        </button>
      </div>
    </form>
  )
}

function JustificantePrint({
  justificante,
  profesional,
  onBack,
  onDelete,
}: {
  justificante: Row
  profesional: Row | null
  onBack: () => void
  onDelete: () => void
}) {
  const j = justificante
  const tipoLabel = JUSTIFICANTE_TIPOS.find((t) => t.id === j.tipo)?.label || j.tipo

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" className={btnGhost} onClick={onBack}>
          ← Lista
        </button>
        <button type="button" className={btnPrimary} onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
        <button type="button" className={btnGhost} onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Archivar
        </button>
      </div>

      <article
        className="mx-auto max-w-[800px] rounded-2xl border border-slate-300 bg-white p-8 text-slate-900 shadow-lg print:border-0 print:shadow-none"
        id="justificante-print"
      >
        <header className="mb-6 flex items-start gap-4 border-b border-slate-300 pb-4">
          {profesional?.logo_url ? (
            <img
              src={String(profesional.logo_url)}
              alt="Logo clínica"
              className="h-16 w-16 rounded-lg object-contain"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
              Logo
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">{profesional?.institucion || 'Establecimiento médico'}</p>
            <p className="text-xs text-slate-600">
              {profesional?.tipo_establecimiento}
              {profesional?.domicilio_establecimiento ? ` · ${profesional.domicilio_establecimiento}` : ''}
            </p>
            {profesional?.telefono_institucional && (
              <p className="text-xs text-slate-600">Tel. {profesional.telefono_institucional}</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-bold text-slate-800">{j.folio}</p>
            <p>{formatFecha(j.fecha_emision)}</p>
          </div>
        </header>

        <h1 className="mb-4 text-center text-xl font-black tracking-wide text-slate-900">
          JUSTIFICANTE MÉDICO
        </h1>
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {tipoLabel}
        </p>

        <p className="mb-4 text-sm leading-relaxed">
          {j.lugar_emision ? `${j.lugar_emision}, ` : ''}
          a {formatFecha(j.fecha_emision)}.
        </p>

        <p className="mb-4 text-sm leading-relaxed">
          A quien corresponda
          {j.destinatario ? ` (${j.destinatario})` : ''}:
        </p>

        <p className="mb-4 text-sm leading-relaxed">
          Por medio de la presente se hace constar que el(la) paciente{' '}
          <strong>{j.paciente_nombre}</strong>
          {j.paciente_edad != null ? `, de ${j.paciente_edad} años` : ''}
          {j.paciente_sexo ? `, sexo ${j.paciente_sexo}` : ''}, acudió a valoración médica en este
          establecimiento.
        </p>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p>
            <strong>Diagnóstico / motivo:</strong> {j.diagnostico}
          </p>
          {j.cie10 && (
            <p className="mt-1">
              <strong>CIE-10:</strong> {j.cie10}
            </p>
          )}
          {(j.fecha_inicio_reposo || j.fecha_fin_reposo || j.dias_reposo > 0) && (
            <p className="mt-1">
              <strong>Reposo sugerido:</strong>{' '}
              {j.fecha_inicio_reposo && j.fecha_fin_reposo
                ? `del ${formatFecha(j.fecha_inicio_reposo)} al ${formatFecha(j.fecha_fin_reposo)}`
                : 'según indicación clínica'}
              {j.dias_reposo > 0 ? ` (${j.dias_reposo} día${j.dias_reposo === 1 ? '' : 's'})` : ''}
            </p>
          )}
        </div>

        {j.recomendaciones && (
          <p className="mb-3 text-sm leading-relaxed">
            <strong>Recomendaciones:</strong> {j.recomendaciones}
          </p>
        )}
        {j.observaciones && (
          <p className="mb-3 text-sm leading-relaxed">
            <strong>Observaciones:</strong> {j.observaciones}
          </p>
        )}

        <p className="mb-8 text-sm leading-relaxed">
          Se expide el presente justificante para los fines que al interesado convengan.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div className="text-center text-sm">
            <div className="mx-auto mb-2 h-16 border-b border-slate-400" />
            <p className="font-semibold">{profesional?.nombre_profesional || j.author_label}</p>
            {profesional?.especialidad && <p className="text-xs text-slate-600">{profesional.especialidad}</p>}
            <p className="text-xs text-slate-600">
              Céd. Prof. {profesional?.cedula_profesional || '—'}
            </p>
          </div>
          <div className="text-center text-sm">
            <div className="mx-auto mb-2 h-16 border-b border-slate-400" />
            <p className="font-semibold">Sello del establecimiento</p>
            <p className="text-xs text-slate-600">{profesional?.institucion}</p>
          </div>
        </div>

        <p className="mt-8 text-[10px] leading-relaxed text-slate-500">{JUSTIFICANTE_DISCLAIMER}</p>
        <p className="mt-1 text-[10px] text-slate-400">
          Emitido en ContacNeed · Expediente clínico · {j.folio} · {j.author_label}
        </p>
      </article>
    </div>
  )
}

export default JustificantesView
