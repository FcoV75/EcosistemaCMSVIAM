import { recortarTextoParaVoz, partirTexto, clamp } from '../netlify/functions/lib/estudio-limites.mjs';
import assert from 'node:assert/strict';

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

console.log('estudio-limites ok');
