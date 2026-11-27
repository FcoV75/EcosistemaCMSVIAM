import type { CmsPlusNivel } from './cms-plus'

export const PRODUCTO_CONTADOR = 'contador_privado' as const

export type ContadorRegimen =
  | 'resico'
  | 'actividad_empresarial'
  | 'sueldos'
  | 'otro'
  | 'sin_definir'

export const CONTADOR_REGIMENES: { id: ContadorRegimen; label: string; hint: string }[] = [
  {
    id: 'resico',
    label: 'RESICO (personas físicas)',
    hint: 'Régimen Simplificado de Confianza — común en oficios y emprendedores.',
  },
  {
    id: 'actividad_empresarial',
    label: 'Actividad empresarial y profesional',
    hint: 'Si facturas servicios u oficio con actividad empresarial.',
  },
  {
    id: 'sueldos',
    label: 'Sueldos y salarios (complemento)',
    hint: 'Si además tienes ingreso por nómina; registra aquí tu negocio aparte.',
  },
  { id: 'otro', label: 'Otro / aún no lo sé', hint: 'Puedes corregirlo después con tu contador.' },
  { id: 'sin_definir', label: 'Sin definir', hint: 'Completa cuando tengas tu constancia de situación fiscal.' },
]

export type ContadorCategoriaIngreso =
  | 'ventas'
  | 'servicios'
  | 'propinas'
  | 'otros_ingresos'

export type ContadorCategoriaEgreso =
  | 'insumos'
  | 'herramientas'
  | 'renta'
  | 'servicios_publicos'
  | 'transporte'
  | 'publicidad'
  | 'impuestos'
  | 'nomina'
  | 'otros_egresos'

export const CATEGORIAS_INGRESO: { id: ContadorCategoriaIngreso; label: string }[] = [
  { id: 'ventas', label: 'Ventas de productos' },
  { id: 'servicios', label: 'Servicios / mano de obra' },
  { id: 'propinas', label: 'Propinas / extras' },
  { id: 'otros_ingresos', label: 'Otros ingresos' },
]

export const CATEGORIAS_EGRESO: { id: ContadorCategoriaEgreso; label: string }[] = [
  { id: 'insumos', label: 'Insumos / materia prima' },
  { id: 'herramientas', label: 'Herramientas y equipo' },
  { id: 'renta', label: 'Renta / local' },
  { id: 'servicios_publicos', label: 'Luz, agua, internet, gas' },
  { id: 'transporte', label: 'Gasolina / transporte' },
  { id: 'publicidad', label: 'Publicidad / redes' },
  { id: 'impuestos', label: 'Impuestos / derechos' },
  { id: 'nomina', label: 'Ayudantes / nómina' },
  { id: 'otros_egresos', label: 'Otros egresos' },
]

export const CHECKLIST_SAT_MENSUAL: { key: string; label: string; detalle: string }[] = [
  {
    key: 'registrar_ingresos',
    label: 'Registré todos mis ingresos del mes',
    detalle: 'Cobros en efectivo, transferencia y tarjeta.',
  },
  {
    key: 'registrar_egresos',
    label: 'Registré mis gastos con comprobante',
    detalle: 'Tickets, facturas o fotos de recibos.',
  },
  {
    key: 'facturas',
    label: 'Revisé facturas emitidas / recibidas',
    detalle: 'Si facturas en el SAT, concilia con tu listado.',
  },
  {
    key: 'saldo',
    label: 'Revisé mi saldo del mes (ingresos − egresos)',
    detalle: 'Así sabes si el negocio dejó utilidad.',
  },
  {
    key: 'declaracion',
    label: 'Marqué mi declaración / pago provisional (si aplica)',
    detalle: 'RESICO y otros regímenes tienen fechas en el SAT. Esto es un recordatorio, no el trámite.',
  },
  {
    key: 'respaldo',
    label: 'Exporté o guardé el resumen del mes',
    detalle: 'PDF/JSON para ti o para tu contador humano.',
  },
]

/** Cuota mensual: más accesible que expediente (público de oficios). */
export function precioContadorMensualMxn(opts: {
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
  esPro?: boolean
}): number {
  if (opts.esOwner) return 0
  switch (opts.cmsNivel) {
    case 'diamante':
      return 199
    case 'platino':
      return 299
    case 'oro':
    case 'plata':
      return 349
    default:
      return opts.esPro ? 399 : 449
  }
}

export function precioContadorCentavos(opts: {
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
  esPro?: boolean
}): number {
  return precioContadorMensualMxn(opts) * 100
}

export function etiquetaPrecioContador(opts: {
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
  esPro?: boolean
}): string {
  const n = precioContadorMensualMxn(opts)
  if (n === 0) return 'Gratis (creador / fundador)'
  return `$${n.toLocaleString('es-MX')} MXN / mes`
}

