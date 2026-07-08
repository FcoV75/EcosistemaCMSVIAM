import { INSTRUMENTALES_CON_FRECUENCIA } from './nexus-instrumentales.mjs';

export const FRECUENCIAS_SOLFEGGIO = {
  174: { etiqueta: 'Alivio del dolor', proposito: 'Tensión física y emocional' },
  285: { etiqueta: 'Renovación celular', proposito: 'Sanación y regeneración' },
  417: { etiqueta: 'Resiliencia y transformación', proposito: 'Disolver bloqueos y energía negativa' },
  528: { etiqueta: 'Amor y paz', proposito: 'Reducir estrés, meditar, encontrar calma' },
  639: { etiqueta: 'Bondad y armonía', proposito: 'Empatía y relaciones sanas' },
  741: { etiqueta: 'Claridad y sabiduría', proposito: 'Intuición y despertar mental' },
  852: { etiqueta: 'Intuición espiritual', proposito: 'Conexión interior profunda' },
  963: { etiqueta: 'Frecuencia de unidad', proposito: 'Conexión espiritual y propósito' },
};

export const ONDAS_CEREBRALES = {
  delta: { hz: 2, etiqueta: 'Sueño reparador', rango: '0.5–4 Hz' },
  theta: { hz: 6, etiqueta: 'Meditación profunda', rango: '4–8 Hz' },
  alpha: { hz: 10, etiqueta: 'Relajación consciente', rango: '8–14 Hz' },
};

const PERFILES_PISTA = {
  174: ['sereine', 'silencio', 'santuario', 'calm', 'rain', 'nocturno'],
  285: ['resonancia', 'renew', 'heal', 'alba', 'luz', 'spirit'],
  417: ['metamorph', 'traves', 'storm', 'journey', 'transcend', 'voyage'],
  528: ['serenity', 'luz', 'alba', 'santuario', 'grace', 'ocean', 'embrace', 'amor'],
  639: ['corazon', 'heart', 'embrace', 'love', 'soul', 'passion'],
  741: ['conciencia', 'veritatis', 'planos', 'lumina', 'clarity', 'luz'],
  852: ['mistica', 'mystic', 'sacred', 'nocturn', 'spirit', 'ancestral'],
  963: ['sacred', 'trascend', 'etern', 'infinito', 'estrellas', 'espiritu', 'lumina', 'eternidad'],
};

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function nombreDesdeUrl(url) {
  if (!url) return 'pista instrumental';
  try {
    const part = decodeURIComponent(url.split('/').pop() || '');
    return part.replace(/\.mp3$/i, '').replace(/_/g, ' ').toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

export function elegirPistaCatalogo(frecuenciaHz, semilla = '') {
  const hz = FRECUENCIAS_SOLFEGGIO[frecuenciaHz] ? frecuenciaHz : 528;
  const keywords = PERFILES_PISTA[hz] || PERFILES_PISTA[528];
  const matched = INSTRUMENTALES_CON_FRECUENCIA.filter((url) => {
    const name = nombreDesdeUrl(url);
    return keywords.some((k) => name.includes(k));
  });
  const pool = matched.length ? matched : INSTRUMENTALES_CON_FRECUENCIA;
  if (!pool.length) {
    return { url: null, titulo: 'pista instrumental' };
  }
  const idx = hashStr(`${semilla}:${hz}`) % pool.length;
  const url = pool[idx];
  return { url, titulo: nombreDesdeUrl(url) };
}

export function normalizarDiagnostico(raw) {
  const hz = Number(raw?.frecuencia_hz);
  const frecuenciaHz = FRECUENCIAS_SOLFEGGIO[hz] ? hz : 528;
  const onda = String(raw?.onda_cerebral || '').toLowerCase();
  const ondaCerebral = ONDAS_CEREBRALES[onda] ? onda : null;
  const fuente = raw?.fuente_audio === 'generada' ? 'generada' : 'catalogo';
  return {
    frecuenciaHz,
    frecuenciaEtiqueta: raw?.frecuencia_etiqueta || FRECUENCIAS_SOLFEGGIO[frecuenciaHz].etiqueta,
    ondaCerebral,
    fuenteAudio: fuente,
    diagnosticoBreve: raw?.diagnostico_breve || '',
  };
}

export function parsearRespuestaIA(texto) {
  const trimmed = String(texto || '').trim();
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    /* fallback below */
  }
  return {
    respuesta: trimmed,
    frecuencia_hz: 528,
    frecuencia_etiqueta: 'Amor y paz',
    onda_cerebral: null,
    fuente_audio: 'catalogo',
    diagnostico_breve: '',
  };
}
