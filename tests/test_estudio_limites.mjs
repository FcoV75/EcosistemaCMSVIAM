import assert from 'node:assert/strict';
import {
  clamp,
  esPremiumPayload,
  esPropietarioPayload,
  limitesClipPara,
  limitesVozPara,
  recortarTextoParaVoz,
  partirTexto,
  LIMITES_VOZ,
  LIMITES_CLIP,
} from '../netlify/functions/lib/estudio-limites.mjs';

const corto = recortarTextoParaVoz('hola mundo', 30);
assert.equal(corto.recortado, false);
assert.equal(corto.palabras, 2);

const largo = recortarTextoParaVoz(Array.from({ length: 400 }, (_, i) => `p${i}`).join(' '), 30);
assert.equal(largo.recortado, true);
assert.ok(largo.palabras <= 72);

const partes = partirTexto('Uno. Dos. Tres. Cuatro.', 8);
assert.ok(partes.length >= 2);

assert.equal(clamp(3.2, 8, 30), 8);
assert.equal(clamp(99, 8, 30), 30);
assert.equal(clamp(12, 8, 30), 12);
assert.equal(clamp(40, 8, Number.POSITIVE_INFINITY), 40);

assert.equal(esPropietarioPayload({ permanent: true, tier: 'premium' }), true);
assert.equal(esPropietarioPayload({ plan: 'propietario' }), true);
assert.equal(esPropietarioPayload({ tier: 'premium' }), false);
assert.equal(esPropietarioPayload({ tier: 'free' }), false);

assert.equal(esPremiumPayload({ permanent: true }), true);
assert.equal(esPremiumPayload({ tier: 'premium' }), true);
assert.equal(esPremiumPayload({ tier: 'free' }), false);

assert.equal(limitesVozPara({ permanent: true }).maxSeg, LIMITES_VOZ.propietario.maxSeg);
assert.ok(!Number.isFinite(limitesVozPara({ permanent: true }).maxSeg));
assert.equal(limitesVozPara({ tier: 'premium' }).maxSeg, LIMITES_VOZ.premium.maxSeg);
assert.equal(limitesVozPara({ tier: 'free' }).maxSeg, LIMITES_VOZ.free.maxSeg);

const ownerSpeech = recortarTextoParaVoz(Array.from({ length: 400 }, (_, i) => `p${i}`).join(' '), Number.POSITIVE_INFINITY);
assert.equal(ownerSpeech.recortado, false);
assert.equal(ownerSpeech.palabras, 400);

assert.equal(limitesClipPara({ plan: 'propietario' }).maxSeg, LIMITES_CLIP.propietario.maxSeg);
assert.equal(limitesClipPara({ tier: 'premium' }).maxSeg, LIMITES_CLIP.premium.maxSeg);
assert.ok(!Number.isFinite(limitesClipPara({ permanent: true }).maxDia));

// Chunking alineado con client/server (~420 chars).
const speech60 = Array.from({ length: 144 }, (_, i) => `palabra${i}`).join(' ');
assert.ok(partirTexto(speech60, 420).length >= 2);

console.log('estudio-limites ok');
