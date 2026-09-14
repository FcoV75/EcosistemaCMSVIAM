import assert from 'node:assert/strict';
import {
  directorFallback,
  inferenciasLocales,
  elegirResumenInferencias,
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
assert.ok(cafeBrief.inferencias.some((x) => /interacci|ambas personas|café|SFW|vestidas/i.test(x)));

const espejo = 'una mujer afroamericana con una manzana en su mano llevándola a su boca mientras se esta observando a si misma en un espejo de cuerpo completo en su recamara';
const espejoInfer = inferenciasLocales(espejo);
assert.ok(espejoInfer.some((x) => /espejo|recámara|manzana/i.test(x)));
assert.doesNotMatch(elegirResumenInferencias(espejoInfer, espejo), /continuidad temporal/i);

const auto = 'Una mujer ucraniana muy elegante manejando un vehículo deportivo muy lujoso por la carretera en un camino entre una montaña, se ve la ciudad a lo lejos';
const autoInfer = inferenciasLocales(auto);
assert.ok(autoInfer.some((x) => /conducci|vehículo|carretera|montaña|ciudad|plano amplio/i.test(x)));
assert.ok(autoInfer.some((x) => /ucranian/i.test(x)));
const resumen = elegirResumenInferencias(autoInfer, auto);
assert.doesNotMatch(resumen, /continuidad temporal|tienda de diamantes|POR LA VENTANA/i);
const autoBrief = directorFallback(auto, 'clip');
assert.doesNotMatch(autoBrief.resumen_es, /continuidad temporal|tienda de diamantes/i);
assert.match(autoBrief.resumen_es, /conducci|vehículo|carretera|montaña|ciudad|ucranian|plano amplio/i);

const tienda = 'Una mujer ucraniana manejando un carro muy lujoso mientras observa por la ventana una tienda de diamantes';
assert.ok(inferenciasLocales(tienda).some((x) => /ventan|tienda|diamante|Interior de auto/i.test(x)));

const cangrejo = 'un cangrejo nadando entre anguilas electricas en un río caudaloso en la montaña';
const cangrejoInfer = inferenciasLocales(cangrejo);
assert.ok(cangrejoInfer.some((x) => /fauna|animales|NO sustituir|personas/i.test(x)));
assert.ok(cangrejoInfer.some((x) => /cangrejo|anguilas|río|rio/i.test(x)));
const cangrejoBrief = directorFallback(cangrejo, 'imagen');
assert.match(cangrejoBrief.brief_visual_en, /wildlife|animal anatomy|No people/i);
assert.doesNotMatch(cangrejoBrief.brief_visual_en, /symmetrical human anatomy/i);
assert.ok(cangrejoBrief.prohibidos.some((x) => /personas|bañistas|mujeres/i.test(x)));

console.log('estudio-director-semantico ok');
