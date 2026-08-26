import { extraerElementos, promptVisualFallback, reforzarSujetos } from '../netlify/functions/lib/estudio-prompt-visual.mjs';
import assert from 'node:assert/strict';

const panaderia = promptVisualFallback(
  'toma de una panadería al amanecer, el vapor del pan saliendo, cámara lenta, zoom progresivo acabando en el pan',
  'clip',
);
assert.match(panaderia, /^MUST INCLUDE:/);
assert.match(panaderia, /panadería|panaderia|pan/i);
assert.match(panaderia, /bread \(pan\)|bakery/i);

const elementosPan = extraerElementos(
  'toma de una panadería al amanecer, el vapor del pan saliendo, cámara lenta, zoom progresivo acabando en el pan',
);
assert.ok(elementosPan.some((w) => /panadería|panaderia/i.test(w)));
assert.ok(elementosPan.some((w) => /^pan$/i.test(w)));

const venadoPrompt = 'Un venado y una cebra en una montaña observando juntos un atardecer entre la exuberante vegetación';
const elementos = extraerElementos(venadoPrompt);
assert.ok(elementos.some((w) => /venado/i.test(w)));
assert.ok(elementos.some((w) => /cebra/i.test(w)));
assert.ok(elementos.some((w) => /montaña|montana/i.test(w)));
assert.match(promptVisualFallback(venadoPrompt, 'imagen'), /deer \(venado\)|venado/i);
assert.match(promptVisualFallback(venadoPrompt, 'imagen'), /zebra \(cebra\)|cebra/i);

const venado = reforzarSujetos(venadoPrompt);
assert.match(venado, /venado AND/i);
assert.match(venado, /cebra/i);
assert.match(venado, /BOTH|ALL of these must be visible/i);

const colibriPrompt = 'Un colibrí de colores brillantes y variados volando de un lirio a otro libando sus pistilos en la orilla de un rio de una montaña exuberante por el atardecer';
const elementosColibri = extraerElementos(colibriPrompt);
assert.ok(elementosColibri.some((w) => /colibrí|colibri/i.test(w)));
assert.ok(elementosColibri.some((w) => /lirio/i.test(w)));
assert.ok(elementosColibri.some((w) => /montaña|montana/i.test(w)));
assert.ok(!elementosColibri.some((w) => /^volando$/i.test(w)));

const colibriFb = promptVisualFallback(colibriPrompt, 'clip');
assert.match(colibriFb, /hummingbird \(colibrí\)|colibrí|colibri/i);
assert.match(colibriFb, /lily \(lirio\)|lirio/i);
assert.match(colibriFb, /river|río|rio/i);
assert.match(colibriFb, /FORBIDDEN: empty blue sky/i);
assert.doesNotMatch(colibriFb, /brillantes AND/i);

const simple = promptVisualFallback('Atardecer en Acapulco', 'imagen');
assert.match(simple, /Acapulco/);
assert.match(simple, /sky, clouds/);

console.log('estudio-prompt-visual ok');