export const CONTADOR_PRECIOS_PUBLICOS = [
  { id: 'owner', label: 'Creador / fundador', precioMensualMxn: 0, descripcion: 'Acceso ilimitado.' },
  { id: 'diamante', label: 'CMS-Plus Diamante', precioMensualMxn: 199, descripcion: 'Mejor precio por nivel.' },
  { id: 'platino', label: 'CMS-Plus Platino', precioMensualMxn: 299, descripcion: 'Descuento platino.' },
  { id: 'plata_oro', label: 'CMS-Plus Plata / Oro', precioMensualMxn: 349, descripcion: 'Tarifa preferente.' },
  { id: 'pro', label: 'ContacNeed PRO (sin Plus)', precioMensualMxn: 399, descripcion: 'Oficio con PRO activo.' },
  { id: 'base', label: 'Sin PRO / sin Plus', precioMensualMxn: 449, descripcion: 'Emprendedor independiente.' },
] as const

export function formatMxnFromCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  })
}

export function periodoLabel(anio: number, mes: number): string {
  const d = new Date(anio, mes - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export type TiendaGate = {
  ok: boolean
  tieneBanner: boolean
  itemsCount: number
  faltantes: string[]
}

/** Extrae URLs de producto aunque `items` venga como string[] u objetos {url|image|src}. */
export function extractNegocioItemUrls(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const urls: string[] = []
  for (const entry of items) {
    if (typeof entry === 'string' && entry.trim()) {
      urls.push(entry.trim())
      continue
    }
    if (entry && typeof entry === 'object') {
      const o = entry as Record<string, unknown>
      const candidate = [o.url, o.image, o.src, o.imagen].find(
        (v) => typeof v === 'string' && String(v).trim(),
      )
      if (typeof candidate === 'string') urls.push(candidate.trim())
    }
  }
  return urls
}

export function evaluarTiendaEstructurada(negocio: {
  banner_url?: string | null
  items?: unknown
} | null): TiendaGate {
  const urls = extractNegocioItemUrls(negocio?.items)
  const tieneBanner = Boolean(negocio?.banner_url?.trim())
  const faltantes: string[] = []
  if (!tieneBanner) faltantes.push('Sube un banner de tu tienda')
  if (urls.length < 1) faltantes.push('Agrega al menos 1 imagen de producto/servicio')
  return {
    ok: faltantes.length === 0,
    tieneBanner,
    itemsCount: urls.length,
    faltantes,
  }
}

export function resumenPorCategoria(
  movimientos: Array<{ tipo: string; categoria: string; monto_centavos: number }>,
): Array<{ tipo: string; categoria: string; totalCentavos: number; count: number }> {
  const map = new Map<string, { tipo: string; categoria: string; totalCentavos: number; count: number }>()
  for (const m of movimientos) {
    const key = `${m.tipo}:${m.categoria}`
    const prev = map.get(key) || {
      tipo: m.tipo,
      categoria: m.categoria,
      totalCentavos: 0,
      count: 0,
    }
    prev.totalCentavos += Number(m.monto_centavos || 0)
    prev.count += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => b.totalCentavos - a.totalCentavos)
}

export function movimientosToCsv(
  movimientos: Array<{
    fecha: string
    tipo: string
    categoria: string
    concepto: string
    monto_centavos: number
  }>,
): string {
  const header = 'fecha,tipo,categoria,concepto,monto_mxn'
  const rows = movimientos.map((m) => {
    const monto = (Number(m.monto_centavos) / 100).toFixed(2)
    const concepto = `"${String(m.concepto || '').replace(/"/g, '""')}"`
    return [m.fecha, m.tipo, m.categoria, concepto, monto].join(',')
  })
  return [header, ...rows].join('\n')
}

export type PerfilGate = {
  ok: boolean
  faltantes: string[]
}

export function evaluarPerfilCompleto(profile: {
  nombre?: string | null
  habilidad_empirica?: string | null
  tipo_miembro?: string | null
  estado?: string | null
  municipio?: string | null
  celular?: string | null
} | null): PerfilGate {
  const faltantes: string[] = []
  if (!profile?.nombre?.trim()) faltantes.push('Nombre completo')
  if (!profile?.habilidad_empirica?.trim() && !profile?.tipo_miembro) {
    faltantes.push('Oficio / profesión (título)')
  }
  if (!profile?.estado?.trim()) faltantes.push('Estado')
  if (!profile?.municipio?.trim()) faltantes.push('Municipio')
  if (!profile?.celular?.trim()) faltantes.push('Celular de contacto')
  return { ok: faltantes.length === 0, faltantes }
}

export const CONTADOR_DISCLAIMER =
  'Tu Contador Privado organiza ingresos, egresos, saldo y recordatorios fiscales de tu negocio. No sustituye a un contador público, no presenta declaraciones ante el SAT ni constituye asesoría fiscal vinculante.'
