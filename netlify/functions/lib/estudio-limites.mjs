/** Límites honestos del Estudio VIAM Creativo (voz, movimiento, clip IA). */

export const LIMITES_VOZ = {
  free: { maxSeg: 30, maxDia: 3 },
  premium: { maxSeg: 240, maxDia: 20 },
};

export const LIMITES_CLIP = {
  free: { minSeg: 8, maxSeg: 8, maxDia: 1 },
  premium: { minSeg: 8, maxSeg: 12, maxDia: 5 },
};

export const LIMITES_MOVIMIENTO = {
  free: 5,
  premium: 30,
};

export const PALABRAS_POR_SEGUNDO = 2.4;

export function esPremiumPayload(payload) {
  return payload?.tier === 'premium' || payload?.plan === 'premium' || payload?.plan === 'propietario';
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

export function recortarTextoParaVoz(texto, maxSeg) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const palabras = limpio ? limpio.split(' ') : [];
  const maxPalabras = Math.max(18, Math.round(maxSeg * PALABRAS_POR_SEGUNDO));
  if (palabras.length <= maxPalabras) {
    return { texto: limpio, recortado: false, palabras: palabras.length };
  }
  return {
    texto: `${palabras.slice(0, maxPalabras).join(' ')}.`,
    recortado: true,
    palabras: maxPalabras,
  };
}

export function partirTexto(texto, maxChars = 420) {
  const t = String(texto || '').trim();
  if (t.length <= maxChars) return t ? [t] : [];
  const partes = [];
  const oraciones = t.split(/(?<=[.!?…])\s+/);
  let actual = '';
  for (const ora of oraciones) {
    if (!ora) continue;
    if (ora.length > maxChars) {
      if (actual) {
        partes.push(actual.trim());
        actual = '';
      }
      for (let i = 0; i < ora.length; i += maxChars) {
        partes.push(ora.slice(i, i + maxChars).trim());
      }
      continue;
    }
    if (`${actual} ${ora}`.trim().length > maxChars) {
      if (actual) partes.push(actual.trim());
      actual = ora;
    } else {
      actual = `${actual} ${ora}`.trim();
    }
  }
  if (actual) partes.push(actual.trim());
  return partes.filter(Boolean);
}
