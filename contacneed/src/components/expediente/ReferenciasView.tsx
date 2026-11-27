import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeftRight,
  Loader2,
  Plus,
  Printer,
  Search,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import {
  createExpedienteReferenciaFn,
  listExpedientePacientesFn,
  listExpedienteReferenciasFn,
  softDeleteExpedienteReferenciaFn,
} from '../../server/expediente.functions'
import {
  REFERENCIA_TIPOS,
  REFERENCIA_URGENCIAS,
  calcEdad,
  type ReferenciaTipo,
  type ReferenciaUrgencia,
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

function tituloDoc(tipo: string) {
  if (tipo === 'contrarreferencia') return 'CONTRARREFERENCIA'
  if (tipo === 'interconsulta') return 'SOLICITUD DE INTERCONSULTA'
  return 'REFERENCIA MÉDICA'
}

type Props = {
  profesional: Row | null
  prefillPacienteId?: string | null
}

export function ReferenciasView({ profesional, prefillPacienteId }: Props) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<ReferenciaTipo | 'todos'>('todos')
  const [mode, setMode] = useState<'list' | 'new' | 'print'>('list')
  const [selected, setSelected] = useState<Row | null>(null)
  const [error, setError] = useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['expediente', 'referencias', q, filtroTipo],
    queryFn: () =>
      listExpedienteReferenciasFn({
        data: {
          q,
          tipo: filtroTipo === 'todos' ? undefined : filtroTipo,
        },
      }),
  })
  const pacientesQ = useQuery({
    queryKey: ['expediente', 'pacientes', 'ref'],
    queryFn: () => listExpedientePacientesFn({ data: { filtro: 'todos' } }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => softDeleteExpedienteReferenciaFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expediente', 'referencias'] })
      setSelected(null)
      setMode('list')
    },
    onError: (e) => setError(errMsg(e)),
  })

  useEffect(() => {
    if (prefillPacienteId) setMode('new')
  }, [prefillPacienteId])

  const rows = (listQ.data?.referencias as Row[] | undefined) || []

  if (mode === 'new') {
    return (
      <ReferenciaForm
        profesional={profesional}
        pacientes={(pacientesQ.data?.pacientes as Row[] | undefined) || []}
        prefillPacienteId={prefillPacienteId}
        onCancel={() => setMode('list')}
        onCreated={(r) => {
          qc.invalidateQueries({ queryKey: ['expediente', 'referencias'] })
          setSelected(r)
          setMode('print')
        }}
      />
    )
  }

  if (mode === 'print' && selected) {
    return (
      <ReferenciaPrint
        referencia={selected}
        profesional={profesional}
        onBack={() => setMode('list')}
        onDelete={() => {
          if (window.confirm(`¿Archivar ${selected.folio}?`)) delMut.mutate(selected.id)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Buscar folio, paciente, especialidad…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className={`${inputCls} w-auto min-w-[160px]`}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as ReferenciaTipo | 'todos')}
        >
          <option value="todos">Todos los tipos</option>
          {REFERENCIA_TIPOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="button" className={btnPrimary} onClick={() => setMode('new')}>
          <Plus className="h-4 w-4" /> Nueva
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
        Referencia (envías al paciente), contrarreferencia (respondes al que te lo envió) e interconsulta (pides
        opinión a otra especialidad). Incluyen logo, cédula y folio imprimible.
      </p>

      {listQ.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando referencias…
        </div>
      ) : rows.length === 0 ? (
        <div className={`${glass} p-8 text-center text-sm text-slate-400`}>
          Aún no hay referencias ni interconsultas.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`${glass} w-full p-4 text-left transition hover:border-cyan-400/40`}
                onClick={() => {
                  setSelected(r)
                  setMode('print')
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{r.paciente_nombre}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.folio} · {REFERENCIA_TIPOS.find((t) => t.id === r.tipo)?.label || r.tipo}
                      {r.urgencia !== 'ordinaria' ? ` · ${r.urgencia}` : ''}
                    </p>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 shrink-0 text-emerald-300" />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-300">{r.motivo}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {r.especialidad_destino || r.establecimiento_destino || 'Sin destino'} ·{' '}
                  {formatFechaCorta(r.fecha_emision)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReferenciaForm({
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
  onCreated: (r: Row) => void
}) {
  const [pacienteId, setPacienteId] = useState(prefillPacienteId || '')
  const [tipo, setTipo] = useState<ReferenciaTipo>('referencia')
  const [urgencia, setUrgencia] = useState<ReferenciaUrgencia>('ordinaria')
  const [destinatario, setDestinatario] = useState('')
  const [establecimiento, setEstablecimiento] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [medicoDestino, setMedicoDestino] = useState('')
  const [nombre, setNombre] = useState('')
  const [edad, setEdad] = useState('')
  const [sexo, setSexo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [resumen, setResumen] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [cie10, setCie10] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [estudios, setEstudios] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')
  const [emision, setEmision] = useState(hoyISO())
  const [lugar, setLugar] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pacienteId) return
    const p = pacientes.find((x) => x.id === pacienteId)
    if (!p) return
    setNombre(String(p.nombre_completo || ''))
    setSexo(String(p.sexo || ''))
    const e = calcEdad(String(p.fecha_nacimiento || ''))
    setEdad(e == null ? '' : String(e))
    if (p.diagnostico) setDiagnostico(String(p.diagnostico))
    if (p.padecimiento_actual) setResumen(String(p.padecimiento_actual))
    if (p.plan_terapeutico) setTratamiento(String(p.plan_terapeutico))
    if (p.laboratorios) setEstudios(String(p.laboratorios))
  }, [pacienteId, pacientes])

  const tipoMeta = REFERENCIA_TIPOS.find((t) => t.id === tipo)

  const mut = useMutation({
    mutationFn: () =>
      createExpedienteReferenciaFn({
        data: {
          pacienteId: pacienteId || undefined,
          tipo,
          urgencia,
          destinatario,
          establecimiento_destino: establecimiento,
          especialidad_destino: especialidad,
          medico_destino: medicoDestino,
          paciente_nombre: nombre,
          paciente_edad: edad ? Number(edad) : null,
          paciente_sexo: sexo || undefined,
          motivo,
          resumen_clinico: resumen,
          diagnostico,
          cie10,
          tratamiento_otorgado: tratamiento,
          estudios_realizados: estudios,
          pregunta_interconsulta: pregunta,
          respuesta_consultor: respuesta,
          recomendaciones,
          fecha_emision: emision,
          lugar_emision: lugar || undefined,
        },
      }),
    onSuccess: (res) => onCreated(res.referencia as Row),
    onError: (e) => setError(errMsg(e)),
  })

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
        <h3 className="text-sm font-bold text-emerald-200">Nueva referencia / interconsulta</h3>
        {tipoMeta && <p className="text-[11px] text-slate-500">{tipoMeta.hint}</p>}
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
              onChange={(e) => setTipo(e.target.value as ReferenciaTipo)}
            >
              {REFERENCIA_TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Urgencia</label>
            <select
              className={inputCls}
              value={urgencia}
              onChange={(e) => setUrgencia(e.target.value as ReferenciaUrgencia)}
            >
              {REFERENCIA_URGENCIAS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
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
            <label className={labelCls}>
              {tipo === 'contrarreferencia' ? 'Establecimiento / médico origen' : 'Establecimiento destino'}
            </label>
            <input
              className={inputCls}
              value={establecimiento}
              onChange={(e) => setEstablecimiento(e.target.value)}
              placeholder="Hospital, clínica, unidad…"
            />
          </div>
          <div>
            <label className={labelCls}>Especialidad</label>
            <input
              className={inputCls}
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Traumatología, Medicina interna…"
            />
          </div>
          <div>
            <label className={labelCls}>Médico destino / consultor</label>
            <input className={inputCls} value={medicoDestino} onChange={(e) => setMedicoDestino(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Destinatario (opcional)</label>
            <input
              className={inputCls}
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="A quien corresponda"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Motivo *</label>
            <textarea
              className={inputCls}
              rows={2}
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === 'interconsulta'
                  ? 'Motivo por el que se solicita la opinión…'
                  : 'Motivo de envío / transferencia…'
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Resumen clínico</label>
            <textarea className={inputCls} rows={3} value={resumen} onChange={(e) => setResumen(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Diagnóstico</label>
            <input className={inputCls} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CIE-10</label>
            <input
              className={inputCls}
              value={cie10}
              onChange={(e) => setCie10(e.target.value.toUpperCase())}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Tratamiento otorgado / en curso</label>
            <textarea
              className={inputCls}
              rows={2}
              value={tratamiento}
              onChange={(e) => setTratamiento(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Estudios realizados</label>
            <textarea className={inputCls} rows={2} value={estudios} onChange={(e) => setEstudios(e.target.value)} />
          </div>
          {(tipo === 'interconsulta' || tipo === 'referencia') && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Pregunta / solicitud específica</label>
              <textarea
                className={inputCls}
                rows={2}
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder="¿Qué se pide valorar o decidir?"
              />
            </div>
          )}
          {(tipo === 'contrarreferencia' || tipo === 'interconsulta') && (
            <div className="sm:col-span-2">
              <label className={labelCls}>
                {tipo === 'contrarreferencia' ? 'Respuesta / hallazgos' : 'Opinión del consultor (si ya existe)'}
              </label>
              <textarea
                className={inputCls}
                rows={3}
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Recomendaciones / plan de continuidad</label>
            <textarea
              className={inputCls}
              rows={2}
              value={recomendaciones}
              onChange={(e) => setRecomendaciones(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha *</label>
            <input type="date" className={inputCls} required value={emision} onChange={(e) => setEmision(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Lugar</label>
            <input
              className={inputCls}
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ciudad, Estado"
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
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
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

function ReferenciaPrint({
  referencia,
  profesional,
  onBack,
  onDelete,
}: {
  referencia: Row
  profesional: Row | null
  onBack: () => void
  onDelete: () => void
}) {
  const r = referencia
  const lugarFecha = `${r.lugar_emision ? `${r.lugar_emision}, ` : ''}a ${formatFechaLarga(r.fecha_emision)}`
  const urgenciaLabel = REFERENCIA_URGENCIAS.find((u) => u.id === r.urgencia)?.label || r.urgencia

  const bloque = (label: string, value?: string | null) =>
    value ? (
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-justify">{value}</p>
      </div>
    ) : null

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
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <header className="mb-6 flex items-start gap-4 border-b border-slate-300 pb-4">
          {profesional?.logo_url ? (
            <img src={String(profesional.logo_url)} alt="Logo" className="h-16 w-16 object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">{profesional?.institucion || 'Establecimiento médico'}</p>
            <p className="text-xs text-slate-600">
              {profesional?.tipo_establecimiento}
              {profesional?.domicilio_establecimiento ? ` · ${profesional.domicilio_establecimiento}` : ''}
            </p>
            {profesional?.telefono_institucional && (
              <p className="text-xs text-slate-600">Tel. {profesional.telefono_institucional}</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-bold text-slate-800">{r.folio}</p>
            <p className="uppercase">{urgenciaLabel}</p>
          </div>
        </header>

        <h1 className="mb-2 text-center text-lg font-black tracking-wide">{tituloDoc(String(r.tipo))}</h1>
        <p className="mb-6 text-right text-sm">{lugarFecha}</p>

        <p className="mb-4 text-sm">
          {r.destinatario || 'A quien corresponda'}
          {r.medico_destino ? ` / ${r.medico_destino}` : ''}:
        </p>

        <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <p>
            <strong>Paciente:</strong> {r.paciente_nombre}
            {r.paciente_edad != null ? `, ${r.paciente_edad} años` : ''}
            {r.paciente_sexo ? `, ${r.paciente_sexo}` : ''}
          </p>
          {r.establecimiento_destino && (
            <p>
              <strong>
                {r.tipo === 'contrarreferencia' ? 'Origen / destino:' : 'Destino:'}
              </strong>{' '}
              {r.establecimiento_destino}
            </p>
          )}
          {r.especialidad_destino && (
            <p>
              <strong>Especialidad:</strong> {r.especialidad_destino}
            </p>
          )}
          {r.diagnostico && (
            <p>
              <strong>Diagnóstico:</strong> {r.diagnostico}
              {r.cie10 ? ` (${r.cie10})` : ''}
            </p>
          )}
        </div>

        {bloque('Motivo', r.motivo)}
        {bloque('Resumen clínico', r.resumen_clinico)}
        {bloque('Tratamiento otorgado', r.tratamiento_otorgado)}
        {bloque('Estudios realizados', r.estudios_realizados)}
        {bloque('Pregunta / solicitud', r.pregunta_interconsulta)}
        {bloque(
          r.tipo === 'contrarreferencia' ? 'Respuesta / hallazgos' : 'Opinión del consultor',
          r.respuesta_consultor,
        )}
        {bloque('Recomendaciones / continuidad', r.recomendaciones)}

        <p className="mb-10 text-sm leading-relaxed text-justify">
          Se remite el presente documento para los fines clínicos correspondientes, quedando a sus
          órdenes para cualquier ampliación de información.
        </p>

        <div className="mt-10 text-center text-sm">
          <p className="mb-8 font-semibold tracking-wide">ATENTAMENTE:</p>
          <div className="mx-auto mb-2 h-14 w-56 border-b border-slate-500" />
          <p className="font-semibold">{firmaLinea(profesional, r.author_label)}</p>
          {profesional?.especialidad && (
            <p className="text-xs text-slate-600">{profesional.especialidad}</p>
          )}
          <p className="text-sm">C.P. {profesional?.cedula_profesional || '—'}</p>
        </div>

        <p className="mt-8 text-[9px] text-slate-500">
          Documento clínico ContacNeed · {r.folio} · No sustituye formatos oficiales institucionales cuando
          apliquen.
        </p>
      </article>
    </div>
  )
}

export default ReferenciasView
