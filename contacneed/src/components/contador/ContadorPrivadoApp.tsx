import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  LockOpen,
  Paperclip,
  PieChart,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  addContadorMovimientoFn,
  deleteContadorMovimientoFn,
  ensureContadorPeriodoFn,
  exportContadorAnualFn,
  getContadorConfigFn,
  getContadorPeriodoFn,
  listContadorPeriodosFn,
  saveContadorConfigFn,
  setContadorPeriodoEstatusFn,
  toggleContadorChecklistFn,
} from '../../server/contador.functions'
import { updateNegocioFn } from '../../server/negocios.functions'
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  CHECKLIST_SAT_MENSUAL,
  CONTADOR_DISCLAIMER,
  CONTADOR_PRECIOS_PUBLICOS,
  CONTADOR_REGIMENES,
  formatMxnFromCentavos,
  movimientosToCsv,
  periodoLabel,
} from '../../lib/contador-privado'
import { uploadFileToCloudinary } from '../../lib/cloudinary-upload'

const glass = 'rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-black/30'
const inputCls =
  'w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/40 disabled:opacity-50'
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400'
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50'

const MESES = Array.from({ length: 12 }, (_, i) => i + 1)

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado'
}

function hoyISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function fechaDefault(anio: number, mes: number): string {
  const now = new Date()
  if (now.getFullYear() === anio && now.getMonth() + 1 === mes) return hoyISO()
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

function categoriaLabel(tipo: string, id: string): string {
  const list = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO
  return list.find((c) => c.id === id)?.label ?? id
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function Disclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-300" />
      {CONTADOR_DISCLAIMER}
    </p>
  )
}

