/** Contratos de percepción del órgano piloto (espejo de netlify/functions/lib/organo-contratos.mjs). */

export const ORGANO_VERSION = '1.0.0'
export const ORGANO_ID = 'sincronia-nexus-presencia'

export const MODOS = {
  terapia: {
    id: 'terapia',
    etiqueta: 'Terapia',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'off' },
  },
  calle: {
    id: 'calle',
    etiqueta: 'Calle',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'opt-in' },
  },
  empresa: {
    id: 'empresa',
    etiqueta: 'Empresa',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'off' },
  },
  ocio: {
    id: 'ocio',
    etiqueta: 'Ocio',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'off' },
  },
} as const

export type ModoOrgano = keyof typeof MODOS

export const VETOS = [
  'diagnosticar',
  'presentar_contacto',
  'mover_dinero',
  'grabar',
  'publicar',
  'activar_ojo',
] as const

export const ORGANO_STORAGE_VOZ = 'contacneed_organo_consent_voz_v1'

export function parecePedidoEncuentro(texto: string) {
  return /\b(necesito|busco|qui[eé]n\s+(hace|da|ofrece)|oficio|terapeuta|plomero|electricista|fisioterapeuta|m[eé]dico|abogad|contad|present)/i.test(
    texto,
  )
}
