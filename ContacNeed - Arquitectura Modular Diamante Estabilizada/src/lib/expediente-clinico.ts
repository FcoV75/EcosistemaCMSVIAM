import type { CmsPlusNivel } from './cms-plus'

export const PRODUCTO_EXPEDIENTE = 'expediente_clinico' as const

export type ExpedienteRama =
  | 'medicina'
  | 'enfermeria'
  | 'psicologia'
  | 'nutricion'
  | 'fisioterapia'
  | 'odontologia'
  | 'optometria'
  | 'terapia'
  | 'otro_paramedico'

export const EXPEDIENTE_RAMAS: { id: ExpedienteRama; label: string }[] = [
  { id: 'medicina', label: 'Medicina' },
  { id: 'enfermeria', label: 'Enfermería' },
  { id: 'psicologia', label: 'Psicología clínica' },
  { id: 'nutricion', label: 'Nutrición' },
  { id: 'fisioterapia', label: 'Fisioterapia / Rehabilitación' },
  { id: 'odontologia', label: 'Odontología' },
  { id: 'optometria', label: 'Optometría' },
  { id: 'terapia', label: 'Terapia (lenguaje, ocupacional, etc.)' },
  { id: 'otro_paramedico', label: 'Otro personal paramédico' },
]

export type ExpedientePrecioFila = {
  id: string
  label: string
  precioMensualMxn: number
  descripcion: string
}

/** Cuota mensual del módulo Expediente clínico según nivel CMS-Plus (o sin membresía). */
export function precioExpedienteMensualMxn(opts: {
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
}): number {
  if (opts.esOwner) return 0
  switch (opts.cmsNivel) {
    case 'diamante':
      return 300
    case 'platino':
      return 500
    case 'oro':
    case 'plata':
      return 600
    default:
      return 800
  }
}

export function precioExpedienteCentavos(opts: {
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
}): number {
  return precioExpedienteMensualMxn(opts) * 100
}

export function etiquetaPrecioExpediente(opts: {
  esOwner: boolean
  cmsNivel: CmsPlusNivel | null
}): string {
  const n = precioExpedienteMensualMxn(opts)
  if (n === 0) return 'Gratis (creador / fundador)'
  return `$${n.toLocaleString('es-MX')} MXN / mes`
}

export const EXPEDIENTE_PRECIOS_PUBLICOS: ExpedientePrecioFila[] = [
  {
    id: 'owner',
    label: 'Creador / fundador',
    precioMensualMxn: 0,
    descripcion: 'Acceso ilimitado sin cuota.',
  },
  {
    id: 'diamante',
    label: 'CMS-Plus Diamante',
    precioMensualMxn: 300,
    descripcion: 'Descuento por nivel diamante.',
  },
  {
    id: 'platino',
    label: 'CMS-Plus Platino',
    precioMensualMxn: 500,
    descripcion: 'Descuento por nivel platino.',
  },
  {
    id: 'plata_oro',
    label: 'CMS-Plus Plata u Oro',
    precioMensualMxn: 600,
    descripcion: 'Tarifa preferente de miembro.',
  },
  {
    id: 'sin_membresia',
    label: 'Sin membresía CMS-Plus',
    precioMensualMxn: 800,
    descripcion: 'Profesional médico / paramédico independiente.',
  },
]

export type ExpedienteVitals = {
  ta?: string
  fc?: string
  fr?: string
  temp?: string
  spo2?: string
  weight?: string
  height?: string
  bmi?: string
}

export type NotaTipo =
  | 'Nota de Evolución'
  | 'Nota de Interconsulta'
  | 'Nota de Referencia / Traslado'
  | 'Nota de Alta / Egreso'
  | 'Nota de Audio / Dictado'

export const NOTA_TIPOS: NotaTipo[] = [
  'Nota de Evolución',
  'Nota de Interconsulta',
  'Nota de Referencia / Traslado',
  'Nota de Alta / Egreso',
  'Nota de Audio / Dictado',
]

export function calcEdad(fechaNacimiento: string, ref = new Date()): number | null {
  if (!fechaNacimiento) return null
  const dob = new Date(`${fechaNacimiento}T12:00:00`)
  if (Number.isNaN(dob.getTime())) return null
  let age = ref.getFullYear() - dob.getFullYear()
  const m = ref.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age -= 1
  return age
}

export function calcImc(pesoKg?: string | number, tallaM?: string | number): string {
  const w = Number(pesoKg)
  const h = Number(tallaM)
  if (!w || !h || h <= 0) return ''
  return (w / (h * h)).toFixed(1)
}

export function nextNumeroExpediente(year = new Date().getFullYear(), seq = 1): string {
  return `EXP-${year}-${String(seq).padStart(3, '0')}`
}

export function authorLabel(profesional: {
  nombre_profesional?: string | null
  cedula_profesional?: string | null
}): string {
  const name = (profesional.nombre_profesional || 'Profesional tratante').trim()
  const ced = (profesional.cedula_profesional || '').trim()
  return ced ? `${name} (Céd. ${ced})` : name
}

/** Otras profesiones fuera del ámbito clínico que suelen necesitar bitácoras propias. */
export const OTROS_REGISTROS_SUGERIDOS = [
  {
    id: 'juridico',
    titulo: 'Expediente jurídico / consultoría legal',
    para: 'Abogados, notarios, mediadores',
    nota: 'Casos, audiencias, plazos, documentos y confidencialidad cliente-abogado.',
  },
  {
    id: 'contable',
    titulo: 'Carpeta fiscal / contable',
    para: 'Contadores y despachos fiscales',
    nota: 'Clientes, obligaciones, declaraciones y evidencia documental por periodo.',
  },
  {
    id: 'educativo',
    titulo: 'Expediente pedagógico',
    para: 'Docentes, psicopedagogos, coaches educativos',
    nota: 'Alumnos, avances, adecuaciones y reportes a padres/tutores.',
  },
  {
    id: 'arquitectura',
    titulo: 'Bitácora de obra / proyecto',
    para: 'Arquitectos e ingenieros',
    nota: 'Ya cubierto en gran parte por Mi Proyecto + Grupos; se puede profundizar con planos y actas.',
  },
  {
    id: 'veterinario',
    titulo: 'Expediente veterinario',
    para: 'Médicos veterinarios',
    nota: 'Similar a NOM clínica pero orientado a especies/dueños; normativa SENASICA distinta.',
  },
  {
    id: 'estetica',
    titulo: 'Ficha de consentimiento y seguimiento',
    para: 'Estética médica, dermocosmética',
    nota: 'Consentimientos, fotos antes/después y productos aplicados (alto riesgo legal).',
  },
] as const
