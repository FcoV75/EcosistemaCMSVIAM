import {
  extraerElementos,
  promptVisualFallback,
  promptImagenReforzado,
  promptClipReforzado,
  promptCortoParaFlux,
  reforzarSujetos,
  escenaPidePaisaje,
  escenaEsInteriorOPersonas,
  escenaEsDramatica,
  escenaTieneDosPersonas,
  escenaEsVehiculoOCalle,
  escenaEsConduccionExterior,
  escenaEsVehiculoMirandoAfuera,
  escenaEsEspejoORecamara,
  escenaEsAnimalONaturaleza,
  escenaPidePersonas,
  clausulaMustInclude,
  clausulaProhibidos,
  clausulaCalidadComposicion,
  clausulaAnatomiaHiperrealismo,
  negativosParaEscena,
  seedDesdePrompt,
} from '../netlify/functions/lib/estudio-prompt-visual.mjs';
import assert from 'node:assert/strict';

const panaderia = promptVisualFallback(
  'toma de una panadería al amanecer, el vapor del pan saliendo, cámara lenta, zoom progresivo acabando en el pan',
  'clip',
);
assert.match(panaderia, /^MUST INCLUDE:/);
assert.match(panaderia, /panadería|panaderia|pan/i);
assert.match(panaderia, /bread \(pan\)|bakery/i);
assert.doesNotMatch(panaderia, /LANDSCAPE FIRST/i);

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
assert.ok(escenaPidePaisaje(venadoPrompt));

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

const retrato = 'Retrato de una mujer con sombrero rojo en estudio';
assert.equal(escenaPidePaisaje(retrato), false);
const retratoRef = promptImagenReforzado('A woman with a red hat in a studio', retrato);
assert.match(retratoRef, /Do NOT invent/i);
assert.doesNotMatch(retratoRef, /LANDSCAPE FIRST|flowers, river, mountain as a complete/i);

const clipRef = promptClipReforzado('Bakery at dawn with steam', 'panadería al amanecer con vapor');
assert.match(clipRef, /Cinematic 16:9|clip/i);
assert.match(clipRef, /bakery|panadería|panaderia/i);

// Café + novio: ambos visibles, taza, sin recorte.
const cafePrompt = 'Una muy hermosa mujer oriental obsequiándole un café a su novio que está en su escritorio trabajando en su laptop y éste le sonríe al recibirlo';
assert.ok(escenaEsInteriorOPersonas(cafePrompt));
assert.ok(escenaTieneDosPersonas(cafePrompt));
assert.equal(escenaPidePaisaje(cafePrompt), false);
const cafeRef = promptImagenReforzado('A beautiful East Asian woman giving coffee to her boyfriend at a desk with a laptop', cafePrompt);
assert.match(cafeRef, /BOTH people|Coffee cup clearly|full scene|correct.*anatomy|SFW|fully clothed/i);
assert.match(cafeRef, /coffee|café|cafe|laptop|escritorio|novio|mujer/i);
assert.match(clausulaProhibidos(cafePrompt), /only one person|coffee cup|second person|nude|NSFW/i);
assert.match(negativosParaEscena(cafePrompt), /missing boyfriend|cropped head|bad anatomy|nude|nsfw|deformed face|asymmetric eyes|melted/i);
const cafeCorto = promptCortoParaFlux(cafePrompt, cafeRef);
assert.match(cafeCorto, /SCENE|MUST SHOW|SFW|symmetrical face|five fingers|hyperrealistic/i);
assert.match(cafeCorto, /coffee|East Asian|boyfriend|laptop|desk|mujer|novio|cafe/i);
assert.ok(cafeCorto.length <= 850);

// Espejo + manzana + recámara (prompt real del usuario).
const espejoPrompt = 'una mujer afroamericana con una manzana en su mano llevándola a su boca mientras se esta observando a si misma en un espejo de cuerpo completo en su recamara';
assert.ok(escenaEsEspejoORecamara(espejoPrompt));
const espejoCorto = promptCortoParaFlux(espejoPrompt, '');
assert.match(espejoCorto, /SCENE:|apple|mirror|bedroom|African American/i);
assert.doesNotMatch(espejoCorto.slice(0, 200), /^SFW fully clothed Ultra HD/); // escena primero
assert.match(negativosParaEscena(espejoPrompt), /missing mirror|missing apple|outdoor/i);

