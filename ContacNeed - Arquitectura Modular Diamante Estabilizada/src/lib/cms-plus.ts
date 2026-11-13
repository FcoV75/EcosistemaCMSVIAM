/** Círculo CMS-Plus Membresías — catálogo de niveles y privilegios. */

export const PRODUCTO_CMS_PLUS = 'cms_plus' as const

export type CmsPlusNivel = 'plata' | 'oro' | 'platino' | 'diamante'
export type CmsPlusBilling = 'mensual' | 'anual'

export type CmsPlusTier = {
  id: CmsPlusNivel
  nombre: string
  tagline: string
  precioMensualMxn: number
  precioAnualMxn: number
  creditosSalud: number
  anunciosPro: number
  videoDiamanteClips: number
  iaViam: string
  beneficiariosMax: number
  descuentoCirculoPct: number
  creditosCompartibles: number
  aporteFondoMxn: number
  equipoColaboradores: number
  plusResumen: string[]
  saludResumen: string[]
  negocioResumen: string[]
  highlight?: boolean
  envPriceMonthly: string
  envPriceAnnual: string
}

export const CMS_PLUS_NIVELES: readonly CmsPlusTier[] = [
  {
    id: 'plata',
    nombre: 'Plata',
    tagline: 'La puerta holgada al club CMS-Plus',
    precioMensualMxn: 499,
    precioAnualMxn: 4990,
    creditosSalud: 3,
    anunciosPro: 2,
    videoDiamanteClips: 3,
    iaViam: '100 consultas/mes',
    beneficiariosMax: 3,
    descuentoCirculoPct: 20,
    creditosCompartibles: 1,
    aporteFondoMxn: 30,
    equipoColaboradores: 0,
    plusResumen: [
      'ContacNeed PRO completo',
      'Sincronía Nexus completo',
      'IA VIAM: 100 consultas/mes',
      'Video Diamante: 3 clips/mes',
    ],
    saludResumen: [
      '3 créditos/mes (biodescodificación, biomagnetismo o resonancia)',
      'Seguimiento escrito post-sesión',
    ],
    negocioResumen: [
      '2 anuncios PRO incluidos',
      'Visibilidad prioritaria media',
    ],
    envPriceMonthly: 'STRIPE_PRICE_CMS_PLUS_PLATA_MONTHLY',
    envPriceAnnual: 'STRIPE_PRICE_CMS_PLUS_PLATA_ANNUAL',
  },
  {
    id: 'oro',
    nombre: 'Oro',
    tagline: 'Continuidad de salud + expansión seria',
    precioMensualMxn: 899,
    precioAnualMxn: 8990,
    creditosSalud: 6,
    anunciosPro: 3,
    videoDiamanteClips: 8,
    iaViam: 'Ilimitada razonable',
    beneficiariosMax: 5,
    descuentoCirculoPct: 25,
    creditosCompartibles: 3,
    aporteFondoMxn: 60,
    equipoColaboradores: 0,
    highlight: true,
    plusResumen: [
      'Todo Plata, ampliado',
      'Video Diamante: 8 clips/mes',
      'IA VIAM ilimitada razonable',
      'Escuela ContacNeed: cursos de principios',
    ],
    saludResumen: [
      '6 créditos/mes en el menú de salud',
      '1 evaluación integral trimestral',
    ],
    negocioResumen: [
      '3 anuncios PRO + destacados 7 días/mes',
      'Mentoría grupal mensual de oficio',
    ],
    envPriceMonthly: 'STRIPE_PRICE_CMS_PLUS_ORO_MONTHLY',
    envPriceAnnual: 'STRIPE_PRICE_CMS_PLUS_ORO_ANNUAL',
  },
  {
    id: 'platino',
    nombre: 'Platino',
    tagline: 'Liderazgo de cuidado y de marca',
    precioMensualMxn: 1499,
    precioAnualMxn: 14990,
    creditosSalud: 10,
    anunciosPro: 6,
    videoDiamanteClips: 18,
    iaViam: 'Ilimitada equipo',
    beneficiariosMax: 7,
    descuentoCirculoPct: 30,
    creditosCompartibles: 5,
    aporteFondoMxn: 100,
    equipoColaboradores: 3,
    plusResumen: [
      'Todo Oro + capacidad de equipo',
      'Video Diamante: 18 clips/mes',
      'Panel de equipo ContacNeed + Nexus (hasta 3)',
    ],
    saludResumen: [
      '10 créditos/mes en todo el menú',
      '1 protocolo mensual personalizado',
    ],
    negocioResumen: [
      'Mentoría 1:1 mensual (45 min)',
      'Auditoría trimestral de presencia digital',
    ],
    envPriceMonthly: 'STRIPE_PRICE_CMS_PLUS_PLATINO_MONTHLY',
    envPriceAnnual: 'STRIPE_PRICE_CMS_PLUS_PLATINO_ANNUAL',
  },
  {
    id: 'diamante',
    nombre: 'Diamante',
    tagline: 'Máximo cuidado, máxima expansión, máximo legado',
    precioMensualMxn: 2499,
    precioAnualMxn: 24990,
    creditosSalud: 16,
    anunciosPro: 12,
    videoDiamanteClips: 40,
    iaViam: 'Suite completa',
    beneficiariosMax: 10,
    descuentoCirculoPct: 35,
    creditosCompartibles: 8,
    aporteFondoMxn: 160,
    equipoColaboradores: 5,
    plusResumen: [
      'Suite CMS-Plus completa',
      'Video Diamante profesional holgado',
      'Sala privada Diamante + equipo (hasta 5)',
    ],
    saludResumen: [
      '16 créditos/mes',
      'Plan maestro trimestral + retiro/taller anual',
    ],
    negocioResumen: [
      'Estrategia trimestral con el ecosistema',
      'Co-creación de campañas bandera',
    ],
    envPriceMonthly: 'STRIPE_PRICE_CMS_PLUS_DIAMANTE_MONTHLY',
    envPriceAnnual: 'STRIPE_PRICE_CMS_PLUS_DIAMANTE_ANNUAL',
  },
] as const

export function getCmsPlusTier(nivel: string | null | undefined): CmsPlusTier | null {
  if (!nivel) return null
  return CMS_PLUS_NIVELES.find((t) => t.id === nivel) ?? null
}

export function isCmsPlusNivel(value: string): value is CmsPlusNivel {
  return CMS_PLUS_NIVELES.some((t) => t.id === value)
}

export function periodoActual(date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function precioCentavos(nivel: CmsPlusNivel, billing: CmsPlusBilling): number {
  const tier = getCmsPlusTier(nivel)
  if (!tier) throw new Error('Nivel CMS-Plus inválido')
  return billing === 'anual' ? tier.precioAnualMxn * 100 : tier.precioMensualMxn * 100
}

export function nombreProductoStripe(nivel: CmsPlusNivel, billing: CmsPlusBilling): string {
  const tier = getCmsPlusTier(nivel)!
  return billing === 'anual'
    ? `Círculo CMS-Plus ${tier.nombre} — Anual`
    : `Círculo CMS-Plus ${tier.nombre} — Mensual`
}

export const CMS_PLUS_MANIFIESTO =
  'Club de salud física, mental y de expansión económica dentro de un círculo en crecimiento. No es una pirámide: el valor está en el cuidado y en el Plus digital (Sincronía Nexus, ContacNeed, IA VIAM y Video Diamante).'
