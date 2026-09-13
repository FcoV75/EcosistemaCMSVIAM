import assert from 'node:assert/strict';
import {
  directorFallback,
  inferenciasLocales,
  briefAPromptVisual,
  briefAGuiaOral,
} from '../netlify/functions/lib/estudio-director-semantico.mjs';

const camaleon = 'un camaleón caminando continuamente por un árbol, una piedra, un hielo, un desierto, una fruta y un vehículo blanco';
const infer = inferenciasLocales(camaleon);
assert.ok(infer.some((x) => /cambia de color|superficies/i.test(x)));

const brief = directorFallback(camaleon, 'clip');
assert.equal(brief.modalidad, 'clip');
assert.match(brief.brief_visual_en, /camaleón|chameleon|árbol|arbol|tree/i);
assert.ok(brief.inferencias.some((x) => /color/i.test(x)));
assert.match(briefAPromptVisual(brief, { motion: true }), /World logic|MUST INCLUDE|Exact meaning/i);
assert.ok(briefAGuiaOral(brief).length > 10);

const cafe = 'una mujer oriental ofrece un café a su novio en el escritorio con laptop';
const cafeBrief = directorFallback(cafe, 'imagen');
assert.ok(cafeBrief.inferencias.some((x) => /interacci|ambas personas|café/i.test(x)));

console.log('estudio-director-semantico ok');