// Auto de lujo en carretera de montaña (no tienda de diamantes).
const autoPrompt = 'Una mujer ucraniana muy elegante manejando un vehículo deportivo muy lujoso por la carretera en un camino entre una montaña, se ve la ciudad a lo lejos';
assert.ok(escenaEsVehiculoOCalle(autoPrompt));
assert.ok(escenaEsConduccionExterior(autoPrompt));
assert.equal(escenaEsVehiculoMirandoAfuera(autoPrompt), false);
const autoRef = promptImagenReforzado('Ukrainian woman driving luxury sports car on mountain road city far away', autoPrompt);
assert.match(autoRef, /sports car|mountain road|city|Ukrainian|SFW|Wide shot/i);
assert.match(clausulaProhibidos(autoPrompt), /solo beauty portrait|missing sports car|mountain road|distant city/i);
assert.doesNotMatch(clausulaProhibidos(autoPrompt), /diamond store/i);
assert.match(negativosParaEscena(autoPrompt), /missing sports car|mountain road|city skyline/i);
const autoCorto = promptCortoParaFlux(autoPrompt, autoRef);
assert.match(autoCorto, /SCENE:|Ukrainian|sports car|mountain|city|vehicle/i);
assert.ok(autoCorto.indexOf('SCENE:') < autoCorto.indexOf('SFW') || /SCENE:/.test(autoCorto));

const volcanPrompt = 'un volcán haciendo erupción en una isla con una fumarola muy alta vista desde un avión, hay relámpagos y rayos en la nube piroclástica';
assert.ok(escenaEsDramatica(volcanPrompt));
assert.ok(escenaPidePaisaje(volcanPrompt));
const volcanRef = promptClipReforzado('Volcano erupting on an island with lightning in pyroclastic cloud from airplane', volcanPrompt);
assert.match(volcanRef, /eruption|FORBIDDEN|lightning|volcan/i);
assert.match(clausulaProhibidos(volcanPrompt), /peaceful lake|postcard|eruption/i);
assert.match(negativosParaEscena(volcanPrompt), /peaceful lake|postcard/i);
assert.match(clausulaCalidadComposicion(volcanPrompt), /Hyperrealistic|anatomy|symmetrical|Medium-wide|8k/i);

// Gato siamés + casco + cometa.
const gatoPrompt = 'un gato siamés con un casco de astronauta arriba de un cometa que está pasando al lado del sol mientras observa las estrellas y los planetas';
const gatoRef = promptClipReforzado('Siamese cat with astronaut helmet on a comet near the sun', gatoPrompt);
assert.match(gatoRef, /Siamese|cream body|astronaut helmet|comet/i);
assert.match(clausulaProhibidos(gatoPrompt), /grey tabby|helmet/i);
assert.match(negativosParaEscena(gatoPrompt), /grey tabby|helmet/i);
assert.ok(extraerElementos(gatoPrompt).some((w) => /siamés|siames/i.test(w)));
assert.ok(extraerElementos(gatoPrompt).some((w) => /casco/i.test(w)));

assert.match(clausulaAnatomiaHiperrealismo('una mujer en estudio', { corto: true }), /symmetrical face|five fingers|8k/i);
assert.match(clausulaAnatomiaHiperrealismo('una mujer en estudio', { corto: false }), /human anatomy|symmetrical face|Landscapes|perspective/i);
assert.match(clausulaAnatomiaHiperrealismo('un cangrejo nadando', { corto: true }), /wildlife|animal|No people/i);
assert.doesNotMatch(clausulaAnatomiaHiperrealismo('un cangrejo nadando', { corto: true }), /symmetrical face|five fingers/i);

// Cangrejo + anguilas: fauna, sin sesgo a personas (caso real del usuario).
const cangrejoPrompt = 'un cangrejo nadando entre anguilas electricas en un río caudaloso en la montaña';
assert.ok(escenaEsAnimalONaturaleza(cangrejoPrompt));
assert.equal(escenaPidePersonas(cangrejoPrompt), false);
const cangrejoMust = clausulaMustInclude(cangrejoPrompt);
assert.match(cangrejoMust, /crab \(cangrejo\)|cangrejo/i);
assert.match(cangrejoMust, /eel|anguila/i);
const cangrejoFb = promptVisualFallback(cangrejoPrompt, 'imagen');
assert.match(cangrejoFb, /crab|cangrejo|eel|anguila|wildlife|No people|FORBIDDEN: people/i);
assert.doesNotMatch(cangrejoFb, /Perfect human anatomy|SFW fully clothed|beauty headshot/i);
assert.match(clausulaProhibidos(cangrejoPrompt), /people|women|human bathers/i);
assert.match(negativosParaEscena(cangrejoPrompt), /people|women|bathers|replacing animals/i);
const cangrejoCorto = promptCortoParaFlux(cangrejoPrompt, '');
assert.match(cangrejoCorto, /SCENE:|wildlife|crab|eel/i);
assert.match(cangrejoCorto, /crab swimming among electric eels|Animals only/i);
assert.doesNotMatch(cangrejoCorto, /perfect symmetrical face|SFW opaque clothes|5 fingers per hand/i);
assert.ok(cangrejoCorto.length <= 850);

const s1 = seedDesdePrompt('escena A');
const s2 = seedDesdePrompt('escena B distinta');
assert.ok(Number.isFinite(s1) && Number.isFinite(s2));
assert.notEqual(s1, s2);

console.log('estudio-prompt-visual ok');
