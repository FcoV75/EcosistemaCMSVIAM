import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Download,
  FilePlus2,
  FileText,
  Loader2,
  Mic,
  Plus,
  Printer,
  Search,
  Settings,
  Square,
  Stethoscope,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  addExpedienteNotaFn,
  buscarMiembroParaExpedienteFn,
  createExpedientePacienteFn,
  exportExpedienteBackupFn,
  exportExpedientePacienteFn,
  getExpedientePacienteFn,
  getExpedienteProfesionalFn,
  listExpedientePacientesFn,
  saveExpedienteProfesionalFn,
  softDeleteExpedientePacienteFn,
  updateExpedienteEstatusFn,
} from '../../server/expediente.functions'
import {
  EXPEDIENTE_PRECIOS_PUBLICOS,
  EXPEDIENTE_RAMAS,
  NOTA_TIPOS,
  OTROS_REGISTROS_SUGERIDOS,
  calcEdad,
  calcImc,
} from '../../lib/expediente-clinico'
import { uploadFileToCloudinary } from '../../lib/cloudinary-upload'

type Props = { variant?: 'page' | 'embedded'; title?: string }
type View = 'patients' | 'new' | 'detail' | 'settings' | 'normativa'
type Filtro = 'todos' | 'miembros' | 'no_miembros' | 'activo' | 'alta'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'miembros', label: 'Miembros' },
  { id: 'no_miembros', label: 'No miembros' },
  { id: 'activo', label: 'Activos' },
  { id: 'alta', label: 'Alta' },
]

