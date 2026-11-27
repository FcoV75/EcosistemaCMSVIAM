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
  buildEctoscopiaDraft,
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

function formatFechaLarga(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatFechaCorta(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
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
    if (prefillPacienteId) setMode('new')
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
        Constancia narrativa al estilo de tu consultorio (logo + clínica + cédula). Ideal cuando el superior pide
        comprobante. {JUSTIFICANTE_DISCLAIMER}
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
                  Emitido {formatFechaCorta(j.fecha_emision)}
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
  const [ocupacion, setOcupacion] = useState('')
  const [estadoCivil, setEstadoCivil] = useState('')
  const [alergias, setAlergias] = useState('')
  const [motivoAtencion, setMotivoAtencion] = useState(
    'una valoración y tratamiento',
  )
  const [diagnostico, setDiagnostico] = useState('')
  const [cie10, setCie10] = useState('')
  const [ectoscopia, setEctoscopia] = useState('')
  const [plan, setPlan] = useState('')
  const [emision, setEmision] = useState(hoyISO())
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')
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
    setOcupacion(String(p.ocupacion || ''))
    setAlergias(String(p.alergias || ''))
    if (p.diagnostico) setDiagnostico(String(p.diagnostico))
    if (p.plan_terapeutico) setPlan(String(p.plan_terapeutico))
    setEctoscopia(
      buildEctoscopiaDraft({
        sexo: String(p.sexo || ''),
        edad: e,
        ocupacion: String(p.ocupacion || ''),
        estado_civil: estadoCivil || undefined,
        alergias: String(p.alergias || ''),
        ahf: String(p.ahf || ''),
        app: String(p.app || ''),
      }),
    )
  }, [pacienteId, pacientes]) // eslint-disable-line react-hooks/exhaustive-deps

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
          ocupacion,
          estado_civil: estadoCivil,
          alergias,
          motivo_atencion: motivoAtencion,
          ectoscopia,
          plan_tratamiento: plan,
          diagnostico,
          cie10,
          fecha_emision: emision,
          fecha_inicio_reposo: inicio || undefined,
          fecha_fin_reposo: fin || undefined,
          dias_reposo: dias,
          recomendaciones,
          observaciones,
          lugar_emision: lugar || undefined,
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
        <h3 className="text-sm font-bold text-cyan-200">Nueva constancia / justificante</h3>
        <p className="text-[11px] text-slate-500">
          Formato de carta como el que usas en consultorio: lugar y fecha, “A quien corresponda”, narrativa clínica,
          ectoscopía, plan y cierre “ATENTAMENTE” con C.P.
        </p>
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
            <label className={labelCls}>Destinatario (opcional)</label>
            <input
              className={inputCls}
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Vacío = A quien corresponda"
            />
          </div>
          <div>
            <label className={labelCls}>Lugar de emisión</label>
            <input
              className={inputCls}
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ej. Aguascalientes, Ags."
            />
          </div>
          <div>
            <label className={labelCls}>Fecha de emisión *</label>
            <input type="date" className={inputCls} required value={emision} onChange={(e) => setEmision(e.target.value)} />
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
          <div>
            <label className={labelCls}>Estado civil</label>
            <input
              className={inputCls}
              value={estadoCivil}
              onChange={(e) => setEstadoCivil(e.target.value)}
              placeholder="casado, soltero…"
            />
          </div>
          <div>
            <label className={labelCls}>Ocupación</label>
            <input className={inputCls} value={ocupacion} onChange={(e) => setOcupacion(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Motivo de presentación (frase corta)</label>
            <input
              className={inputCls}
              value={motivoAtencion}
              onChange={(e) => setMotivoAtencion(e.target.value)}
              placeholder="una valoración y tratamiento fisioterapéutico"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Diagnóstico / motivo clínico *</label>
            <textarea
              className={inputCls}
              rows={3}
              required
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Ej. rehabilitación osteoneuromuscular posterior a…"
            />
          </div>
          <div>
            <label className={labelCls}>CIE-10 (opcional)</label>
            <input
              className={inputCls}
              value={cie10}
              onChange={(e) => setCie10(e.target.value.toUpperCase())}
              placeholder="Ej. S92.0"
            />
          </div>
          <div>
            <label className={labelCls}>Alergias</label>
            <input className={inputCls} value={alergias} onChange={(e) => setAlergias(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Ectoscopía / ficha clínica</label>
            <textarea
              className={inputCls}
              rows={3}
              value={ectoscopia}
              onChange={(e) => setEctoscopia(e.target.value)}
              placeholder="En la ectoscopía encontramos a paciente…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Plan / sesiones / tratamiento</label>
            <textarea
              className={inputCls}
              rows={4}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Se opta por programar N sesiones… modalidades…"
            />
          </div>
          <div>
            <label className={labelCls}>Inicio de reposo (opcional)</label>
            <input type="date" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fin de reposo (opcional)</label>
            <input type="date" className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Días de reposo</label>
            <input className={inputCls} readOnly value={dias ? String(dias) : '0'} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Recomendaciones adicionales</label>
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

function firmaLinea(profesional: Row | null, authorLabel?: string) {
  const titulo = String(profesional?.titulo_abreviado || '').trim()
  const nombre = String(profesional?.nombre_profesional || authorLabel || 'Profesional tratante').trim()
  return titulo ? `${titulo} ${nombre}` : nombre
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
  const institucion = String(profesional?.institucion || 'el establecimiento médico')
  const motivo = String(j.motivo_atencion || 'una valoración y tratamiento').trim()
  const lugarFecha = `${j.lugar_emision ? `${j.lugar_emision}, ` : ''}a ${formatFechaLarga(j.fecha_emision)}`

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
        className="mx-auto max-w-[800px] rounded-2xl border border-slate-300 bg-white p-10 text-slate-900 shadow-lg print:border-0 print:p-0 print:shadow-none"
        id="justificante-print"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <header className="mb-8 flex items-start gap-4">
          {profesional?.logo_url ? (
            <img
              src={String(profesional.logo_url)}
              alt="Logo clínica"
              className="h-20 w-20 object-contain"
            />
          ) : null}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-base font-bold leading-tight tracking-wide">
              {profesional?.institucion || 'Establecimiento médico'}
            </p>
            {profesional?.tipo_establecimiento && (
              <p className="text-xs text-slate-600">{profesional.tipo_establecimiento}</p>
            )}
            {profesional?.domicilio_establecimiento && (
              <p className="text-xs text-slate-600">{profesional.domicilio_establecimiento}</p>
            )}
            {profesional?.telefono_institucional && (
              <p className="text-xs text-slate-600">Tel. {profesional.telefono_institucional}</p>
            )}
          </div>
          <div className="hidden text-right text-[10px] text-slate-500 sm:block">
            <p>{j.folio}</p>
          </div>
        </header>

        <p className="mb-6 text-right text-sm leading-relaxed">{lugarFecha}</p>

        <p className="mb-1 text-sm font-semibold">
          {j.destinatario ? String(j.destinatario) : 'A quien corresponda'}:
        </p>
        <p className="mb-5 text-sm">Presente:</p>

        <p className="mb-4 text-sm leading-relaxed text-justify">
          Por medio de la presente se extiende constancia que se ha presentado al{' '}
          <strong>{institucion}</strong> para {motivo} el paciente{' '}
          <strong>{j.paciente_nombre}</strong>
          {j.diagnostico ? <> para {j.diagnostico}{j.cie10 ? ` (${j.cie10})` : ''}.</> : '.'}
        </p>

        {j.ectoscopia && (
          <p className="mb-4 text-sm leading-relaxed text-justify">{j.ectoscopia}</p>
        )}

        {j.plan_tratamiento && (
          <p className="mb-4 text-sm leading-relaxed text-justify">{j.plan_tratamiento}</p>
        )}

        {(j.fecha_inicio_reposo || j.fecha_fin_reposo || j.dias_reposo > 0) && (
          <p className="mb-4 text-sm leading-relaxed text-justify">
            Se sugiere reposo
            {j.fecha_inicio_reposo && j.fecha_fin_reposo
              ? ` del ${formatFechaLarga(j.fecha_inicio_reposo)} al ${formatFechaLarga(j.fecha_fin_reposo)}`
              : ''}
            {j.dias_reposo > 0
              ? ` (${j.dias_reposo} día${j.dias_reposo === 1 ? '' : 's'})`
              : ''}
            .
          </p>
        )}

        {j.recomendaciones && (
          <p className="mb-4 text-sm leading-relaxed text-justify">{j.recomendaciones}</p>
        )}
        {j.observaciones && (
          <p className="mb-4 text-sm leading-relaxed text-justify">{j.observaciones}</p>
        )}

        <p className="mb-10 text-sm leading-relaxed text-justify">
          Sin más que referir por el momento y a petición del paciente para los fines que a su persona
          convengan se extiende este documento quedando como su servidor.
        </p>

        <div className="mt-12 text-center text-sm">
          <p className="mb-8 font-semibold tracking-wide">ATENTAMENTE:</p>
          <div className="mx-auto mb-2 h-14 w-56 border-b border-slate-500" />
          <p className="font-semibold">{firmaLinea(profesional, j.author_label)}</p>
          {profesional?.especialidad && (
            <p className="text-xs text-slate-600">{profesional.especialidad}</p>
          )}
          <p className="text-sm">C.P. {profesional?.cedula_profesional || '—'}</p>
          {profesional?.institucion && (
            <p className="mt-1 text-xs text-slate-600">{profesional.institucion}</p>
          )}
        </div>

        <p className="mt-10 text-[9px] leading-relaxed text-slate-500 print:text-slate-600">
          {JUSTIFICANTE_DISCLAIMER} · {j.folio}
        </p>
      </article>
    </div>
  )
}

export default JustificantesView
