export const SOPORTE_EVENT = 'contacneed-abrir-soporte'

export function abrirSoporte(question?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SOPORTE_EVENT, { detail: { question } }))
}
