export const FREE_DAILY_POSTS = 15
export const PRO_DAILY_POSTS = 30

/** Imágenes de productos/servicios en la galería de tienda (sin contar el banner). */
export const FREE_TIENDA_MAX_ITEMS = 5
export const PRO_TIENDA_MAX_ITEMS = 100

export const PRO_ADS_INCLUDED = 1
export const PRO_EXTRA_ADS_PACK_SIZE = 5
export const PRO_EXTRA_ADS_PACK_PRICE_MXN = 500

export const FREE_PLAN_FEATURES = [
  'Registro gratis (correo o Google) y perfil de oficio/profesión',
  'Pizarra nacional: publica, comenta, reacciona y comparte',
  'Hasta 15 publicaciones diarias en la pizarra',
  'Mensajes, solicitudes de amistad/servicio y avisos',
  'Tienda básica: 1 banner + hasta 5 imágenes de productos',
  'Asistente IA de tienda con sugerencias',
  'Escuela de principios, Radio VIAM y búsqueda de personas',
  'Comentarios ilimitados en publicaciones ajenas',
] as const

export const PRO_PLAN_FEATURES = [
  'Todo lo del plan gratuito, ampliado',
  'Hasta 30 publicaciones diarias en la pizarra',
  'Chat en vivo ilimitado',
  'Grupos privados (familia, equipo, proveedores)',
  'Mi Proyecto: obras serias con grupos estratégicos y cierre con mantenimiento',
  'Ubicación GPS en Google Maps para tu negocio',
  '1 anuncio PRO incluido en el Espacio PRO',
  'Paquete extra: +5 anuncios por $500 MXN',
  'Informe mensual de tendencias y productos top (en Mensajes)',
  'Tienda ampliada (hasta 100 ítems) y visibilidad PRO',
] as const

export function getDailyPostLimit(isPro: boolean) {
  return isPro ? PRO_DAILY_POSTS : FREE_DAILY_POSTS
}

export function getStoreItemLimit(isPro: boolean) {
  return isPro ? PRO_TIENDA_MAX_ITEMS : FREE_TIENDA_MAX_ITEMS
}

export function getMaxProAds(extraAdSlots: number) {
  return PRO_ADS_INCLUDED + Math.max(0, extraAdSlots)
}

export function getStartOfTodayIso() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

export function formatPlanLimitMessage(used: number, limit: number, label: string) {
  const remaining = Math.max(0, limit - used)
  return `${label}: ${used}/${limit} hoy · te quedan ${remaining}`
}
