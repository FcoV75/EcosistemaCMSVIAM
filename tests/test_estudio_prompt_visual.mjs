import {
  extraerElementos,
  promptVisualFallback,
  promptImagenReforzado,
  promptClipReforzado,
  promptCortoParaFlux,
  promptMotionParaVideo,
  beatsActuacionParaClip,
  reforzarSujetos,
  escenaPidePaisaje,
  escenaEsInteriorOPersonas,
  escenaEsExteriorNoche,
  escenaPideActuacion,
  escenaEsDramatica,
  escenaEsPescaEpica,
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

// Fogata + baile + luna (caso real del usuario): NO interior; sí actuación y campfire.
const fogataPrompt = 'una mujer bailando alrededor de una fogata alta en medio del bosque por la noche con la luna llena y el cielo muy estrellado';
assert.ok(escenaEsExteriorNoche(fogataPrompt));
assert.ok(escenaPideActuacion(fogataPrompt));
assert.ok(escenaPidePaisaje(fogataPrompt));
assert.equal(escenaEsInteriorOPersonas(fogataPrompt), false);
assert.match(clausulaMustInclude(fogataPrompt), /campfire \(fogata\)|fogata/i);
assert.match(clausulaMustInclude(fogataPrompt), /dancing \(bailando\)|bailando/i);
assert.match(clausulaProhibidos(fogataPrompt), /campfire|starry|dancing|static/i);
assert.doesNotMatch(clausulaProhibidos(fogataPrompt), /INDOOR \/ people scene/i);
const fogataCorto = promptCortoParaFlux(fogataPrompt, '');
assert.match(fogataCorto, /campfire|DANCING|full moon|starry/i);
assert.doesNotMatch(fogataCorto, /Indoor setting/i);
const fogataClip = promptClipReforzado('woman dancing around campfire', fogataPrompt);
assert.match(fogataClip, /SUBJECT BODY PERFORMANCE|dancing|campfire/i);
assert.doesNotMatch(fogataClip, /zoom, pan or subject motion/i);
const fogataMotion = promptMotionParaVideo(fogataPrompt, '');
assert.match(fogataMotion, /SUBJECT PERFORMANCE|dancing|campfire|Ken Burns/i);
assert.match(negativosParaEscena(fogataPrompt), /missing campfire|missing full moon|static standing/i);

// Parque + arcoíris + yate + pesca (caso real del usuario).
const yatePrompt = 'un parque en el amanecer con un arcoiris brillante en un lago en donde esta un yate con una persona pescando tranquilamente';
assert.ok(escenaPidePaisaje(yatePrompt));
assert.ok(escenaPideActuacion(yatePrompt));
const yateMust = clausulaMustInclude(yatePrompt);
assert.match(yateMust, /yacht \(yate\)|yate/i);
assert.match(yateMust, /rainbow \(arcoiris\)|arcoiris|arco iris/i);
assert.match(yateMust, /park|parque|lake|lago|fishing|pescando/i);
assert.match(clausulaProhibidos(yatePrompt), /yacht|rainbow|arco/i);
const yateCorto = promptCortoParaFlux(yatePrompt, '');
assert.match(yateCorto, /yacht|rainbow|dawn|park|lake/i);
assert.match(yateCorto, /fisherman|fishing rod|FISHING ROD|casting|reeling/i);
assert.match(yateCorto, /FORBIDDEN:.*driving|steering|NOT driving|no steering/i);
assert.match(clausulaProhibidos(yatePrompt), /fisherman|fishing rod|driving|steering/i);
assert.doesNotMatch(yateCorto, /Indoor setting|campfire|DANCING around the fire/i);

// Pantera + mono: actuación animal.
const panteraPrompt = 'una pantera arriba de un árbol acercándose lentamente a un mono capuchino que está a punto de brincar a otra rama del mismo árbol';
assert.ok(escenaPideActuacion(panteraPrompt));
assert.ok(escenaEsAnimalONaturaleza(panteraPrompt));
assert.match(clausulaMustInclude(panteraPrompt), /panther|pantera|monkey|mono|capuchin|branch|rama/i);
assert.match(promptMotionParaVideo(panteraPrompt, ''), /SUBJECT PERFORMANCE|continuous logical action|MOVE for real/i);
const panteraBeats = beatsActuacionParaClip(panteraPrompt);
assert.ok(panteraBeats.length >= 3);
  assert.match(panteraBeats[0], /LOCKED CAMERA|LEFT|JAGUAR|CAPUCHIN|stalk/i);
assert.match(panteraBeats[panteraBeats.length - 1], /lunges|leap|mid-air|ACTION|escaping/i);
assert.match(promptCortoParaFlux(panteraPrompt, ''), /panther|jaguar|capuchin|LOCKED|APPROACH|stalk/i);
const beat1Corto = promptCortoParaFlux(`${panteraPrompt}. ${panteraBeats[0]}`, '');
assert.match(beat1Corto, /ACTION BEAT 1|LEFT 20%|CAPUCHIN/i);
assert.match(beat1Corto, /No bear|FORBIDDEN:.*bear|never bear/i);

// Megalodón + presa + desierto: NUNCA aplanar a pesca tranquila / yate+arcoíris.
const megaPrompt = 'un hombre arriba de un bote con una caña de pescar sacando del agua un megalodón en una presa en poblado desértico, se ve que el hombre esta batallando con el megalodón';
assert.ok(escenaEsPescaEpica(megaPrompt));
assert.ok(escenaEsDramatica(megaPrompt));
assert.ok(escenaPideActuacion(megaPrompt));
const megaMust = clausulaMustInclude(megaPrompt);
assert.match(megaMust, /megalodon|megalodón/i);
assert.match(megaMust, /bote|boat|cana|fishing rod|presa|dam|desiert|desert|batall/i);
assert.doesNotMatch(megaMust, /\barriba\b/i);
const megaCorto = promptCortoParaFlux(megaPrompt, '');
assert.match(megaCorto, /megalodon/i);
assert.match(megaCorto, /desert|dam|boat|fishing rod|battl|leaning|rowboat/i);
assert.match(megaCorto, /EYE-LEVEL|eye-level|NOT aerial|not mountain-sized|2-3/i);
assert.doesNotMatch(megaCorto, /YACHT deck|arched bright rainbow|Dawn lakeside MEDIUM SHOT|GIANT MEGALODON|Photoreal wide shot/i);
assert.match(clausulaProhibidos(megaPrompt), /megalodon|calm peaceful fishing|yacht with rainbow|kaiju/i);
assert.match(negativosParaEscena(megaPrompt), /missing megalodon|calm fishing|yacht with rainbow|aerial drone|kaiju/i);
const megaBeats = beatsActuacionParaClip(megaPrompt);
assert.ok(megaBeats.length >= 2);
assert.match(megaBeats[0], /megalodon|EYE-LEVEL|bent fishing rod|desert dam/i);
assert.doesNotMatch(megaBeats.join(' '), /yacht deck|rainbow and park|CASTING a long fishing rod over the lake/i);
assert.match(clausulaCalidadComposicion(megaPrompt), /EYE-LEVEL|MEDIUM-WIDE|kaiju|2-3/i);
assert.doesNotMatch(clausulaCalidadComposicion(megaPrompt), /yacht deck/i);

const s1 = seedDesdePrompt('escena A');
const s2 = seedDesdePrompt('escena B distinta');
assert.ok(Number.isFinite(s1) && Number.isFinite(s2));
assert.notEqual(s1, s2);

console.log('estudio-prompt-visual ok');
