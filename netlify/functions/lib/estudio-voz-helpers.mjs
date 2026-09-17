/** Helpers compartidos de Voz IA: chunking, wrap TTS Gemini, stitch. */

import { partirTexto, PALABRAS_POR_SEGUNDO } from './estudio-limites.mjs';

/** Chars por chunk en cliente / solo_tts (~60–80 palabras). */
export const CHUNK_CHARS_VOZ = 420;

/** Tope duro por request solo_tts (evita abusos y timeouts). */
export const MAX_CHARS_SOLO_TTS = 1200;

/** Timeout cliente sugerido por chunk (ms). */
export const TIMEOUT_CHUNK_CLIENTE_MS = 52000;

/**
 * Envuelve el texto para Gemini TTS.
 * Sin wrap, el modelo a veces “escribe” texto y responde 400:
 * "Model tried to generate text, but it should only be used for TTS..."
 */
export function envolverTextoTtsGemini(texto) {
  const t = String(texto || '').trim();
  if (!t) return t;
  if (/^(say clearly|lee en voz alta|read aloud|speak the following)/i.test(t)) {
    return t;
  }
  return `Lee en voz alta el siguiente texto en español, con naturalidad y claridad. No añadas comentarios ni explicaciones:\n\n${t}`;
}

/** Alternativa corta (algunos modelos responden mejor a instrucción en inglés). */
export function envolverTextoTtsGeminiAlt(texto) {
  const t = String(texto || '').trim();
  if (!t) return t;
  if (/^(say clearly|lee en voz alta|read aloud)/i.test(t)) return t;
  return `Say clearly in Spanish:\n${t}`;
}

export function partirTextoVoz(texto, maxChars = CHUNK_CHARS_VOZ) {
  return partirTexto(texto, maxChars);
}

/** Palabras objetivo para una duración a ~2.4 wps. */
export function palabrasParaSegundos(seg) {
  return Math.max(1, Math.round(Number(seg) * PALABRAS_POR_SEGUNDO));
}

/** Genera un speech ficticio de N palabras (tests / live harness). */
export function speechFicticio(palabras) {
  const n = Math.max(1, Math.round(Number(palabras) || 1));
  const base = [
    'Hoy presentamos el ecosistema creativo VIAM con claridad y ritmo natural.',
    'Cada escena cuenta una historia breve, útil y memorable para el público.',
    'La voz guía al oyente sin prisa, con pausas y énfasis en lo importante.',
    'Cerramos con una invitación sencilla a crear, compartir y seguir aprendiendo.',
  ];
  const out = [];
  let i = 0;
  while (out.length < n) {
    const frase = base[i % base.length].split(/\s+/);
    for (const p of frase) {
      if (out.length >= n) break;
      out.push(p);
    }
    i += 1;
  }
  return out.join(' ');
}

/** Une buffers de audio (MP3 frame stream concat; suficiente para PlayAI/lamejs). */
export function stitchAudioBuffers(buffers) {
  const parts = (buffers || []).filter((b) => b && b.length);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return Buffer.concat(parts);
}

/** ¿Debe saltarse la cuota diaria? Chunks secundarios de una misma sesión. */
export function debeSaltarCuotaVoz({ soloTts, chunkIndex } = {}) {
  return !!soloTts && Number(chunkIndex) > 0;
}