const GRUPOS_SANGUINEOS = ['No referido', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const inputCls =
  'w-full rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400/70 focus:ring-1 focus:ring-cyan-400/40'
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-50'
const glass = 'rounded-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-black/20'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado'
}

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function Field({
  label,
  required,
  children,
  className = '',
}: {
  label: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
        {required && <span className="text-emerald-400"> *</span>}
      </span>
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${glass} space-y-3 p-4`}>
      <h3 className="text-sm font-semibold text-cyan-300">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{msg}</div>
  )
}

type PacienteForm = {
  es_miembro: boolean
  miembro_user_id: string
  miembro_email: string
  miembro_codigo_cms: string
  nombre_completo: string
  fecha_nacimiento: string
  sexo: 'Femenino' | 'Masculino' | 'Intersexual'
  curp: string
  grupo_sanguineo: string
  telefono: string
  domicilio: string
  ocupacion: string
  contacto_emergencia: string
  alergias: string
  ahf: string
  app: string
  apnp: string
  ago: string
  padecimiento_actual: string
  interrogatorio_sistemas: string
  ta: string
  fc: string
  fr: string
  temp: string
  spo2: string
  weight: string
  height: string
  exploracion_fisica: string
  laboratorios: string
  diagnostico: string
  plan_terapeutico: string
  pronostico: string
}

const EMPTY_FORM: PacienteForm = {
  es_miembro: false,
  miembro_user_id: '',
  miembro_email: '',
  miembro_codigo_cms: '',
  nombre_completo: '',
  fecha_nacimiento: '',
  sexo: 'Femenino',
  curp: '',
  grupo_sanguineo: 'No referido',
  telefono: '',
  domicilio: '',
  ocupacion: '',
  contacto_emergencia: '',
  alergias: '',
  ahf: '',
  app: '',
  apnp: '',
  ago: '',
  padecimiento_actual: '',
  interrogatorio_sistemas: '',
  ta: '',
  fc: '',
  fr: '',
  temp: '',
  spo2: '',
  weight: '',
  height: '',
  exploracion_fisica: '',
  laboratorios: '',
  diagnostico: '',
  plan_terapeutico: '',
  pronostico: '',
}

export function ExpedienteClinicoApp({ variant = 'page', title }: Props) {
  const qc = useQueryClient()
  const [view, setView] = useState<View>('patients')
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [exportError, setExportError] = useState<string | null>(null)

  const profQuery = useQuery({
    queryKey: ['expediente', 'profesional'],
    queryFn: () => getExpedienteProfesionalFn(),
  })
  const profesional = profQuery.data?.profesional as Row | null | undefined
  const profesionalListo = Boolean(profesional?.cedula_profesional)
  const forzarAjustes = profQuery.isSuccess && !profesionalListo

  useEffect(() => {
    if (forzarAjustes && view !== 'settings' && view !== 'normativa') setView('settings')
  }, [forzarAjustes, view])

  const listQuery = useQuery({
    queryKey: ['expediente', 'pacientes', q, filtro],
    queryFn: () => listExpedientePacientesFn({ data: { q, filtro } }),
    enabled: profesionalListo,
  })

  const exportMut = useMutation({
    mutationFn: () => exportExpedienteBackupFn(),
    onSuccess: (data) => {
      setExportError(null)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expediente-respaldo-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
    onError: (e) => setExportError(errMsg(e)),
  })
  const exportNubeMut = useMutation({
    mutationFn: async () => {
      const data = await exportExpedienteBackupFn()
      const file = new File(
        [JSON.stringify(data, null, 2)],
        `expediente-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
        { type: 'application/json' },
      )
      return uploadFileToCloudinary(file)
    },
    onSuccess: (cloudUrl) => {
      setExportError(null)
      window.open(cloudUrl, '_blank', 'noopener,noreferrer')
      window.alert('Respaldo completo subido a la nube ContacNeed. Conserva el enlace.')
    },
    onError: (e) => setExportError(errMsg(e)),
  })

  const openDetail = (id: string) => {
    setPacienteId(id)
    setView('detail')
  }

  const navBtn = (id: View, label: string, icon: ReactNode, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setView(id)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
        view === id
          ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50'
          : 'text-slate-300 hover:bg-slate-800/70'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  const wrapper =
    variant === 'page'
      ? 'min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-slate-100'
      : 'rounded-2xl bg-slate-950/70 p-3 text-slate-100'

  return (
    <div className={wrapper}>
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 ring-1 ring-cyan-400/40">
              <Stethoscope className="h-5 w-5 text-cyan-300" />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-tight text-white">{title || 'Expediente clínico'}</h2>
              <p className="text-[11px] text-slate-400">NOM-004-SSA3-2012 · Registro profesional seguro</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {navBtn('patients', 'Pacientes', <Users className="h-3.5 w-3.5" />, forzarAjustes)}
            {navBtn('new', 'Nuevo', <FilePlus2 className="h-3.5 w-3.5" />, forzarAjustes)}
            {navBtn('settings', 'Profesional', <Settings className="h-3.5 w-3.5" />)}
            {navBtn('normativa', 'Normativa', <BookOpen className="h-3.5 w-3.5" />)}
            <button
              type="button"
              className={btnGhost}
              disabled={exportMut.isPending || forzarAjustes}
              onClick={() => exportMut.mutate()}
            >
              {exportMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Respaldo JSON
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={exportNubeMut.isPending || forzarAjustes}
              onClick={() => exportNubeMut.mutate()}
              title="Sube el respaldo completo a Cloudinary"
            >
              {exportNubeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Respaldo en nube
            </button>
          </nav>
        </header>

        <ErrorBox msg={exportError} />

        {profQuery.isLoading && (
          <div className={`${glass} flex items-center gap-2 p-6 text-sm text-slate-300`}>
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> Cargando expediente…
          </div>
        )}
        {profQuery.isError && <ErrorBox msg={errMsg(profQuery.error)} />}

        {forzarAjustes && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Antes de crear expedientes captura tu cédula profesional y los datos del establecimiento (NOM-004, numeral 5.2).
          </div>
        )}

        {profQuery.isSuccess && view === 'patients' && (
          <PatientsView
            q={q}
            setQ={setQ}
            filtro={filtro}
            setFiltro={setFiltro}
            loading={listQuery.isLoading}
            error={listQuery.isError ? errMsg(listQuery.error) : null}
            pacientes={(listQuery.data?.pacientes as Row[] | undefined) || []}
            conteos={listQuery.data?.conteos}
            onOpen={openDetail}
            onNew={() => setView('new')}
          />
        )}
        {profQuery.isSuccess && view === 'new' && (
          <NewPatientView
            onCancel={() => setView('patients')}
            onCreated={(id) => {
              qc.invalidateQueries({ queryKey: ['expediente', 'pacientes'] })
              openDetail(id)
            }}
          />
        )}
        {profQuery.isSuccess && view === 'detail' && pacienteId && (
          <DetailView
            pacienteId={pacienteId}
            onBack={() => setView('patients')}
            onDeleted={() => {
              qc.invalidateQueries({ queryKey: ['expediente', 'pacientes'] })
              setPacienteId(null)
              setView('patients')
            }}
          />
        )}
        {profQuery.isSuccess && view === 'settings' && (
          <SettingsView
            profesional={profesional || null}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['expediente', 'profesional'] })
              setView('patients')
            }}
          />
        )}
        {view === 'normativa' && <NormativaView />}
      </div>
    </div>
  )
}

export default ExpedienteClinicoApp

