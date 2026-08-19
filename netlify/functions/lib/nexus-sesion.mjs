/** Ventanas de plática continua de Sincronía Nexus. Música solo en el primer consejo del día. */

export const PLAN_PUBLICO = 'publico';
export const PLAN_MIEMBRO = 'miembro';

export const PLANES = Object.freeze({
  publico: {
    id: PLAN_PUBLICO,
    ventanaMs: 10 * 60 * 1000,
    maxMensajes: 24,
    etiqueta: '10 minutos',
    errorAgotada:
      'Tu plática gratuita de 10 minutos de hoy llegó a su fin. Mañana Nexus te vuelve a escuchar, o entra al Santuario para 30 minutos de acompañamiento.',
    errorTope:
      'Has conversado con mucha profundidad en tu muestra de hoy. Integra lo recibido; mañana o en el Santuario seguimos.',
  },
  miembro: {
    id: PLAN_MIEMBRO,
    ventanaMs: 30 * 60 * 1000,
    maxMensajes: 48,
    etiqueta: '30 minutos',
    errorAgotada:
      'Tu plática de 30 minutos de hoy llegó a su fin. Integra lo que surgió; mañana el Santuario abre de nuevo la conversación. La música del día puede seguir sonando.',
    errorTope:
      'Has llegado al tope de mensajes de la plática de hoy. Descansa en la frecuencia; mañana seguimos.',
  },
});

export const MAX_HISTORIA = 16;

export function diaIso(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function sesionVacia(now = Date.now()) {
  return {
    day: diaIso(now),
    startedAt: now,
    mensajes: 0,
    historia: [],
    musica: null,
  };
}

export function hidratarSesion(previa, now = Date.now()) {
  const day = diaIso(now);
  if (!previa || previa.day !== day) return sesionVacia(now);
  return {
    day: previa.day,
    startedAt: Number(previa.startedAt) || now,
    mensajes: Number(previa.mensajes) || 0,
    historia: Array.isArray(previa.historia) ? previa.historia : [],
    musica: previa.musica || null,
  };
}

export function recortarHistoria(historia) {
  const list = Array.isArray(historia) ? historia : [];
  return list.slice(-MAX_HISTORIA);
}

/**
 * Autoriza un turno. No muta la sesión hasta registrarTurno.
 * esPrimera: aún no hay música del día (primer consejo).
 */
export function autorizarTurno(sesion, { now = Date.now(), plan = PLAN_PUBLICO, permanente = false } = {}) {
  const cfg = PLANES[plan] || PLANES.publico;
  const s = hidratarSesion(sesion, now);
  const esPrimera = !s.musica;

  if (permanente) {
    return {
      ok: true,
      esPrimera,
      restanteMs: null,
      sesion: s,
      plan: cfg.id,
    };
  }

  if (s.mensajes === 0) {
    return {
      ok: true,
      esPrimera: true,
      restanteMs: cfg.ventanaMs,
      sesion: { ...s, startedAt: now, day: diaIso(now) },
      plan: cfg.id,
    };
  }

  const restanteMs = Math.max(0, s.startedAt + cfg.ventanaMs - now);
  if (restanteMs <= 0) {
    return { ok: false, esPrimera, restanteMs: 0, sesion: s, plan: cfg.id, error: cfg.errorAgotada };
  }
  if (s.mensajes >= cfg.maxMensajes) {
    return { ok: false, esPrimera, restanteMs, sesion: s, plan: cfg.id, error: cfg.errorTope };
  }

  return { ok: true, esPrimera, restanteMs, sesion: s, plan: cfg.id };
}

export function registrarTurno(sesion, { mensaje, reply, musica, now = Date.now() }) {
  const s = hidratarSesion(sesion, now);
  const historia = recortarHistoria([
    ...s.historia,
    { role: 'user', content: String(mensaje || '').slice(0, 4000) },
    { role: 'assistant', content: String(reply || '').slice(0, 4000) },
  ]);
  return {
    ...s,
    mensajes: (s.mensajes || 0) + 1,
    historia,
    musica: s.musica || musica || null,
  };
}

export function payloadMusica(musica) {
  if (!musica) return {};
  return {
    frecuenciaHz: musica.frecuenciaHz,
    frecuenciaEtiqueta: musica.frecuenciaEtiqueta,
    frecuenciaProposito: musica.frecuenciaProposito || '',
    ondaCerebral: musica.ondaCerebral || null,
    ondaEtiqueta: musica.ondaEtiqueta || null,
    fuenteAudio: musica.fuenteAudio || 'catalogo',
    diagnosticoBreve: musica.diagnosticoBreve || '',
    audioUrl: musica.audioUrl || null,
    tituloPista: musica.tituloPista || '',
  };
}
