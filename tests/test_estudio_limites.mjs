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
assert.equal(limitesVozPara({ tier: 'premium' }).maxSeg, LIMITES_VOZ.premium.maxSeg);
assert.equal(limitesVozPara({ tier: 'free' }).maxSeg, LIMITES_VOZ.free.maxSeg);

assert.equal(limitesClipPara({ plan: 'propietario' }).maxSeg, LIMITES_CLIP.propietario.maxSeg);
assert.equal(limitesClipPara({ tier: 'premium' }).maxSeg, LIMITES_CLIP.premium.maxSeg);
assert.ok(!Number.isFinite(limitesClipPara({ permanent: true }).maxDia));

console.log('estudio-limites ok');