function ReadinessGate({
  perfil,
  tienda,
  onReady,
}: {
  perfil: string[]
  tienda: string[]
  onReady: () => void
}) {
  const [bannerUrl, setBannerUrl] = useState('')
  const [itemUrl, setItemUrl] = useState('')
  const [busy, setBusy] = useState<'banner' | 'item' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const itemRef = useRef<HTMLInputElement>(null)

  const saveTienda = useMutation({
    mutationFn: () =>
      updateNegocioFn({
        data: {
          banner_url: bannerUrl,
          items: itemUrl ? [itemUrl] : [],
        },
      }),
    onSuccess: () => onReady(),
    onError: (e) => setError(errMsg(e)),
  })

  const upload = async (kind: 'banner' | 'item', file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(kind)
    try {
      const url = await uploadFileToCloudinary(file)
      if (kind === 'banner') setBannerUrl(url)
      else setItemUrl(url)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`${glass} space-y-4 border-amber-400/30 p-5`}>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-500/15 p-2 text-amber-300">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Completa tu perfil y tienda primero</h2>
          <p className="text-xs text-slate-400">
            Con banner + al menos un producto ya puedes llevar ingresos, egresos y balance aquí.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <p className="mb-2 text-xs font-bold text-emerald-300">Perfil</p>
          {perfil.length === 0 ? (
            <p className="text-xs text-emerald-200/80">✓ Completo</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-300">
              {perfil.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <p className="mb-2 text-xs font-bold text-emerald-300">Tienda</p>
          {tienda.length === 0 ? (
            <p className="text-xs text-emerald-200/80">✓ Completa</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-300">
              {tienda.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {tienda.length > 0 && (
        <div className="space-y-3 rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
            <Store size={16} />
            Completa tu tienda aquí (sin salir)
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Banner de tienda *</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy !== null}
                  onClick={() => bannerRef.current?.click()}
                >
                  {busy === 'banner' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {bannerUrl ? 'Cambiar banner' : 'Subir banner'}
                </button>
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void upload('banner', e.target.files?.[0])}
                />
                {bannerUrl && (
                  <img src={bannerUrl} alt="Banner" className="h-12 w-20 rounded-lg object-cover" />
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Producto / servicio *</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy !== null}
                  onClick={() => itemRef.current?.click()}
                >
                  {busy === 'item' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {itemUrl ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
                <input
                  ref={itemRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void upload('item', e.target.files?.[0])}
                />
                {itemUrl && (
                  <img src={itemUrl} alt="Producto" className="h-12 w-12 rounded-lg object-cover" />
                )}
              </div>
            </div>
          </div>
          <ErrorBanner message={error ?? (saveTienda.isError ? errMsg(saveTienda.error) : null)} />
          <button
            type="button"
            className={btnPrimary}
            disabled={!bannerUrl || !itemUrl || saveTienda.isPending}
            onClick={() => {
              setBusy('save')
              saveTienda.mutate(undefined, { onSettled: () => setBusy(null) })
            }}
          >
            {saveTienda.isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar tienda y continuar al Contador
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {perfil.length > 0 && (
          <a href="/profile" className={btnPrimary}>
            Completar perfil
          </a>
        )}
        <a href="/profile?tab=negocio" className={btnGhost}>
          Ir a Mi negocio
        </a>
      </div>
    </div>
  )
}

type ConfigRow = {
  nombre_negocio?: string | null
  rfc?: string | null
  regimen?: string | null
  actividad?: string | null
  aviso_aceptado?: boolean | null
}

function SetupForm({
  initial,
  onSaved,
}: {
  initial: ConfigRow | null
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(initial?.nombre_negocio ?? '')
  const [rfc, setRfc] = useState(initial?.rfc ?? '')
  const [regimen, setRegimen] = useState(initial?.regimen ?? 'sin_definir')
  const [actividad, setActividad] = useState(initial?.actividad ?? '')
  const [aviso, setAviso] = useState(false)

  const save = useMutation({
    mutationFn: () =>
      saveContadorConfigFn({
        data: {
          nombre_negocio: nombre,
          rfc,
          regimen: regimen as never,
          actividad,
          aviso_aceptado: aviso,
        },
      }),
    onSuccess: onSaved,
  })

  const hint = CONTADOR_REGIMENES.find((r) => r.id === regimen)?.hint

  return (
    <form
      className={`${glass} space-y-4 p-5`}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <div>
        <h2 className="text-base font-bold text-white">Configura tu Contador Privado</h2>
        <p className="text-xs text-slate-400">Datos de tu negocio para organizar ingresos y egresos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Nombre del negocio *</label>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>RFC (opcional)</label>
          <input
            className={inputCls}
            value={rfc ?? ''}
            maxLength={13}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            placeholder="XAXX010101000"
          />
        </div>
        <div>
          <label className={labelCls}>Régimen</label>
          <select className={inputCls} value={regimen ?? 'sin_definir'} onChange={(e) => setRegimen(e.target.value)}>
            {CONTADOR_REGIMENES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
        </div>
        <div>
          <label className={labelCls}>Actividad</label>
          <input
            className={inputCls}
            value={actividad ?? ''}
            onChange={(e) => setActividad(e.target.value)}
            placeholder="Ej. plomería, carpintería, repostería"
          />
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
        <input
          type="checkbox"
          checked={aviso}
          onChange={(e) => setAviso(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-emerald-500"
        />
        <span>{CONTADOR_DISCLAIMER}</span>
      </label>
      <ErrorBanner message={save.isError ? errMsg(save.error) : null} />
      <button type="submit" className={btnPrimary} disabled={save.isPending || !aviso || !nombre.trim()}>
        {save.isPending && <Loader2 size={14} className="animate-spin" />}
        Guardar y continuar
      </button>
    </form>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: 'emerald' | 'rose' | 'amber'
  icon: React.ReactNode
}) {
  const tones = {
    emerald: 'text-emerald-300 border-emerald-400/20',
    rose: 'text-rose-300 border-rose-400/20',
    amber: 'text-amber-300 border-amber-400/20',
  }
  return (
    <div className={`${glass} ${tones[tone]} p-4`}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
        <span className={tones[tone].split(' ')[0]}>{icon}</span>
      </div>
      <p className={`mt-2 text-xl font-extrabold tabular-nums ${tones[tone].split(' ')[0]}`}>
        {formatMxnFromCentavos(value)}
      </p>
    </div>
  )
}

type Movimiento = {
  id: string
  tipo: string
  categoria: string
  concepto: string
  monto_centavos: number
  fecha: string
  comprobante_url?: string | null
}

function MovimientoForm({
  periodoId,
  anio,
  mes,
  onAdded,
}: {
  periodoId: string
  anio: number
  mes: number
  onAdded: () => void
}) {
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_INGRESO[0].id)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(fechaDefault(anio, mes))
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFecha(fechaDefault(anio, mes))
  }, [anio, mes])

  const categorias = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO

  const add = useMutation({
    mutationFn: async () => {
      const n = Number(monto.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) throw new Error('Ingresa un monto válido mayor a 0')
      let comprobante_url: string | undefined
      if (file) comprobante_url = await uploadFileToCloudinary(file)
      return addContadorMovimientoFn({
        data: { periodoId, tipo, categoria, concepto, monto: n, fecha, comprobante_url },
      })
    },
    onSuccess: () => {
      setConcepto('')
      setMonto('')
      setFile(null)
      setError(null)
      if (fileRef.current) fileRef.current.value = ''
      onAdded()
    },
    onError: (e) => setError(errMsg(e)),
  })

  return (
    <form
      className={`${glass} space-y-3 p-4`}
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        add.mutate()
      }}
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <Plus size={16} className="text-emerald-300" /> Nuevo movimiento
      </h3>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950/60 p-1">
        {(['ingreso', 'egreso'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTipo(t)
              setCategoria((t === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO)[0].id)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tipo === t
                ? t === 'ingreso'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Categoría</label>
          <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Concepto</label>
          <input
            className={inputCls}
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Reparación de boiler"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Monto (MXN)</label>
          <input
            className={inputCls}
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btnGhost} cursor-pointer text-xs`}>
          <Paperclip size={14} />
          {file ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && <span className="max-w-[200px] truncate text-[11px] text-slate-400">{file.name}</span>}
      </div>
      <ErrorBanner message={error} />
      <button type="submit" className={btnPrimary} disabled={add.isPending}>
        {add.isPending && <Loader2 size={14} className="animate-spin" />}
        {add.isPending && file ? 'Subiendo…' : 'Registrar movimiento'}
      </button>
    </form>
  )
}

function Workspace() {
  const qc = useQueryClient()
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [error, setError] = useState<string | null>(null)

  const ensure = useQuery({
    queryKey: ['contador-ensure', anio, mes],
    queryFn: () => ensureContadorPeriodoFn({ data: { anio, mes } }),
    staleTime: 60_000,
  })
  const periodoId = ensure.data?.periodo?.id as string | undefined

  const periodoQ = useQuery({
    queryKey: ['contador-periodo', periodoId],
    queryFn: () => getContadorPeriodoFn({ data: { periodoId: periodoId! } }),
    enabled: Boolean(periodoId),
  })
  const historial = useQuery({
    queryKey: ['contador-periodos'],
    queryFn: () => listContadorPeriodosFn(),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['contador-periodo', periodoId] })
    qc.invalidateQueries({ queryKey: ['contador-periodos'] })
  }

  const del = useMutation({
    mutationFn: (movimientoId: string) => deleteContadorMovimientoFn({ data: { movimientoId } }),
    onSuccess: refresh,
    onError: (e) => setError(errMsg(e)),
  })
  const toggle = useMutation({
    mutationFn: (v: { itemKey: string; hecho: boolean }) =>
      toggleContadorChecklistFn({ data: { periodoId: periodoId!, ...v } }),
    onSuccess: refresh,
    onError: (e) => setError(errMsg(e)),
  })
  const estatus = useMutation({
    mutationFn: (v: 'abierto' | 'cerrado') =>
      setContadorPeriodoEstatusFn({ data: { periodoId: periodoId!, estatus: v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contador-ensure', anio, mes] })
      refresh()
    },
    onError: (e) => setError(errMsg(e)),
  })
  const exportar = useMutation({
    mutationFn: () => exportContadorAnualFn({ data: { anio } }),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contador-privado-${anio}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: (e) => setError(errMsg(e)),
  })

  const data = periodoQ.data
  const cerrado = (data?.periodo?.estatus ?? ensure.data?.periodo?.estatus) === 'cerrado'
  const movimientos = (data?.movimientos ?? []) as Movimiento[]
  const resumen = data?.resumen as
    | {
        ingresosCentavos: number
        egresosCentavos: number
        saldoCentavos: number
        saldoAcumuladoCentavos?: number
        porCategoria?: Array<{ tipo: string; categoria: string; totalCentavos: number; count: number }>
      }
    | undefined
  const checks = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const c of (data?.checklist ?? []) as Array<{ item_key: string; hecho: boolean }>) {
      map.set(c.item_key, Boolean(c.hecho))
    }
    return map
  }, [data?.checklist])
  const hechos = CHECKLIST_SAT_MENSUAL.filter((c) => checks.get(c.key)).length
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i)
  const loading = ensure.isLoading || (Boolean(periodoId) && periodoQ.isLoading)
  const periodos = (historial.data?.periodos ?? []) as Array<{
    id: string
    anio: number
    mes: number
    estatus: string
  }>

  const exportCsvMes = () => {
    const csv = movimientosToCsv(movimientos)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contador-${anio}-${String(mes).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const imprimirResumen = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900')
    if (!w) {
      setError('Permite ventanas emergentes para imprimir el resumen.')
      return
    }
    const porCat = (resumen?.porCategoria ?? [])
      .map(
        (c) =>
          `<tr><td>${c.tipo}</td><td>${categoriaLabel(c.tipo, c.categoria)}</td><td>${c.count}</td><td style="text-align:right">${formatMxnFromCentavos(c.totalCentavos)}</td></tr>`,
      )
      .join('')
    const movRows = movimientos
      .map(
        (m) =>
          `<tr><td>${m.fecha}</td><td>${m.tipo}</td><td>${categoriaLabel(m.tipo, m.categoria)}</td><td>${m.concepto}</td><td style="text-align:right">${formatMxnFromCentavos(m.monto_centavos)}</td></tr>`,
      )
      .join('')
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Resumen Contador ${periodoLabel(anio, mes)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:1.25rem}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.card{border:1px solid #ddd;padding:10px;border-radius:8px}p.note{font-size:11px;color:#555;margin-top:24px}</style></head><body>
      <h1>Tu Contador Privado · ${periodoLabel(anio, mes)}</h1>
      <div class="nums">
        <div class="card"><strong>Ingresos</strong><div>${formatMxnFromCentavos(resumen?.ingresosCentavos ?? 0)}</div></div>
        <div class="card"><strong>Egresos</strong><div>${formatMxnFromCentavos(resumen?.egresosCentavos ?? 0)}</div></div>
        <div class="card"><strong>Saldo del mes</strong><div>${formatMxnFromCentavos(resumen?.saldoCentavos ?? 0)}</div></div>
      </div>
      <p><strong>Saldo acumulado del año:</strong> ${formatMxnFromCentavos(resumen?.saldoAcumuladoCentavos ?? resumen?.saldoCentavos ?? 0)}</p>
      <h2>Por categoría</h2>
      <table><thead><tr><th>Tipo</th><th>Categoría</th><th>#</th><th>Total</th></tr></thead><tbody>${porCat || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody></table>
      <h2>Movimientos</h2>
      <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th>Monto</th></tr></thead><tbody>${movRows || '<tr><td colspan="5">Sin movimientos</td></tr>'}</tbody></table>
      <p class="note">${CONTADOR_DISCLAIMER}</p>
      <script>window.onload=()=>{window.print()}</script></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <div className={`${glass} flex flex-wrap items-end gap-3 p-4`}>
        <div className="flex items-center gap-2 text-emerald-300">
          <CalendarDays size={18} />
          <span className="text-sm font-bold capitalize text-white">{periodoLabel(anio, mes)}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              cerrado ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {cerrado ? 'Cerrado' : 'Abierto'}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <select
            className={`${inputCls} !w-auto capitalize`}
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            aria-label="Mes"
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleDateString('es-MX', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            className={`${inputCls} !w-auto`}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            aria-label="Año"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {periodos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {periodos.map((p) => {
            const active = p.anio === anio && p.mes === mes
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setAnio(p.anio)
                  setMes(p.mes)
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                  active
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {periodoLabel(p.anio, p.mes)}
                {p.estatus === 'cerrado' && <Lock size={10} className="ml-1 inline text-amber-300" />}
              </button>
            )
          })}
        </div>
      )}

      <ErrorBanner message={error ?? (ensure.isError ? errMsg(ensure.error) : null)} />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Cargando periodo…
        </div>
      )}

      {periodoId && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Ingresos del mes"
              value={resumen?.ingresosCentavos ?? 0}
              tone="emerald"
              icon={<TrendingUp size={16} />}
            />
            <SummaryCard
              label="Egresos del mes"
              value={resumen?.egresosCentavos ?? 0}
              tone="rose"
              icon={<TrendingDown size={16} />}
            />
            <SummaryCard
              label="Saldo del mes"
              value={resumen?.saldoCentavos ?? 0}
              tone="amber"
              icon={<Wallet size={16} />}
            />
            <SummaryCard
              label="Saldo acumulado (año)"
              value={resumen?.saldoAcumuladoCentavos ?? resumen?.saldoCentavos ?? 0}
              tone="amber"
              icon={<PieChart size={16} />}
            />
          </div>

          {(resumen?.porCategoria?.length ?? 0) > 0 && (
            <div className={`${glass} p-4`}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <PieChart size={16} className="text-emerald-300" /> Balance por categoría
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {resumen!.porCategoria!.map((c) => (
                  <li
                    key={`${c.tipo}-${c.categoria}`}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-xs"
                  >
                    <span className="text-slate-300">
                      <span className={c.tipo === 'ingreso' ? 'text-emerald-300' : 'text-amber-300'}>
                        {c.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </span>
                      {' · '}
                      {categoriaLabel(c.tipo, c.categoria)}
                      <span className="text-slate-500"> ({c.count})</span>
                    </span>
                    <span className="font-bold tabular-nums text-slate-100">
                      {formatMxnFromCentavos(c.totalCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {cerrado ? (
                <div className={`${glass} flex items-center gap-2 border-amber-400/30 p-4 text-xs text-amber-200`}>
                  <Lock size={14} /> Mes cerrado. Reábrelo para registrar o eliminar movimientos.
                </div>
              ) : (
                <MovimientoForm periodoId={periodoId} anio={anio} mes={mes} onAdded={refresh} />
              )}

              <div className={`${glass} space-y-3 p-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                    <CheckSquare size={16} className="text-emerald-300" /> Checklist SAT mensual
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {hechos}/{CHECKLIST_SAT_MENSUAL.length}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
                    style={{ width: `${(hechos / CHECKLIST_SAT_MENSUAL.length) * 100}%` }}
                  />
                </div>
                <ul className="space-y-1.5">
                  {CHECKLIST_SAT_MENSUAL.map((c) => {
                    const done = Boolean(checks.get(c.key))
                    return (
                      <li key={c.key}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/5 bg-slate-950/40 p-2.5 hover:border-emerald-400/30">
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={toggle.isPending}
                            onChange={(e) => toggle.mutate({ itemKey: c.key, hecho: e.target.checked })}
                            className="mt-0.5 h-4 w-4 accent-emerald-500"
                          />
                          <span>
                            <span className={`block text-xs font-semibold ${done ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                              {c.label}
                            </span>
                            <span className="block text-[11px] text-slate-500">{c.detalle}</span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`${glass} p-4`}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <Receipt size={16} className="text-amber-300" /> Movimientos ({movimientos.length})
                </h3>
                {movimientos.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">Sin movimientos en este mes.</p>
                ) : (
                  <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                    {movimientos.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-2.5"
                      >
                        <span
                          className={`h-8 w-1 shrink-0 rounded-full ${
                            m.tipo === 'ingreso' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-100">{m.concepto}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {m.fecha} · {categoriaLabel(m.tipo, m.categoria)}
                            {m.comprobante_url && (
                              <>
                                {' · '}
                                <a
                                  href={m.comprobante_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-300 underline"
                                >
                                  comprobante
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            m.tipo === 'ingreso' ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {m.tipo === 'ingreso' ? '+' : '−'}
                          {formatMxnFromCentavos(m.monto_centavos)}
                        </span>
                        {!cerrado && (
                          <button
                            type="button"
                            aria-label="Eliminar movimiento"
                            disabled={del.isPending}
                            onClick={() => {
                              if (window.confirm('¿Eliminar este movimiento?')) del.mutate(m.id)
                            }}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={`${glass} space-y-3 p-4`}>
                <h3 className="text-sm font-bold text-white">Acciones del periodo</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cerrado ? btnGhost : btnPrimary}
                    disabled={estatus.isPending}
                    onClick={() => estatus.mutate(cerrado ? 'abierto' : 'cerrado')}
                  >
                    {estatus.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : cerrado ? (
                      <LockOpen size={14} />
                    ) : (
                      <Lock size={14} />
                    )}
                    {cerrado ? 'Reabrir mes' : 'Cerrar mes'}
                  </button>
                  <button type="button" className={btnGhost} onClick={exportCsvMes} disabled={!movimientos.length}>
                    <FileSpreadsheet size={14} />
                    Exportar mes (CSV)
                  </button>
                  <button type="button" className={btnGhost} onClick={imprimirResumen}>
                    <Printer size={14} />
                    Imprimir / PDF
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={exportar.isPending}
                    onClick={() => exportar.mutate()}
                  >
                    {exportar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Exportar {anio} (JSON)
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  El saldo del mes = ingresos − egresos. El acumulado suma todos los meses del año hasta el actual.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function ContadorPrivadoApp() {
  const qc = useQueryClient()
  const cfg = useQuery({
    queryKey: ['contador-config'],
    queryFn: () => getContadorConfigFn(),
    retry: false,
  })

  const header = (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-300">
        <Wallet size={22} />
      </div>
      <div>
        <h1 className="text-lg font-extrabold text-white">Contador Privado</h1>
        <p className="text-xs text-slate-400">Ingresos, egresos y recordatorios fiscales de tu negocio</p>
      </div>
    </div>
  )

  let body: React.ReactNode
  if (cfg.isLoading) {
    body = (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" /> Cargando…
      </div>
    )
  } else if (cfg.isError) {
    body = (
      <div className={`${glass} space-y-3 p-5`}>
        <ErrorBanner message={errMsg(cfg.error)} />
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTADOR_PRECIOS_PUBLICOS.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <p className="text-xs font-bold text-slate-100">{p.label}</p>
              <p className="text-sm font-extrabold text-emerald-300">
                {p.precioMensualMxn === 0 ? 'Gratis' : `$${p.precioMensualMxn} MXN / mes`}
              </p>
              <p className="text-[11px] text-slate-500">{p.descripcion}</p>
            </div>
          ))}
        </div>
        <button type="button" className={btnGhost} onClick={() => cfg.refetch()}>
          Reintentar
        </button>
      </div>
    )
  } else {
    const { config, readiness } = cfg.data!
    if (!readiness.listo) {
      body = (
        <ReadinessGate
          perfil={readiness.perfil.faltantes}
          tienda={readiness.tienda.faltantes}
          onReady={() => qc.invalidateQueries({ queryKey: ['contador-config'] })}
        />
      )
    } else if (!config || !config.aviso_aceptado) {
      body = (
        <SetupForm
          initial={config as ConfigRow | null}
          onSaved={() => qc.invalidateQueries({ queryKey: ['contador-config'] })}
        />
      )
    } else {
      body = (
        <>
          <p className="text-xs text-slate-400">
            <span className="font-bold text-emerald-300">{config.nombre_negocio}</span>
            {config.rfc ? ` · ${config.rfc}` : ''}
            {config.regimen
              ? ` · ${CONTADOR_REGIMENES.find((r) => r.id === config.regimen)?.label ?? config.regimen}`
              : ''}
          </p>
          <Workspace />
        </>
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-3 text-slate-100 sm:p-5">
      {header}
      {body}
      <Disclaimer />
    </div>
  )
}

export default ContadorPrivadoApp
