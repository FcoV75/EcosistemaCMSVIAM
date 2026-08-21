/**
 * Contratos de percepción del órgano piloto: Sincronía Nexus Presencia.
 * Fuente de verdad compartida con el cliente (Assets/organo-piloto.js)
 * y con ContacNeed (src/lib/organo-contratos.ts). Cambiar aquí es cambiar la ética del agente.
 */

export const ORGANO_VERSION = '1.0.0';
export const ORGANO_ID = 'sincronia-nexus-presencia';

export const MODOS = Object.freeze({
  terapia: {
    id: 'terapia',
    etiqueta: 'Terapia',
    proposito: 'Acompañar cuerpo y mente. El agente puede callar.',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'off' },
    skills: ['filtro_decision', 'frecuencia', 'cuerpo', 'silencio'],
  },
  calle: {
    id: 'calle',
    etiqueta: 'Calle',
    proposito: 'Encuentro consentido en el mundo real. Nunca presenta sin veto.',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'opt-in' },
    skills: ['encuentro', 'filtro_decision', 'silencio'],
  },
  empresa: {
    id: 'empresa',
    etiqueta: 'Empresa',
    proposito: 'Oficio y encargos. Lo irreversible se confirma.',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'off' },
    skills: ['filtro_decision', 'orquestar', 'silencio'],
  },
  ocio: {
    id: 'ocio',
    etiqueta: 'Ocio',
    proposito: 'Arte y descanso que regeneran atención, no la extraen.',
    canales: { voz: 'opt-in', oido: 'on', ojo: 'off' },
    skills: ['frecuencia', 'silencio'],
  },
});

export const CANALES = Object.freeze({
  voz: {
    id: 'voz',
    organo: 'micrófono',
    faro: true,
    persistirCrudo: false,
    default: false,
    consentimiento: 'consent_voz',
  },
  oido: {
    id: 'oido',
    organo: 'audífonos / síntesis de voz',
    faro: false,
    persistirCrudo: false,
    default: true,
    consentimiento: null,
  },
  ojo: {
    id: 'ojo',
    organo: 'cámara / lentes',
    faro: true,
    persistirCrudo: false,
    default: false,
    consentimiento: 'consent_ojo',
  },
});

export const VETOS = Object.freeze([
  'diagnosticar',
  'presentar_contacto',
  'mover_dinero',
  'grabar',
  'publicar',
  'activar_ojo',
]);

export const MEMORIA = Object.freeze({
  episodica: 'resumen_texto',
  semantica: 'preferencias_nexus',
  clinica: 'nunca_sin_consentimiento',
  crudoSensorial: 'nunca_nube',
  retencionDias: 30,
  maxEpisodios: 12,
});

export const SKILLS = Object.freeze({
  filtro_decision: {
    id: 'filtro_decision',
    etiqueta: 'Triple Filtro Nexus',
    irreversible: false,
    descripcion: '¿Es verdad? ¿Es bondadoso? ¿Es útil ahora?',
  },
  frecuencia: {
    id: 'frecuencia',
    etiqueta: 'Frecuencia personalizada',
    irreversible: false,
    descripcion: 'Pista instrumental con Solfeggio en segundo plano.',
  },
  encuentro: {
    id: 'encuentro',
    etiqueta: 'Encuentro ContacNeed',
    irreversible: true,
    veto: 'presentar_contacto',
    descripcion: 'Propone personas. Nunca envía la presentación sola.',
  },
  cuerpo: {
    id: 'cuerpo',
    etiqueta: 'Cuerpo en el loop',
    irreversible: true,
    veto: 'diagnosticar',
    descripcion: 'Observa malestar y deriva a terapeuta. No diagnostica.',
  },
  orquestar: {
    id: 'orquestar',
    etiqueta: 'Mesa de oficio',
    irreversible: false,
    descripcion: 'Descompone un encargo. Pide veto si hay dinero o publicación.',
  },
  silencio: {
    id: 'silencio',
    etiqueta: 'Saber callar',
    irreversible: false,
    descripcion: 'Si no aporta, no habla.',
  },
});

export function contratoPublico() {
  return {
    version: ORGANO_VERSION,
    id: ORGANO_ID,
    nombre: 'Sincronía Nexus Presencia',
    tesis:
      'Una presencia, seis órganos de salud. La interfaz es voz, oído y (con permiso) ojo. El humano veta lo irreversible.',
    canales: CANALES,
    modos: MODOS,
    vetos: VETOS,
    memoria: MEMORIA,
    skills: SKILLS,
    faro: {
      regla: 'Si el micrófono o la cámara están activos, el faro es visible e inconfundible.',
      apagado: 'Un toque apaga percepción. El silencio es el estado por defecto.',
    },
  };
}

export function modoValido(modo) {
  return Object.prototype.hasOwnProperty.call(MODOS, modo) ? modo : 'terapia';
}

export function canalPermitidoEnModo(modo, canal) {
  const m = MODOS[modoValido(modo)];
  const regla = m.canales[canal];
  if (!regla || regla === 'off') return false;
  return regla === 'on' || regla === 'opt-in';
}