function PatientsView({
  q,
  setQ,
  filtro,
  setFiltro,
  loading,
  error,
  pacientes,
  conteos,
  onOpen,
  onNew,
}: {
  q: string
  setQ: (v: string) => void
  filtro: Filtro
  setFiltro: (f: Filtro) => void
  loading: boolean
  error: string | null
  pacientes: Row[]
  conteos?: { total: number; miembros: number; no_miembros: number; activos: number }
  onOpen: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="space-y-3">
      <div className={`${glass} space-y-3 p-3`}>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Buscar por nombre, expediente, diagnóstico, correo o código CMS"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className={btnPrimary} onClick={onNew}>
            <Plus className="h-4 w-4" /> Nuevo expediente
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filtro === f.id
                  ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              {f.label}
            </button>
          ))}
          {conteos && (
            <span className="ml-auto text-[11px] text-slate-500">
              {conteos.total} total · {conteos.miembros} miembros · {conteos.activos} activos
            </span>
          )}
        </div>
      </div>

      <ErrorBox msg={error} />
      {loading && (
        <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
        </div>
      )}
      {!loading && !error && pacientes.length === 0 && (
        <div className={`${glass} p-8 text-center text-sm text-slate-400`}>
          No hay expedientes que coincidan. Crea el primero con “Nuevo expediente”.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {pacientes.map((p) => {
          const edad = calcEdad(String(p.fecha_nacimiento || ''))
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p.id)}
              className={`${glass} p-4 text-left transition hover:border-cyan-400/50`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{p.nombre_completo}</p>
                  <p className="text-[11px] text-slate-400">
                    {p.numero_expediente}
                    {edad !== null && ` · ${edad} años`}
                    {p.sexo && ` · ${p.sexo}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.es_miembro ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 ring-1 ring-cyan-400/40">
                      <BadgeCheck className="h-3 w-3" /> Miembro
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-300">No miembro</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      p.estatus === 'activo' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    {p.estatus}
                  </span>
                </div>
              </div>
              {p.diagnostico && <p className="mt-2 line-clamp-2 text-xs text-slate-300">Dx: {p.diagnostico}</p>}
              {p.alergias && !/^(ninguna|niega|n\/a|sin)/i.test(String(p.alergias).trim()) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> Alergias: {p.alergias}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NewPatientView({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState<PacienteForm>(EMPTY_FORM)
  const [miembroQ, setMiembroQ] = useState('')
  const [matches, setMatches] = useState<Row[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PacienteForm>(k: K, v: PacienteForm[K]) => setF((prev) => ({ ...prev, [k]: v }))
  const imc = useMemo(() => calcImc(f.weight, f.height), [f.weight, f.height])
  const edad = calcEdad(f.fecha_nacimiento)

  const buscar = async () => {
    setBuscando(true)
    setError(null)
    try {
      const res = await buscarMiembroParaExpedienteFn({ data: { q: miembroQ } })
      setMatches((res.matches as Row[]) || [])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBuscando(false)
    }
  }

  const elegirMiembro = (m: Row) => {
    setF((prev) => ({
      ...prev,
      miembro_user_id: String(m.userId || ''),
      miembro_email: String(m.email || ''),
      miembro_codigo_cms: String(m.legacyCode || ''),
      nombre_completo: prev.nombre_completo || String(m.nombre || ''),
    }))
    setMatches([])
  }

  const mut = useMutation({
    mutationFn: () =>
      createExpedientePacienteFn({
        data: {
          es_miembro: f.es_miembro,
          miembro_user_id: f.miembro_user_id || undefined,
          miembro_email: f.miembro_email || undefined,
          miembro_codigo_cms: f.miembro_codigo_cms || undefined,
          nombre_completo: f.nombre_completo,
          fecha_nacimiento: f.fecha_nacimiento,
          sexo: f.sexo,
          curp: f.curp,
          grupo_sanguineo: f.grupo_sanguineo,
          telefono: f.telefono,
          domicilio: f.domicilio,
          ocupacion: f.ocupacion,
          contacto_emergencia: f.contacto_emergencia,
          alergias: f.alergias,
          ahf: f.ahf,
          app: f.app,
          apnp: f.apnp,
          ago: f.ago,
          padecimiento_actual: f.padecimiento_actual,
          interrogatorio_sistemas: f.interrogatorio_sistemas,
          vitals: {
            ta: f.ta,
            fc: f.fc,
            fr: f.fr,
            temp: f.temp,
            spo2: f.spo2,
            weight: f.weight,
            height: f.height,
            bmi: imc,
          },
          exploracion_fisica: f.exploracion_fisica,
          laboratorios: f.laboratorios,
          diagnostico: f.diagnostico,
          plan_terapeutico: f.plan_terapeutico,
          pronostico: f.pronostico,
        },
      }),
    onSuccess: (res) => onCreated(String((res.paciente as Row).id)),
    onError: (e) => setError(errMsg(e)),
  })

  const txt = (k: keyof PacienteForm, ph = '') => (
    <input
      className={inputCls}
      placeholder={ph}
      value={String(f[k])}
      onChange={(e) => set(k, e.target.value as never)}
    />
  )
  const area = (k: keyof PacienteForm, rows = 3) => (
    <textarea
      className={inputCls}
      rows={rows}
      value={String(f[k])}
      onChange={(e) => set(k, e.target.value as never)}
    />
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        mut.mutate()
      }}
    >
      <button type="button" className={btnGhost} onClick={onCancel}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className={`${glass} p-3`}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set('es_miembro', true)}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-bold transition ${
              f.es_miembro
                ? 'bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 text-cyan-100 ring-2 ring-cyan-400/60'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="h-5 w-5" /> Miembro
          </button>
          <button
            type="button"
            onClick={() => {
              setF((prev) => ({ ...prev, es_miembro: false, miembro_user_id: '', miembro_email: '', miembro_codigo_cms: '' }))
              setMatches([])
            }}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-bold transition ${
              !f.es_miembro
                ? 'bg-gradient-to-r from-slate-600/40 to-slate-500/30 text-white ring-2 ring-slate-400/50'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Users className="h-5 w-5" /> No miembro
          </button>
        </div>

        {f.es_miembro && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Buscar miembro por nombre, correo o código CMS-…"
                value={miembroQ}
                onChange={(e) => setMiembroQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void buscar()
                  }
                }}
              />
              <button type="button" className={btnPrimary} disabled={buscando || miembroQ.trim().length < 2} onClick={buscar}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </button>
            </div>
            {matches.map((m) => (
              <button
                key={String(m.userId)}
                type="button"
                onClick={() => elegirMiembro(m)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-left text-sm hover:border-cyan-400/50"
              >
                <span>
                  <span className="font-medium text-white">{String(m.nombre || 'Sin nombre')}</span>
                  <span className="ml-2 text-xs text-slate-400">{String(m.email || '')}</span>
                </span>
                <span className={`text-[10px] ${m.esMiembroCmsPlus ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {m.esMiembroCmsPlus ? `CMS-Plus ${String(m.nivel || '')} ${String(m.legacyCode || '')}` : 'Sin CMS-Plus'}
                </span>
              </button>
            ))}
            {f.miembro_user_id && (
              <p className="flex items-center gap-1 text-xs text-emerald-300">
                <BadgeCheck className="h-3.5 w-3.5" /> Vinculado: {f.miembro_email} {f.miembro_codigo_cms && `· ${f.miembro_codigo_cms}`}
              </p>
            )}
          </div>
        )}
      </div>

      <Section title="1. Ficha de identificación">
        <Field label="Nombre completo" required className="sm:col-span-2">{txt('nombre_completo')}</Field>
        <Field label={`Fecha de nacimiento${edad !== null ? ` (${edad} años)` : ''}`} required>
          <input type="date" className={inputCls} value={f.fecha_nacimiento} onChange={(e) => set('fecha_nacimiento', e.target.value)} />
        </Field>
        <Field label="Sexo" required>
          <select className={inputCls} value={f.sexo} onChange={(e) => set('sexo', e.target.value as PacienteForm['sexo'])}>
            <option>Femenino</option>
            <option>Masculino</option>
            <option>Intersexual</option>
          </select>
        </Field>
        <Field label="CURP">{txt('curp')}</Field>
        <Field label="Grupo sanguíneo">
          <select className={inputCls} value={f.grupo_sanguineo} onChange={(e) => set('grupo_sanguineo', e.target.value)}>
            {GRUPOS_SANGUINEOS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Teléfono" required>{txt('telefono')}</Field>
        <Field label="Ocupación">{txt('ocupacion')}</Field>
        <Field label="Domicilio" required className="sm:col-span-2">{txt('domicilio')}</Field>
        <Field label="Contacto de emergencia" className="sm:col-span-2">{txt('contacto_emergencia')}</Field>
      </Section>

      <Section title="2. Antecedentes">
        <Field label="Alergias (escribe “Ninguna conocida” si aplica)" required className="sm:col-span-2">{area('alergias', 2)}</Field>
        <Field label="Heredofamiliares (AHF)" required>{area('ahf')}</Field>
        <Field label="Personales patológicos (APP)" required>{area('app')}</Field>
        <Field label="Personales no patológicos (APNP)" required>{area('apnp')}</Field>
        <Field label="Gineco-obstétricos (si aplica)">{area('ago')}</Field>
      </Section>

      <Section title="3. Padecimiento actual e interrogatorio">
        <Field label="Padecimiento actual" required className="sm:col-span-2">{area('padecimiento_actual', 4)}</Field>
        <Field label="Interrogatorio por aparatos y sistemas" required className="sm:col-span-2">{area('interrogatorio_sistemas', 4)}</Field>
      </Section>

      <section className={`${glass} space-y-3 p-4`}>
        <h3 className="text-sm font-semibold text-cyan-300">4. Signos vitales y exploración física</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="T/A (mmHg)">{txt('ta', '120/80')}</Field>
          <Field label="FC (lpm)">{txt('fc')}</Field>
          <Field label="FR (rpm)">{txt('fr')}</Field>
          <Field label="Temp (°C)">{txt('temp')}</Field>
          <Field label="SpO₂ (%)">{txt('spo2')}</Field>
          <Field label="Peso (kg)">{txt('weight')}</Field>
          <Field label="Talla (m)">{txt('height', '1.70')}</Field>
          <Field label="IMC (auto)">
            <input className={`${inputCls} text-emerald-300`} readOnly value={imc} placeholder="—" />
          </Field>
        </div>
        <Field label="Exploración física" required>{area('exploracion_fisica', 4)}</Field>
      </section>

      <Section title="5. Resultados, diagnóstico y plan">
        <Field label="Laboratorio y gabinete" className="sm:col-span-2">{area('laboratorios', 2)}</Field>
        <Field label="Diagnóstico(s)" required className="sm:col-span-2">{area('diagnostico', 2)}</Field>
        <Field label="Plan terapéutico / tratamiento" required>{area('plan_terapeutico')}</Field>
        <Field label="Pronóstico" required>{area('pronostico')}</Field>
      </Section>

      <ErrorBox msg={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={btnPrimary} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Crear expediente
        </button>
      </div>
    </form>
  )
}

function DetailView({
  pacienteId,
  onBack,
  onDeleted,
}: {
  pacienteId: string
  onBack: () => void
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const key = ['expediente', 'paciente', pacienteId]
  const query = useQuery({ queryKey: key, queryFn: () => getExpedientePacienteFn({ data: { pacienteId } }) })
  const [error, setError] = useState<string | null>(null)

  const estatusMut = useMutation({
    mutationFn: (estatus: 'activo' | 'alta' | 'archivado') =>
      updateExpedienteEstatusFn({ data: { pacienteId, estatus } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['expediente', 'pacientes'] })
    },
    onError: (e) => setError(errMsg(e)),
  })
  const delMut = useMutation({
    mutationFn: () => softDeleteExpedientePacienteFn({ data: { pacienteId } }),
    onSuccess: onDeleted,
    onError: (e) => setError(errMsg(e)),
  })
  const exportPacienteMut = useMutation({
    mutationFn: () => exportExpedientePacienteFn({ data: { pacienteId } }),
    onSuccess: async (data) => {
      setError(null)
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const folio = String(data.paciente?.numero_expediente || pacienteId).replace(/\W+/g, '-')
      a.href = url
      a.download = `expediente-${folio}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
    onError: (e) => setError(errMsg(e)),
  })
  const nubeMut = useMutation({
    mutationFn: async () => {
      const data = await exportExpedientePacienteFn({ data: { pacienteId } })
      const json = JSON.stringify(data, null, 2)
      const folio = String(data.paciente?.numero_expediente || pacienteId).replace(/\W+/g, '-')
      const file = new File([json], `expediente-${folio}.json`, { type: 'application/json' })
      const cloudUrl = await uploadFileToCloudinary(file)
      return cloudUrl
    },
    onSuccess: (cloudUrl) => {
      setError(null)
      window.open(cloudUrl, '_blank', 'noopener,noreferrer')
      window.alert('Respaldo subido a tu nube ContacNeed (Cloudinary). Guarda el enlace en un lugar seguro.')
    },
    onError: (e) => setError(errMsg(e)),
  })

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando expediente…
      </div>
    )
  }
  if (query.isError) {
    return (
      <div className="space-y-3">
        <button type="button" className={btnGhost} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Volver</button>
        <ErrorBox msg={errMsg(query.error)} />
      </div>
    )
  }

  const p = query.data!.paciente as Row
  const notas = query.data!.notas as Row[]
  const prof = query.data!.profesional as Row | null
  const v = (p.vitals || {}) as Row
  const edad = calcEdad(String(p.fecha_nacimiento || ''))
  const alergiaReal = p.alergias && !/^(ninguna|niega|n\/a|sin)/i.test(String(p.alergias).trim())

  const bloque = (label: string, value?: string | null) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-200">{value || '—'}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" className={btnGhost} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Pacientes</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={exportPacienteMut.isPending}
            onClick={() => exportPacienteMut.mutate()}
          >
            {exportPacienteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar JSON
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={nubeMut.isPending}
            onClick={() => nubeMut.mutate()}
            title="Sube un respaldo JSON a Cloudinary y abre el enlace"
          >
            {nubeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Guardar en nube
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={estatusMut.isPending}
            onClick={() => estatusMut.mutate(p.estatus === 'activo' ? 'alta' : 'activo')}
          >
            {p.estatus === 'activo' ? 'Dar de alta' : 'Reactivar'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/50"
            disabled={delMut.isPending}
            onClick={() => {
              if (window.confirm('¿Archivar este expediente? Se ocultará de la lista (baja lógica, no se elimina de la base).')) delMut.mutate()
            }}
          >
            <Trash2 className="h-4 w-4" /> Archivar
          </button>
        </div>
      </div>
      <ErrorBox msg={error} />
      <p className="print:hidden text-[11px] text-slate-500">
        Descarga el JSON a tu equipo o guárdalo en la nube ContacNeed. También puedes imprimir a PDF desde el navegador.
      </p>

      {alergiaReal && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <span><strong>ALERGIAS:</strong> {p.alergias}</span>
        </div>
      )}

      <article className={`${glass} space-y-4 p-5 print:border-slate-300 print:bg-white print:text-black`}>
        <div className="border-b border-slate-700/60 pb-3">
          <p className="text-xs text-cyan-300">{prof?.institucion || 'Institución'}</p>
          <p className="text-[11px] text-slate-400">
            {prof?.tipo_establecimiento} {prof?.domicilio_establecimiento} {prof?.telefono_institucional && `· Tel. ${prof.telefono_institucional}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-white">{p.nombre_completo}</h3>
            {p.es_miembro && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 ring-1 ring-cyan-400/40">
                <BadgeCheck className="h-3 w-3" /> Miembro {p.miembro_codigo_cms || ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {p.numero_expediente} · {edad !== null ? `${edad} años · ` : ''}{p.sexo} · Sangre {p.grupo_sanguineo} · {p.estatus}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {bloque('Fecha de nacimiento', p.fecha_nacimiento)}
          {bloque('CURP', p.curp)}
          {bloque('Teléfono', p.telefono)}
          {bloque('Ocupación', p.ocupacion)}
          {bloque('Domicilio', p.domicilio)}
          {bloque('Contacto de emergencia', p.contacto_emergencia)}
          {bloque('AHF', p.ahf)}
          {bloque('APP', p.app)}
          {bloque('APNP', p.apnp)}
          {bloque('Gineco-obstétricos', p.ago)}
        </div>
        <div className="grid gap-3">
          {bloque('Padecimiento actual', p.padecimiento_actual)}
          {bloque('Interrogatorio por aparatos y sistemas', p.interrogatorio_sistemas)}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/40 p-3 text-xs text-slate-300 sm:grid-cols-4">
          <span>T/A: {v.ta || '—'}</span>
          <span>FC: {v.fc || '—'}</span>
          <span>FR: {v.fr || '—'}</span>
          <span>Temp: {v.temp || '—'}</span>
          <span>SpO₂: {v.spo2 || '—'}</span>
          <span>Peso: {v.weight || '—'}</span>
          <span>Talla: {v.height || '—'}</span>
          <span>IMC: {v.bmi || '—'}</span>
        </div>
        <div className="grid gap-3">
          {bloque('Exploración física', p.exploracion_fisica)}
          {bloque('Laboratorio y gabinete', p.laboratorios)}
          {bloque('Diagnóstico', p.diagnostico)}
          {bloque('Plan terapéutico', p.plan_terapeutico)}
          {bloque('Pronóstico', p.pronostico)}
        </div>
        <p className="border-t border-slate-700/60 pt-2 text-[11px] text-slate-500">
          Elaboró: {p.created_by_label || '—'} · {fmtDate(p.created_at)}
        </p>
      </article>

      <div className="print:hidden">
        <NotaForm
          pacienteId={pacienteId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: key })
            qc.invalidateQueries({ queryKey: ['expediente', 'pacientes'] })
          }}
        />
      </div>

      <section className={`${glass} space-y-3 p-4`}>
        <h3 className="text-sm font-semibold text-cyan-300">Línea de tiempo ({notas.length})</h3>
        {notas.length === 0 && <p className="text-sm text-slate-500">Sin notas de evolución todavía.</p>}
        <ol className="space-y-3 border-l border-cyan-500/30 pl-4">
          {notas.map((n) => {
            const nv = (n.vitals || {}) as Row
            return (
              <li key={n.id} className="relative space-y-1.5 rounded-xl bg-slate-950/40 p-3">
                <span className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-950" />
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-emerald-300">{n.tipo_nota}</span>
                  <span className="text-[11px] text-slate-500">{fmtDate(n.sealed_at)}</span>
                </div>
                <p className="text-xs text-slate-300"><strong className="text-slate-400">Dx:</strong> {n.diagnostico}</p>
                <p className="whitespace-pre-wrap text-sm text-slate-200">{n.evolucion}</p>
                {n.laboratorios && <p className="text-xs text-slate-300"><strong className="text-slate-400">Lab:</strong> {n.laboratorios}</p>}
                <p className="text-xs text-slate-300"><strong className="text-slate-400">Tx:</strong> {n.tratamiento}</p>
                <p className="text-xs text-slate-300"><strong className="text-slate-400">Pronóstico:</strong> {n.pronostico}</p>
                {Object.values(nv).some(Boolean) && (
                  <p className="text-[11px] text-slate-500">
                    {nv.ta && `T/A ${nv.ta} `}{nv.fc && `FC ${nv.fc} `}{nv.temp && `T ${nv.temp} `}{nv.spo2 && `SpO₂ ${nv.spo2} `}{nv.bmi && `IMC ${nv.bmi}`}
                  </p>
                )}
                {n.audio_url && (
                  <audio controls preload="none" src={n.audio_url} className="h-9 w-full" />
                )}
                <p className="text-[10px] text-slate-500">{n.author_label}</p>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

function NotaForm({ pacienteId, onSaved }: { pacienteId: string; onSaved: () => void }) {
  const [tipo, setTipo] = useState<(typeof NOTA_TIPOS)[number]>(NOTA_TIPOS[0])
  const [diagnostico, setDiagnostico] = useState('')
  const [evolucion, setEvolucion] = useState('')
  const [laboratorios, setLaboratorios] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [pronostico, setPronostico] = useState('')
  const [v, setV] = useState({ ta: '', fc: '', fr: '', temp: '', spo2: '', weight: '', height: '' })
  const [error, setError] = useState<string | null>(null)

  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const segRef = useRef(0)
  const duracionRef = useRef(0)

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
      recRef.current?.stream.getTracks().forEach((t) => t.stop())
    },
    [],
  )
  useEffect(
    () => () => {
      if (audioPreview) URL.revokeObjectURL(audioPreview)
    },
    [audioPreview],
  )

  const imc = calcImc(v.weight, v.height)

  const iniciarGrabacion = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Tu navegador no soporta grabación de audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        duracionRef.current = segRef.current
        setAudioBlob(blob)
        setAudioPreview(URL.createObjectURL(blob))
      }
      recRef.current = rec
      segRef.current = 0
      setSegundos(0)
      rec.start()
      setGrabando(true)
      timerRef.current = setInterval(() => {
        segRef.current += 1
        setSegundos(segRef.current)
      }, 1000)
    } catch {
      setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.')
    }
  }

  const detenerGrabacion = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    setGrabando(false)
  }

  const descartarAudio = () => {
    setAudioBlob(null)
    setAudioPreview(null)
    setSegundos(0)
  }

  const mut = useMutation({
    mutationFn: async () => {
      let audio_url: string | undefined
      if (audioBlob) {
        setSubiendo(true)
        try {
          const file = new File([audioBlob], 'consulta.webm', { type: 'audio/webm' })
          audio_url = await uploadFileToCloudinary(file)
        } finally {
          setSubiendo(false)
        }
      }
      return addExpedienteNotaFn({
        data: {
          pacienteId,
          tipo_nota: tipo,
          diagnostico,
          evolucion,
          laboratorios,
          tratamiento,
          pronostico,
          vitals: { ...v, bmi: imc },
          audio_url,
          audio_duracion_seg: audio_url ? duracionRef.current || undefined : undefined,
        },
      })
    },
    onSuccess: () => {
      setDiagnostico('')
      setEvolucion('')
      setLaboratorios('')
      setTratamiento('')
      setPronostico('')
      setV({ ta: '', fc: '', fr: '', temp: '', spo2: '', weight: '', height: '' })
      descartarAudio()
      setError(null)
      onSaved()
    },
    onError: (e) => setError(errMsg(e)),
  })

  const mm = String(Math.floor(segundos / 60)).padStart(2, '0')
  const ss = String(segundos % 60).padStart(2, '0')
  const busy = mut.isPending || subiendo

  return (
    <form
      className={`${glass} space-y-3 p-4`}
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        mut.mutate()
      }}
    >
      <h3 className="text-sm font-semibold text-cyan-300">Nueva nota de evolución</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de nota">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            {NOTA_TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Diagnóstico" required>
          <input className={inputCls} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {(
          [
            ['ta', 'T/A'],
            ['fc', 'FC'],
            ['fr', 'FR'],
            ['temp', 'Temp'],
            ['spo2', 'SpO₂'],
            ['weight', 'Peso'],
            ['height', 'Talla'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label}>
            <input className={inputCls} value={v[k]} onChange={(e) => setV((prev) => ({ ...prev, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
      {imc && <p className="text-xs text-emerald-300">IMC calculado: {imc}</p>}
      <Field label="Evolución y actualización del cuadro clínico" required>
        <textarea className={inputCls} rows={3} value={evolucion} onChange={(e) => setEvolucion(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-950/40 p-2.5">
        {!grabando ? (
          <button type="button" className={btnGhost} onClick={iniciarGrabacion} disabled={busy}>
            <Mic className="h-4 w-4 text-cyan-300" /> {audioBlob ? 'Volver a grabar' : 'Grabar consulta'}
          </button>
        ) : (
          <button
            type="button"
            onClick={detenerGrabacion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            <Square className="h-4 w-4" /> Detener
          </button>
        )}
        {grabando && (
          <span className="flex items-center gap-1.5 text-xs text-rose-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Grabando {mm}:{ss}
          </span>
        )}
        {audioPreview && !grabando && (
          <>
            <audio controls src={audioPreview} className="h-9 min-w-[200px] flex-1" />
            <button type="button" className={btnGhost} onClick={descartarAudio}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Laboratorio / gabinete">
          <textarea className={inputCls} rows={2} value={laboratorios} onChange={(e) => setLaboratorios(e.target.value)} />
        </Field>
        <Field label="Tratamiento e indicaciones" required>
          <textarea className={inputCls} rows={2} value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} />
        </Field>
        <Field label="Pronóstico" required className="sm:col-span-2">
          <input className={inputCls} value={pronostico} onChange={(e) => setPronostico(e.target.value)} />
        </Field>
      </div>
      <ErrorBox msg={error} />
      <div className="flex justify-end">
        <button type="submit" className={btnPrimary} disabled={busy || grabando}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {subiendo ? 'Subiendo audio…' : 'Sellar nota'}
        </button>
      </div>
    </form>
  )
}

function SettingsView({ profesional, onSaved }: { profesional: Row | null; onSaved: () => void }) {
  const [s, setS] = useState({
    institucion: String(profesional?.institucion || ''),
    tipo_establecimiento: String(profesional?.tipo_establecimiento || ''),
    telefono_institucional: String(profesional?.telefono_institucional || ''),
    domicilio_establecimiento: String(profesional?.domicilio_establecimiento || ''),
    nombre_profesional: String(profesional?.nombre_profesional || ''),
    cedula_profesional: String(profesional?.cedula_profesional || ''),
    especialidad: String(profesional?.especialidad || ''),
    profesion_rama: String(profesional?.profesion_rama || 'medicina'),
  })
  const [aviso, setAviso] = useState(profesional?.aviso_privacidad_aceptado !== false)
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () =>
      saveExpedienteProfesionalFn({
        data: {
          ...s,
          profesion_rama: s.profesion_rama as (typeof EXPEDIENTE_RAMAS)[number]['id'],
          aviso_privacidad_aceptado: aviso,
        },
      }),
    onSuccess: onSaved,
    onError: (e) => setError(errMsg(e)),
  })

  const bind = (k: keyof typeof s) => ({
    className: inputCls,
    value: s[k],
    onChange: (e: { target: { value: string } }) => setS((prev) => ({ ...prev, [k]: e.target.value })),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        if (!aviso) {
          setError('Debes aceptar el aviso de privacidad para continuar.')
          return
        }
        mut.mutate()
      }}
    >
      <Section title="Establecimiento (NOM-004, numeral 5.2)">
        <Field label="Institución / unidad médica" required className="sm:col-span-2"><input {...bind('institucion')} /></Field>
        <Field label="Tipo de establecimiento"><input {...bind('tipo_establecimiento')} placeholder="Consultorio, clínica…" /></Field>
        <Field label="Teléfono institucional"><input {...bind('telefono_institucional')} /></Field>
        <Field label="Domicilio del establecimiento" required className="sm:col-span-2"><input {...bind('domicilio_establecimiento')} /></Field>
      </Section>
      <Section title="Profesional tratante">
        <Field label="Nombre del profesional" required><input {...bind('nombre_profesional')} /></Field>
        <Field label="Cédula profesional" required><input {...bind('cedula_profesional')} /></Field>
        <Field label="Especialidad"><input {...bind('especialidad')} /></Field>
        <Field label="Rama profesional">
          <select
            className={inputCls}
            value={s.profesion_rama}
            onChange={(e) => setS((prev) => ({ ...prev, profesion_rama: e.target.value }))}
          >
            {EXPEDIENTE_RAMAS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </Field>
      </Section>
      <label className="flex items-start gap-2 text-xs text-slate-300">
        <input type="checkbox" className="mt-0.5 accent-emerald-500" checked={aviso} onChange={(e) => setAviso(e.target.checked)} />
        Acepto el aviso de privacidad y me comprometo a resguardar la confidencialidad de los expedientes.
      </label>
      <ErrorBox msg={error} />
      <div className="flex justify-end">
        <button type="submit" className={btnPrimary} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          Guardar datos profesionales
        </button>
      </div>
    </form>
  )
}

function NormativaView() {
  const puntos = [
    'Todo expediente debe incluir ficha de identificación, antecedentes, padecimiento actual, exploración física, diagnóstico, plan terapéutico y pronóstico.',
    'Cada nota debe llevar fecha, hora, nombre completo y cédula del profesional que la elabora (numeral 5.2).',
    'El expediente es propiedad de la institución o del prestador; el paciente tiene derecho a recibir resumen clínico.',
    'Conservación mínima de 5 años desde el último acto médico; por eso aquí solo se aplica baja lógica (archivado).',
    'Los datos son confidenciales (LFPDPPP y NOM-024-SSA3-2012). Exporta respaldos periódicos en JSON.',
    'Las grabaciones de audio requieren consentimiento informado del paciente.',
  ]
  return (
    <div className="space-y-4">
      <section className={`${glass} space-y-2 p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
          <BookOpen className="h-4 w-4" /> Resumen NOM-004-SSA3-2012
        </h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
          {puntos.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      <section className={`${glass} space-y-2 p-4`}>
        <h3 className="text-sm font-semibold text-emerald-300">Precios mensuales del módulo</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {EXPEDIENTE_PRECIOS_PUBLICOS.map((r) => (
            <div key={r.id} className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-slate-700/50">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-white">{r.label}</span>
                <span className="text-sm font-bold text-emerald-300">
                  {r.precioMensualMxn === 0 ? 'Gratis' : `$${r.precioMensualMxn.toLocaleString('es-MX')} MXN`}
                </span>
              </div>
              <p className="text-xs text-slate-400">{r.descripcion}</p>
            </div>
          ))}
        </div>
      </section>
      <section className={`${glass} space-y-2 p-4`}>
        <h3 className="text-sm font-semibold text-cyan-300">Otros registros profesionales sugeridos</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {OTROS_REGISTROS_SUGERIDOS.map((r) => (
            <div key={r.id} className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-slate-700/50">
              <p className="text-sm font-medium text-white">{r.titulo}</p>
              <p className="text-[11px] text-cyan-300">{r.para}</p>
              <p className="mt-1 text-xs text-slate-400">{r.nota}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
