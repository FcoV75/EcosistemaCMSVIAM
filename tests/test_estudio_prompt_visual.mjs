import { promptVisualFallback, reforzarSujetos } from '../netlify/functions/lib/estudio-prompt-visual.mjs';
import assert from 'node:assert/strict';

const panaderia = promptVisualFallback(
  'toma de una panadería al amanecer, el vapor del pan saliendo, cámara lenta, zoom progresivo acabando en el pan',
  'clip',
);
assert.match(panaderia, /panadería|panaderia|pan/i);
assert.match(panaderia, /OBEY THIS SCENE EXACTLY/);
assert.doesNotMatch(panaderia, /^toma de una panadería/);

const venado = reforzarSujetos(
  'Un venado y una cebra en una montaña observando juntos un atardecer entre la exuberante vegetación',
);
assert.match(venado, /venado AND/i);
assert.match(venado, /cebra/i);
assert.match(venado, /BOTH|ALL of these must be visible/i);

const simple = promptVisualFallback('Atardecer en Acapulco', 'imagen');
assert.match(simple, /Acapulco/);
assert.match(simple, /sky, clouds/);

console.log('estudio-prompt-visual ok');
