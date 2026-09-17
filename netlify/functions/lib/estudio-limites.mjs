/** Límites honestos del Estudio VIAM Creativo (voz, movimiento, clip IA). */

export const LIMITES_VOZ = {
  free: { maxSeg: 30, maxDia: 3 },
  premium: { maxSeg: 240, maxDia: 20 },
  /** Solo propietario: sin tope de duración ni diario (el speech completo se respeta). */
  propietario: { maxSeg: Number.POSITIVE_INFINITY, maxDia: Number.POSITIVE_INFINITY },
};

export const LIMITES_CLIP = {
  free: { minSeg: 8, maxSeg: 8, maxDia: 1 },
  premium: { minSeg: 8, maxSeg: 12, maxDia: 5 },
  propietario: { minSeg: 8, maxSeg: 60, maxDia: Number.POSITIVE_INFINITY },
};

export const LIMITES_MOVIMIENTO = {
  free: 5,
  premium: 30,
  propietario: Number.POSITIVE_INFINITY,
};

export const PALABRAS_POR_SEGUNDO = 2.4;

/** Propietario del ecosistema (código owner / permanent), no Premium de pago. */
export function esPropietarioPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.permanent === true) return true;
  if (payload.plan === 'propietario') return true;
  if (payload.tier === 'owner') return true;
  return false;
}

export function esPremiumPayload(payload) {
  if (esPropietarioPayload(payload)) return true;
  return payload?.tier === 'premium' || payload?.plan === 'premium';
}

export function limitesVozPara(payload) {
  if (esPropietarioPayload(payload)) return LIMITES_VOZ.propietario;
  return esPremiumPayload(payload) ? LIMITES_VOZ.premium : LIMITES_VOZ.free;
}

export function limitesClipPara(payload) {
  if (esPropietarioPayload(payload)) return LIMITES_CLIP.propietario;
  return esPremiumPayload(payload) ? LIMITES_CLIP.premium : LIMITES_CLIP.free;
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  const techo = Number.isFinite(max) ? max : x;
  return Math.max(min, Math.min(techo, Math.round(x)));
}

export function recortarTextoParaVoz(texto, maxSeg) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const palabras = limpio ? limpio.split(' ') : [];
  // Propietario / sin tope: no recortar ni condensar.
  if (!Number.isFinite(Number(maxSeg)) || Number(maxSeg) <= 0) {
    return { texto: limpio, recortado: false, palabras: palabras.length };
  }
  const maxPalabras = Math.max(18, Math.round(Number(maxSeg) * PALABRAS_POR_SEGUNDO));
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
