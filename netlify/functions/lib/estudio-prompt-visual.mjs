/** Reescribe la escena del usuario a un prompt visual en inglés, sin perder sujetos. */

import {
  briefAPromptVisual,
  dirigirEscena,
} from './estudio-director-semantico.mjs';

const MODELOS_GROQ_VISUAL = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b',
];

const GLOSARIO_VISUAL = {
  venado: 'deer',
  ciervo: 'deer',
  cebra: 'zebra',
  panaderia: 'bakery',
  pan: 'bread',
  vapor: 'steam',
  montana: 'mountain',
  atardecer: 'sunset',
  amanecer: 'dawn',
  vegetacion: 'lush vegetation',
  bosque: 'forest',
  selva: 'jungle',
  desierto: 'desert',
  playa: 'beach',
  mar: 'ocean',
  rio: 'river',
  lago: 'lake',
  parque: 'park',
  yate: 'yacht',
  yates: 'yachts',
  barco: 'boat',
  lancha: 'motorboat',
  arcoiris: 'rainbow',
  'arco iris': 'rainbow',
  pantera: 'panther',
  panteras: 'panthers',
  jaguar: 'jaguar',
  leopardo: 'leopard',
  mono: 'monkey',
  monos: 'monkeys',
  capuchino: 'capuchin monkey',
  capuchinos: 'capuchin monkeys',
  arbol: 'tree',
  arboles: 'trees',
  rama: 'branch',
  ramas: 'branches',
  pescando: 'fishing',
  pescador: 'fisherman',
  pescar: 'fishing',
  cana: 'fishing rod',
  'cana de pescar': 'fishing rod',
  bote: 'small boat',
  megalodon: 'megalodon',
  megalodones: 'megalodons',
  tiburon: 'shark',
  tiburones: 'sharks',
  presa: 'dam',
  poblado: 'town',
  desertico: 'desert',
  batallando: 'battling',
  batalla: 'battle',
  luchando: 'struggling',
  sacando: 'pulling out',
  acercandose: 'approaching',
  acercando: 'approaching',
  brincar: 'jumping',
  brincando: 'jumping',
  saltando: 'jumping',
  lentamente: 'slowly',
  tranquilamente: 'peacefully',
  brillante: 'bright',
  sol: 'sun',
  luna: 'moon',
  cielo: 'sky',
  nubes: 'clouds',
  lluvia: 'rain',
  nieve: 'snow',
  noche: 'night',
  iglesia: 'church',
  calle: 'street',
  ciudad: 'city',
  pueblo: 'town',
  cocina: 'kitchen',
  horno: 'oven',
  persona: 'person',
  personas: 'people',
  hombre: 'man',
  mujer: 'woman',
  nino: 'boy',
  nina: 'girl',
  perro: 'dog',
  gato: 'cat',
  caballo: 'horse',
  aguila: 'eagle',
  pajaro: 'bird',
  colibri: 'hummingbird',
  lirio: 'lily',
  lirios: 'lilies',
  pistilos: 'flower pistils',
  pistilo: 'pistil',
  orilla: 'riverbank',
  nectar: 'nectar',
  flores: 'flowers',
  flor: 'flower',
  cafe: 'coffee cup',
  taza: 'cup',
  novio: 'boyfriend',
  novia: 'girlfriend',
  escritorio: 'desk',
  laptop: 'laptop',
  ordenador: 'computer',
  computadora: 'computer',
  oficina: 'office',
  oriental: 'East Asian',
  ucraniana: 'Ukrainian',
  ucraniano: 'Ukrainian',
  sonrie: 'smiling',
  sonrisa: 'smile',
  volcan: 'volcano',
  erupcion: 'eruption',
  erupcionando: 'erupting',
  isla: 'island',
  fumarola: 'fumarole',
  relampagos: 'lightning',
  relampago: 'lightning',
  rayos: 'lightning bolts',
  rayo: 'lightning bolt',
  piroclastica: 'pyroclastic',
  piroclastico: 'pyroclastic',
  avion: 'airplane',
  nube: 'cloud',
  siames: 'Siamese cat',
  siamesa: 'Siamese cat',
  casco: 'astronaut helmet',
  astronauta: 'astronaut',
  cometa: 'comet',
  planeta: 'planet',
  planetas: 'planets',
  estrellas: 'stars',
  estrellado: 'starry',
  estrellada: 'starry',
  noche: 'night',
  fogata: 'campfire',
  fogatas: 'campfires',
  hoguera: 'bonfire',
  hogueras: 'bonfires',
  bailando: 'dancing',
  bailar: 'dancing',
  baile: 'dance',
  danza: 'dance',
  danzando: 'dancing',
  llena: 'full',
  'luna llena': 'full moon',
  'cielo estrellado': 'starry sky',
  'cielo muy estrellado': 'very starry sky',
  carro: 'luxury car',
  coche: 'car',
  auto: 'car',
  automovil: 'automobile',
  manejando: 'driving',
  conduciendo: 'driving',
  volante: 'steering wheel',
  ventanilla: 'car window',
  tienda: 'store',
  diamantes: 'diamonds',
  diamante: 'diamond',
  lujoso: 'luxury',
  lujosa: 'luxury',
  afroamericana: 'African American woman',
  afroamericano: 'African American man',
  manzana: 'apple',
  mano: 'hand',
  boca: 'mouth',
  espejo: 'full-length mirror',
  recamara: 'bedroom',
  habitacion: 'bedroom',
  vehiculo: 'vehicle',
  deportivo: 'sports car',
  carretera: 'road',
  camino: 'roadway',
  lejos: 'in the distance',
  elegante: 'elegant',
  observando: 'looking at',
  llevandola: 'bringing it',
  cangrejo: 'crab',
  cangrejos: 'crabs',
  anguila: 'eel',
  anguilas: 'eels',
  electricas: 'electric',
  electrica: 'electric',
  'anguilas electricas': 'electric eels',
  'anguila electrica': 'electric eel',
  nadando: 'swimming',
  caudaloso: 'fast-flowing',
  caudalosa: 'fast-flowing',
  pez: 'fish',
  peces: 'fish',
  tiburon: 'shark',
  delfin: 'dolphin',
  ballena: 'whale',
  pulpo: 'octopus',
  medusa: 'jellyfish',
  serpiente: 'snake',
  leon: 'lion',
  tigre: 'tiger',
  oso: 'bear',
  lobo: 'wolf',
  mono: 'monkey',
  elefante: 'elephant',
  insecto: 'insect',
  mariposa: 'butterfly',
};

export function groqKeyVisual() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env?.get) {
      return Netlify.env.get('GROQ_API_KEY') || '';
    }
  } catch {
    /* ignore */
  }
  return process.env.GROQ_API_KEY || '';
}

export function sinAcentos(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function extraerElementos(prompt) {
  const escena = String(prompt || '').replace(/[.,;:!?¿¡]/g, ' ').replace(/\s+/g, ' ').trim();
  const stop = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'con', 'por', 'para',
    'al', 'a', 'y', 'o', 'u', 'que', 'se', 'su', 'sus', 'mi', 'tu', 'lo', 'le', 'les', 'es', 'son',
    'toma', 'plano', 'clip', 'video', 'imagen', 'foto', 'the', 'and', 'with', 'from', 'into',
    'camara', 'lenta', 'lento', 'progresivo', 'acabando', 'saliendo', 'juntos', 'entre', 'sobre',
    'desde', 'hacia', 'como', 'muy', 'mas', 'todo', 'toda', 'todos', 'todas', 'este', 'esta',
    'estos', 'estas', 'ese', 'esa', 'aquel', 'aquella', 'cada', 'otro', 'otra', 'observando',
    'usando', 'siendo', 'tienen', 'tiene', 'donde', 'cuando', 'mientras',
    'volando', 'vuela', 'vuelo', 'brillantes', 'variados', 'colores', 'libando', 'hermosa',
    'hermoso', 'recien', 'recibirlo', 'obsequiandole', 'trabajando', 'haciendo',
    'alta', 'alto', 'vista', 'hay',
    'misma', 'mismo', 'si',
    'alrededor', 'bajo', 'junto', 'cerca', 'medio', 'media',
  ]);
  // Frases multi-palabra primero (no se pierdan en el split).
  const frases = [];
  const nEscena = sinAcentos(escena);
  const frasesGlosario = Object.keys(GLOSARIO_VISUAL)
    .filter((k) => k.includes(' '))
    .sort((a, b) => b.length - a.length);
  let resto = escena;
  for (const fr of frasesGlosario) {
    const nFr = sinAcentos(fr);
    if (nEscena.includes(nFr)) {
      frases.push(fr);
      resto = resto.replace(new RegExp(fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
      // también quitar versión sin acentos aproximada
      resto = resto.replace(new RegExp(nFr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
    }
  }
  const palabras = resto.split(' ').map((w) => w.trim()).filter((w) => {
    const n = sinAcentos(w);
    return n.length >= 3 && !stop.has(n) && !/^\d+$/.test(n);
  });
  const vistos = new Set();
  const unicas = [];
  for (const w of [...frases, ...palabras]) {
    const k = sinAcentos(w);
    if (vistos.has(k)) continue;
    vistos.add(k);
    unicas.push(w);
  }
  // Hasta 24: nada importante debe caerse por cupo corto.
  return unicas.slice(0, 24);
}

export function traducirElemento(palabra) {
  const en = GLOSARIO_VISUAL[sinAcentos(palabra)];
  return en ? `${en} (${palabra})` : palabra;
}

export function clausulaMustInclude(prompt) {
  const elementos = extraerElementos(prompt);
  if (!elementos.length) return '';
  return `MUST INCLUDE: ${elementos.map(traducirElemento).join(', ')}. `;
}

export function escenaPidePaisaje(texto) {
  const n = sinAcentos(texto);
  return /\b(montana|rio|orilla|bosque|selva|playa|valle|atardecer|amanecer|paisaje|landscape|river|mountain|forest|beach|jungle|sunset|dawn|lake|lago|volcan|isla|erupcion|noche|luna|fogata|hoguera|estrellad|campfire|cielo|parque|arcoiris|yate|barco|presa|desierto|poblado|embalse|dique)\b/.test(n);
}

/** Exterior nocturno / fogata / luna / estrellas (no tratar como interior). */
export function escenaEsExteriorNoche(texto) {
  const n = sinAcentos(texto);
  return /\b(fogata|hoguera|campfire|bonfire|luna|estrellad|noche|bosque|selva|montana|playa|campo|claroscuro|fogata)\w*\b/.test(n)
    || /\b(full moon|starry|night forest|campfire)\b/.test(n);
}

/** ¿Pide actuación / baile / movimiento del sujeto (no solo cámara)? */
export function escenaPideActuacion(texto) {
  const n = sinAcentos(texto);
  return /\b(bail|danz|danc|actu|gesticul|camin|corr|gira|girando|salta|saltando|brinc|abraza|abrazando|pelea|luch|nadand|swimming|dancing|running|walking|acerc|acech|caz|pesc|jump|approach|stalk|hunt|fish|predator|batall|sacando)\w*\b/.test(n);
}

/** Interior real (props de cuarto/oficina). Personas al aire libre NO cuentan como interior. */
export function escenaEsInteriorOPersonas(texto) {
  const n = sinAcentos(texto);
  if (escenaEsExteriorNoche(texto) || escenaEsConduccionExterior(texto)) return false;
  const interior = /\b(escritorio|laptop|ordenador|computadora|oficina|cocina|interior|cuarto|habitacion|salon|estudio|retrato|espejo|recamara|manzana|afroamerican)\w*\b/.test(n);
  const cafeEscritorio = /\b(cafe|taza)\w*\b/.test(n) && /\b(novio|novia|mujer|hombre|escritorio|laptop)\w*\b/.test(n);
  return interior || cafeEscritorio;
}

/** Interior / gente / oficina: nunca sustituir por un paisaje genérico. */
export function escenaEsPersonasEnInterior(texto) {
  return escenaEsInteriorOPersonas(texto);
}

/** Acción dramática / épica: no postcard pacífico. */
export function escenaEsDramatica(texto) {
  const n = sinAcentos(texto);
  if (/\b(volcan|erupcion|fumarola|piroclast\w*|relampago|rayo|tormenta|explosion|incendio|lava|humo|avion)\w*\b/.test(n)) {
    return true;
  }
  if (/\b(relampagos|rayos)\b/.test(n)) return true;
  // Criatura marina épica / pelea / megalodón
  if (/\b(megalodon|tiburon|shark|kraken|leviatan|monster)\w*\b/.test(n)) return true;
  if (/\b(batall|luchand|peleand|struggle|battl)\w*\b/.test(n)) return true;
  // Presa (dique) + agua/barco/desierto
  if (/\bpresa\b/.test(n) && /\b(bote|barco|pesc|agua|desiert|poblad|embalse|dique)\b/.test(n)) return true;
  return false;
}

/** Pesca épica: hombre vs criatura marina (megalodón/tiburón) en presa/desierto. */
export function escenaEsPescaEpica(texto) {
  const n = sinAcentos(texto);
  const criatura = /\b(megalodon|tiburon|shark|kraken|leviatan)\w*\b/.test(n);
  const pescaOBote = /\b(pesc|cana|bote|barco|lancha|rod)\w*\b/.test(n);
  const lucha = /\b(batall|luch|pelea|sacando|struggle|battl|pulling)\w*\b/.test(n);
  return criatura && (pescaOBote || lucha);
}

/** Conducir por carretera / paisaje: coche + entorno exterior (no solo interior). */
export function escenaEsConduccionExterior(texto) {
  const n = sinAcentos(texto);
  const vehiculo = /\b(carro|coche|auto|automovil|vehiculo|deportivo|conduc|manej|volante)\w*\b/.test(n);
  const exterior = /\b(carretera|camino|montana|ciudad|autopista|ruta|paisaje|lejos)\w*\b/.test(n);
  return vehiculo && exterior;
}

/** Mirando tienda/calle desde dentro del auto (no confundir con ruta de montaña). */
export function escenaEsVehiculoMirandoAfuera(texto) {
  const n = sinAcentos(texto);
  if (escenaEsConduccionExterior(texto) && !/\b(tienda|escaparat|diamante|joyeria|ventanilla)\b/.test(n)) {
    return false;
  }
  return /\b(carro|coche|auto|automovil|vehiculo|conduc|manej|volante|ventanilla)\w*\b/.test(n)
    && /\b(tienda|escaparat|diamante|joyeria|ventanilla|observa.*ventana)\w*\b/.test(n);
}

/** Escena con vehículo (cualquier tipo). */
export function escenaEsVehiculoOCalle(texto) {
  const n = sinAcentos(texto);
  return /\b(carro|coche|auto|automovil|vehiculo|deportivo|conduc|manej|volante|ventanilla|tienda|diamante|carretera)\w*\b/.test(n);
}

/** Habitación + espejo / autorretrato. */
export function escenaEsEspejoORecamara(texto) {
  const n = sinAcentos(texto);
  return /\b(espejo|recamara|habitacion|manzana|afroamerican)\w*\b/.test(n);
}

/** Dos personas nombradas (mujer+novio, etc.): ambas deben verse enteras. */
export function escenaTieneDosPersonas(texto) {
  const n = sinAcentos(texto);
  const roles = [
    /\bmujer\b/, /\bhombre\b/, /\bnovio\b/, /\bnovia\b/, /\bpersona\b/,
    /\bchico\b/, /\bchica\b/, /\bamigo\b/, /\bamiga\b/,
  ];
  let hits = 0;
  for (const re of roles) {
    if (re.test(n)) hits += 1;
  }
  // "mujer … novio" = 2; también "pareja".
  if (/\bpareja\b/.test(n)) return true;
  return hits >= 2;
}

/** Escena de animales / naturaleza sin personas pedidas. */
export function escenaEsAnimalONaturaleza(texto) {
  const n = sinAcentos(texto);
  const animal = /\b(cangrejo|anguila|pez|peces|tiburon|delfin|ballena|pulpo|medusa|serpiente|leon|tigre|oso|lobo|mono|elefante|insecto|mariposa|venado|ciervo|cebra|colibri|pajaro|aguila|caballo|perro|gato|camaleon|pantera|jaguar|leopardo|animal|animals|crab|eel|fish|bird|deer|zebra|panther|monkey|capuchin)\w*\b/.test(n);
  const persona = /\b(mujer|hombre|persona|novio|novia|chico|chica|afroamerican|ucranian|oriental|pareja|retratro|retrato|pescador)\w*\b/.test(n);
  return animal && !persona;
}

/** ¿La escena pide personas humanas? */
export function escenaPidePersonas(texto) {
  const n = sinAcentos(texto);
  return /\b(mujer|hombre|persona|novio|novia|chico|chica|afroamerican|ucranian|oriental|pareja|retrato|conductor|conductora|astronauta)\w*\b/.test(n)
    || escenaTieneDosPersonas(texto)
    || escenaEsEspejoORecamara(texto);
}

/** Anatomía + hiperrealismo (adapta personas vs animales/paisaje). */
export function clausulaAnatomiaHiperrealismo(texto = '', { corto = false } = {}) {
  const personas = escenaPidePersonas(texto);
  const animales = escenaEsAnimalONaturaleza(texto);
  if (corto) {
    if (animales && !personas) {
      return ' Hyperrealistic 8k wildlife detail, correct animal anatomy, natural motion in water/terrain, coherent mountain/river perspective. No people.';
    }
    if (!personas) {
      return ' Hyperrealistic 8k detail, sharp clean object/landscape geometry, balanced perspective. No invented people.';
    }
    return ' Hyperrealistic 8k detail, perfect symmetrical face, natural eyes/nose/mouth aligned, realistic hands with five fingers, coherent body proportions, sharp clean car/object edges, balanced landscape perspective.';
  }
  const partes = [
    ' Hyperrealistic commercial photography quality (8k, crisp micro-detail).',
  ];
  if (personas) {
    partes.push(' Perfect human anatomy: symmetrical face, aligned eyes, natural hands with five fingers, balanced proportions; natural skin texture; no melted/warped features.');
  }
  if (animales || !personas) {
    partes.push(' Animals/wildlife: correct species anatomy, natural limbs and eyes, no extra limbs; do NOT replace animals with people.');
  }
  partes.push(' Landscapes/objects: coherent perspective, detailed depth, natural lighting, clean geometry, no warped horizon.');
  return partes.join('');
}

export function clausulaCalidadComposicion(texto) {
  const partes = [
    clausulaAnatomiaHiperrealismo(texto, { corto: false }),
    ' Medium-wide 16:9 FULL scene that shows the EXACT subjects asked (never replace them).',
  ];
  if (escenaPidePersonas(texto)) {
    partes.push(' SFW fully clothed (opaque clothes, no sheer/see-through dress), family-friendly.');
    partes.push(' Never a solo beauty headshot that drops the setting.');
  }
  if (escenaEsAnimalONaturaleza(texto)) {
    partes.push(' Wildlife nature documentary framing: show the named animals clearly in the described habitat.');
  }
  if (escenaTieneDosPersonas(texto)) {
    partes.push(' BOTH people fully visible together interacting in the same shot — never a solo close-up of only one person.');
  }
  const n = sinAcentos(texto);
  if (/\bsiames|siamesa\b/.test(n)) {
    partes.push(' Exact Siamese cat breed: cream body, dark brown points on face ears paws, blue eyes — not a grey tabby.');
  }
  if (/\bcasco|astronauta\b/.test(n)) {
    partes.push(' Clear astronaut helmet on the subject, fully visible and unmistakable.');
  }
  if (/\bcafe|taza\b/.test(n)) {
    partes.push(' Coffee cup clearly visible being handed over; clothed office/home interaction.');
  }
  if (escenaEsEspejoORecamara(texto)) {
    partes.push(' Bedroom interior with a full-length mirror reflecting the woman; apple in hand near her mouth — show mirror + room + apple, not an outdoor portrait.');
  }
  if (escenaEsConduccionExterior(texto)) {
    partes.push(' Wide shot: elegant driver in a luxury sports car ON the mountain road, city skyline far away — car body and landscape must be visible, not a face crop.');
  } else if (escenaEsVehiculoMirandoAfuera(texto)) {
    partes.push(' Luxury car interior (steering wheel, dashboard) with driver; storefront/street visible through the window — never a floating headshot without the car.');
  }
  if (/\bucranian\w*\b/.test(n)) {
    partes.push(' Ukrainian (Eastern European) appearance as requested; do not swap ethnicity.');
  }
  if (/\bcometa\b/.test(n)) {
    partes.push(' Subject riding on a bright comet with a glowing tail near the sun, stars and planets visible.');
  }
  if (/\bcangrejo|crab\b/.test(n)) {
    partes.push(' Clear crab visible swimming; electric eels around it in a fast mountain river — not people in a lake.');
  }
  if (escenaEsExteriorNoche(texto)) {
    partes.push(' Outdoor night environmental shot (24–35mm feel): tall campfire with orange firelight and sparks if asked; large full moon and dense starry sky visible; forest/setting fully shown — not a foggy empty clearing without fire/moon.');
  }
  if (escenaPideActuacion(texto)) {
    partes.push(' Subject mid-ACTION (dancing/moving/hunting/jumping/fishing) with dynamic body pose — not a static standing silhouette.');
  }
  if (/\b(arcoiris|rainbow)\b/.test(n)) {
    partes.push(' Bright full rainbow clearly arched in the sky over the scene — unmistakable, colorful, not omitted.');
  }
  if (/\b(yate|yacht|barco|boat)\b/.test(n)) {
    partes.push(' Yacht/boat clearly visible on the water — hull and size readable, not replaced by shore-only fishing.');
  }
  if (/\b(pesc\w*|fisherman|fishing)\b/.test(n)) {
    partes.push(' Fisherman clearly visible with fishing rod (on the yacht deck or beside it) — never omit the person fishing when asked.');
  }
  if (/\b(pantera|panther|mono|monkey|capuchin)\b/.test(n)) {
    partes.push(' Named animals fully visible with correct species: panther and/or capuchin monkey on tree branches as asked.');
  }
  return partes.join('');
}

export function clausulaProhibidos(texto) {
  const bits = [];
  if (escenaEsAnimalONaturaleza(texto)) {
    bits.push('FORBIDDEN: people, women, men, human bathers, group of girls, replacing animals with humans.');
  }
  if (escenaEsInteriorOPersonas(texto) && !escenaPidePaisaje(texto) && !escenaEsConduccionExterior(texto) && !escenaEsAnimalONaturaleza(texto)) {
    bits.push('FORBIDDEN: outdoor landscape, meadow, river, mountains scenery, lone silhouette in a valley. This is an INDOOR / people scene.');
  }
  if (escenaEsExteriorNoche(texto)) {
    bits.push('FORBIDDEN: missing campfire when asked, missing full moon, missing starry sky, indoor studio, empty foggy forest with no fire, static posed mannequin when dancing was asked.');
  }
  if (/\b(arcoiris|rainbow)\b/.test(sinAcentos(texto))) {
    bits.push('FORBIDDEN: missing rainbow, empty sky without rainbow when rainbow was asked.');
  }
  if (/\b(yate|yacht|barco|boat)\b/.test(sinAcentos(texto))) {
    bits.push('FORBIDDEN: missing yacht/boat, replacing yacht with shore-only fishing spot.');
  }
  if (/\b(pesc\w*|fisherman|fishing)\b/.test(sinAcentos(texto))) {
    bits.push('FORBIDDEN: missing fisherman, missing fishing rod, empty yacht with nobody fishing, driving/steering the boat instead of fishing.');
  }
  if (/\b(pantera|panther)\b/.test(sinAcentos(texto)) && /\b(mono|monkey|capuchin)\b/.test(sinAcentos(texto))) {
    bits.push('FORBIDDEN: bear, gorilla, hybrid fused creature, missing capuchin monkey, missing black panther, single animal only.');
  }
  if (escenaEsDramatica(texto)) {
    bits.push('FORBIDDEN: peaceful lake postcard, calm flowers meadow, sunny tourist landscape. SHOW eruption/ash/lightning/drama.');
  }
  if (escenaEsPescaEpica(texto)) {
    bits.push('FORBIDDEN: calm peaceful fishing, missing megalodon/shark, missing dam, green forest river instead of desert dam, tiny fish, yacht with rainbow postcard.');
  }
  if (escenaTieneDosPersonas(texto) && /\b(cafe|taza|escritorio|laptop)\b/.test(sinAcentos(texto))) {
    bits.push('FORBIDDEN: cropping to only one person; omitting the second person, the coffee cup, or the laptop/desk interaction.');
  } else if (escenaTieneDosPersonas(texto)) {
    bits.push('FORBIDDEN: cropping to only one person; omitting the second named person.');
  }
  if (escenaEsEspejoORecamara(texto)) {
    bits.push('FORBIDDEN: outdoor portrait, missing full-length mirror, missing apple, missing bedroom, beauty headshot only.');
  }
  if (escenaEsConduccionExterior(texto)) {
    bits.push('FORBIDDEN: solo beauty portrait, missing sports car, missing mountain road, missing distant city, face-only crop.');
  } else if (escenaEsVehiculoMirandoAfuera(texto)) {
    bits.push('FORBIDDEN: solo beauty portrait, missing car interior, missing diamond store/street outside the window, recycled face from another scene.');
  }
  if (/\bsiames|siamesa\b/.test(sinAcentos(texto))) {
    bits.push('FORBIDDEN: grey tabby or wrong cat breed; missing astronaut helmet when asked.');
  }
  if (escenaPidePersonas(texto)) {
    bits.push('FORBIDDEN: deformed faces, asymmetric eyes, melted features, extra fingers, warped bodies, nude, naked, topless, NSFW, erotic.');
  }
  bits.push('FORBIDDEN: inventing a different place, dropping named subjects, logos, watermarks.');
  return ` ${bits.join(' ')}`;
}

export function reforzarSujetos(prompt) {
  const escena = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!escena) return '';
  const lista = extraerElementos(escena).map(traducirElemento);
  const must = lista.length ? ` MUST INCLUDE every one of these, all visible: ${lista.join(', ')}.` : '';
  const partes = escena.split(/\s+y\s+(?=un[ao]?s?\s|una\s|el\s|la\s|los\s|las\s)/i);
  if (partes.length >= 2 && partes[0].length < 90 && partes.slice(1).join(' y ').length < 160) {
    const juntos = partes.map((p) => p.trim()).filter(Boolean);
    return `${escena}.${must} ALL of these must be visible together in the same frame: ${juntos.join(' AND ')}. Do not omit any named subject.`;
  }
  return `${escena}.${must} Include every named subject and setting. Do not replace the scene with only sky, clouds, or an empty landscape.`;
}

export function anclarVueloAlPaisaje(prompt) {
  const escena = String(prompt || '').replace(/\s+/g, ' ').trim();
  const n = sinAcentos(escena);
  const vuela = /voland|vuela|flying|hover/.test(n);
  const flores = /lirio|flor|pistil|nectar|liband/.test(n);
  const lugar = /rio|orilla|montana|bosque|selva|playa|valle|atardecer|amanecer/.test(n);
  if (!vuela || (!flores && !lugar)) return '';
  return ' The animal hovers at the flowers or ground subject IN the landscape (river, mountain, sunset visible). FORBIDDEN: empty blue sky filling the frame, a lone flying silhouette, missing flowers/river/mountain. Sky is only the upper background of a landscape.';
}

export function promptVisualFallback(prompt, modo = 'imagen') {
  const escena = String(prompt || '').replace(/\s+/g, ' ').trim();
  const sujetos = reforzarSujetos(escena);
  const cabezaMust = clausulaMustInclude(escena);
  const ancla = anclarVueloAlPaisaje(escena);
  const prohibidos = clausulaProhibidos(escena);
  const calidad = clausulaCalidadComposicion(escena);
  const cabeza = modo === 'clip'
    ? 'Photorealistic cinematic 16:9 film plate of the EXACT user scene. Sharp details, lighting matching the described time of day.'
    : 'Photorealistic 16:9 photograph of the EXACT user scene, sharp focus, high detail, natural professional lighting.';
  return `${cabezaMust}${cabeza}${calidad} Original scene (keep it): "${escena}". OBEY THIS SCENE EXACTLY (do not invent a different place or drop characters): ${sujetos}${ancla}${prohibidos} No text, no watermark, no logo, no letters.`;
}

/** Refuerzo para Imagen IA: obedece la escena; no inyecta paisaje genérico. */
export function promptImagenReforzado(promptEn, original = '') {
  const p = String(promptEn || '').trim();
  if (!p) return '';
  const src = String(original || p).trim();
  const ancla = anclarVueloAlPaisaje(src);
  const must = clausulaMustInclude(src);
  const prohibidos = clausulaProhibidos(src);
  const calidad = clausulaCalidadComposicion(src);
  const animal = escenaEsAnimalONaturaleza(src) && !escenaPidePersonas(src);
  const paisaje = escenaPidePaisaje(src)
    ? (animal
      ? 'Animals LARGE in frame in the described habitat; landscape is background only — never an empty nature postcard without the animals.'
      : 'Show the full place and setting the user described; keep all named subjects visible together.')
    : 'OBEY the user scene exactly. Do NOT invent rivers, flowers, mountains, birds, bakeries or landscapes that were not asked for.';
  const leadAnimal = animal
    ? 'PRIMARY SUBJECTS ARE THE NAMED ANIMALS (fill most of the frame). '
    : '';
  return `${leadAnimal}${must}Photorealistic 16:9 still. ${paisaje}${calidad} Do not replace or simplify the scene.${ancla}${prohibidos} ${p}`
    .replace(/\s+/g, ' ')
    .trim();
}

/** Refuerzo para Clip IA: escena exacta + actuación del sujeto (no solo zoom de cámara). */
export function promptClipReforzado(promptEn, original = '') {
  const p = String(promptEn || '').trim();
  if (!p) return '';
  const src = String(original || p).trim();
  const ancla = anclarVueloAlPaisaje(src);
  const must = clausulaMustInclude(src);
  const prohibidos = clausulaProhibidos(src);
  const calidad = clausulaCalidadComposicion(src);
  const actuacion = escenaPideActuacion(src);
  const paisaje = escenaPidePaisaje(src)
    ? 'Keep the described place fully visible while the subject moves.'
    : 'OBEY the user scene exactly. Do NOT invent extra places or drop named subjects.';
  const motion = actuacion
    ? 'SUBJECT BODY PERFORMANCE first: dancing/acting limbs and torso in continuous motion; camera mostly locked or gentle orbit — NOT a still plate with only zoom/pan.'
    : 'Natural motion matching the description (subject motion preferred over empty camera zoom).';
  return `${must}Cinematic 16:9 VIDEO clip with real subject motion. ${paisaje}${calidad} ${motion}${ancla}${prohibidos} ${p}`
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prompt corto de MOTION para I2V / T2V (prioridad actuación del sujeto). */
export function promptMotionParaVideo(original = '', promptEn = '') {
  const src = String(original || '').replace(/\s+/g, ' ').trim();
  const en = String(promptEn || '').replace(/\s+/g, ' ').trim();
  const actuacion = escenaPideActuacion(src);
  const mustEn = extraerElementos(src)
    .map((w) => GLOSARIO_VISUAL[sinAcentos(w)] || w)
    .filter(Boolean)
    .slice(0, 10)
    .join(', ');
  if (actuacion) {
    return [
      `Animate the exact scene with SUBJECT PERFORMANCE and continuous logical action: ${mustEn || src}.`,
      'Animals/people MOVE for real: limbs, approach, jump, swim, dance, fish — not a frozen still.',
      'Environment also lives: fire flickers, water ripples, leaves stir, sparks/rain if asked.',
      'Camera mostly locked wide or gentle orbit; NEVER only Ken Burns zoom/pan on a still plate.',
      'SFW clothed when humans, photoreal, 16:9, no text, no watermark.',
      en ? `Context: ${en.slice(0, 500)}` : '',
    ].filter(Boolean).join(' ').slice(0, 1400);
  }
  return [
    `Cinematic motion of: ${mustEn || src}.`,
    'Subtle natural subject/environment motion; gentle camera only if needed.',
    'Photoreal 16:9, no text, no watermark.',
    en ? `Context: ${en.slice(0, 500)}` : '',
  ].filter(Boolean).join(' ').slice(0, 1200);
}

/**
 * Beats de actuación para secuencia de placas (fallback sin I2V).
 * Cada beat se añade al prompt corto para forzar progreso de la acción.
 * Debe ir AL INICIO del SCENE (promptCortoParaFlux lo prioriza).
 */
export function beatsActuacionParaClip(original = '') {
  const src = String(original || '').replace(/\s+/g, ' ').trim();
  if (!escenaPideActuacion(src)) return [];
  const n = sinAcentos(src);
  if (/\b(pantera|panther)\b/.test(n) && /\b(mono|monkey|capuchin)\b/.test(n)) {
    return [
      'ACTION BEAT 1/4 LOCKED CAMERA wide canopy: melanistic BLACK JAGUAR PANTHER (big cat, feline skull, whiskers, long cat tail, four paws) stands on LEFT 20% of a long horizontal branch. SMALL brown-cream CAPUCHIN MONKEY (Cebus, pale face, monkey hands) sits on RIGHT 80% of SAME branch. Huge gap. Panther takes first stalking step RIGHT toward monkey. No bear. No gorilla. No hybrid.',
      'ACTION BEAT 2/4 LOCKED CAMERA same tree: BLACK JAGUAR PANTHER now at 45% along the branch walking RIGHT, body low in stalk. Brown-cream CAPUCHIN still at RIGHT 80%, turns head, braces to flee. Medium gap. Two separate species. No bear.',
      'ACTION BEAT 3/4 LOCKED CAMERA: BLACK JAGUAR PANTHER crouches at 65% ready to pounce. Brown-cream CAPUCHIN at branch fork coils legs to leap UP to a higher branch. Tiny gap. Clear feline vs primate. No bear. No hybrid.',
      'ACTION BEAT 4/4 LOCKED CAMERA live action: BLACK JAGUAR PANTHER lunges RIGHT along the branch. Brown-cream CAPUCHIN mid-air leaping UP to another branch of the SAME tree, escaping. Motion blur on limbs OK. Documentary wildlife film. No bear. No zoom-only still.',
    ];
  }
  if (/\b(fogata|hoguera|campfire|bail|danz)\b/.test(n)) {
    return [
      'ACTION BEAT 1/3: woman starting to dance beside tall campfire; one foot lifted.',
      'ACTION BEAT 2/3: woman mid-spin around bright campfire; sparks rising.',
      'ACTION BEAT 3/3: woman arms raised finishing dance move beside roaring fire.',
    ];
  }
  if (/\b(pesc\w*|fisherman|fishing)\b/.test(n)) {
    return [
      'ACTION BEAT 1/2: fisherman on yacht deck CASTING a long fishing rod over the lake; line in air; NOT driving; no steering wheel.',
      'ACTION BEAT 2/2: fisherman on yacht REELING the fishing rod calmly; rod tip over water; rainbow and park visible; NOT piloting the boat.',
    ];
  }
  return [
    'ACTION BEAT 1/3: subject at start of the named action; clear pose.',
    'ACTION BEAT 2/3: subject mid-action progressing the same continuous movement.',
    'ACTION BEAT 3/3: subject near completion of the named action; motion readable.',
  ];
}

/** Extrae el beat de actuación si el original ya lo trae (para anclar SCENE). */
export function extraerBeatActuacion(texto = '') {
  const m = String(texto || '').match(/ACTION BEAT[\s\S]{10,520}?(?=\s+SFW|\s+MUST|\s+FORBIDDEN|\s+16:9|$)/i);
  return m ? m[0].replace(/\s+/g, ' ').trim().slice(0, 520) : '';
}

/** Prompt corto EN-first para Pollinations/Flux (truncan ~850 chars: la ESCENA debe ir primero). */
export function promptCortoParaFlux(original, promptEn = '') {
  const src = String(original || '').replace(/\s+/g, ' ').trim();
  const animal = escenaEsAnimalONaturaleza(src) && !escenaPidePersonas(src);
  const personas = escenaPidePersonas(src);
  const epica = escenaEsPescaEpica(src) || escenaEsDramatica(src);
  // Traducir tokens al inglés: Flux entiende poco el español suelto.
  const mustEn = extraerElementos(src)
    .map((w) => {
      const en = GLOSARIO_VISUAL[sinAcentos(w)];
      return en || w;
    })
    .filter(Boolean)
    .slice(0, animal ? 14 : epica ? 16 : 12)
    .join(', ');

  let anclaEscena = '';
  if (escenaEsEspejoORecamara(src)) {
    anclaEscena = `SCENE: Photoreal award-winning photo of an African American Black woman with natural dark skin in her bedroom, large full-length mirror with clear reflection, red apple raised to her mouth. Visible together: woman + apple + mirror + bedroom. Perfect symmetrical face, sharp eyes, realistic hands. Not a headshot. Not outdoors. Not pale/white skin.`;
  } else if (escenaEsConduccionExterior(src)) {
    anclaEscena = `SCENE: Photoreal award-winning photo of an elegant Ukrainian Eastern-European woman with fair Slavic features sitting in the driver's seat of a luxury sports car, both hands on the steering wheel, mountain road and distant city skyline outside. Visible together: woman driving inside car + car + road + mountains + city. Perfect symmetrical face, realistic hands, sharp car geometry. Opaque elegant clothes. Not standing outside. Not East Asian features.`;
  } else if (escenaEsVehiculoMirandoAfuera(src)) {
    anclaEscena = `SCENE: ${mustEn || src}. Driver inside luxury car looking through window at store/street outside. Woman + car interior + outside view all visible. Perfect symmetrical face, realistic hands.`;
  } else if (animal) {
    const esCangrejo = /\bcangrejo|crab\b/.test(sinAcentos(src));
    const esPanteraMono = /\b(pantera|panther)\b/.test(sinAcentos(src)) && /\b(mono|monkey|capuchin)\b/.test(sinAcentos(src));
    const beat = extraerBeatActuacion(src);
    anclaEscena = esCangrejo
      ? `SCENE: A crab swimming among electric eels in a fast-flowing mountain river — photoreal wildlife close-up. Named animals first and large in frame: ${mustEn || 'crab, electric eels'}. Clear crab body/claws + several electric eels in rushing water between mountains. Animals only; no people, no women, no human bathers, no group of girls.`
      : esPanteraMono
        ? (beat
          ? `SCENE: ${beat}`
          : `SCENE: Photoreal wildlife documentary LOCKED CAMERA — TWO species only: (1) large adult melanistic BLACK JAGUAR / BLACK PANTHER (feline skull, whiskers, long cat tail, four paws) stalking RIGHT along a thick tree branch, (2) small BROWN-CREAM CAPUCHIN MONKEY (Cebus, pale face mask, monkey hands, long monkey tail) about to leap to another branch of the SAME tree. Panther approaches; monkey flees by changing branches. Never bear, never gorilla, never hybrid fused creature. Forest canopy. Animals only.`)
      : `SCENE: Photoreal wildlife close-up — named animals LARGE and clear in frame first: ${mustEn || src}. Habitat supports the animals (not an empty landscape). Animals only; no people, no women, no human bathers.`;
  } else if (escenaEsExteriorNoche(src) && (/\b(fogata|hoguera|campfire|bail|danz|noche|luna|estrellad)\b/.test(sinAcentos(src)))) {
    anclaEscena = `SCENE: Photoreal night outdoor wide shot — ${mustEn || 'woman, campfire, full moon, starry sky, forest'}. Tall bright campfire with orange flames and sparks; woman DANCING around the fire (dynamic pose, not standing still); large full moon and dense starry sky above the trees. All visible together. SFW opaque clothes.`;
  } else if (escenaEsPescaEpica(src) || (escenaEsDramatica(src) && /\b(pesc|cana|bote)\b/.test(sinAcentos(src)))) {
    anclaEscena = `SCENE: Epic photoreal ACTION photo — ALL FOUR visible: (1) man braced in a SMALL fishing BOAT wrestling a deeply bent FISHING ROD with both hands, (2) GIANT MEGALODON prehistoric shark erupting from water beside the boat mouth open teeth visible huge splash, (3) tall concrete DAM wall behind, (4) arid DESERT TOWN / dry rocky mountains under bright sky. Man is BATTLING the megalodon — strain, spray, motion. FORBIDDEN: calm peaceful fishing, green forest river, autumn trees, yacht with rainbow, missing megalodon, missing dam.`;
  } else if (/\b(yate|arcoiris|parque|amanecer|lago|yacht|rainbow)\b/.test(sinAcentos(src))
    && !escenaEsDramatica(src)
    && !escenaEsPescaEpica(src)) {
    const pidePesc = /\b(pesc\w*|fisherman|fishing|persona)\b/.test(sinAcentos(src));
    const beat = extraerBeatActuacion(src);
    anclaEscena = pidePesc
      ? (beat
        ? `SCENE: ${beat} ALSO visible: white yacht on lake, arched bright rainbow in sky, park lakeside at dawn.`
        : `SCENE: Dawn lakeside MEDIUM SHOT — adult FISHERMAN standing on white YACHT deck HOLDING a long FISHING ROD with line toward the water (casting or reeling). Rod must be clearly visible in his hands. ALSO in frame: arched bright rainbow in sky + park shoreline sunrise + yacht hull. FORBIDDEN: driving, steering wheel, piloting, captain at helm, empty hands, no rod.`)
      : `SCENE: Photoreal wide landscape at dawn — ${mustEn || src}. MUST show ALL together in one frame: (1) park lakeside at sunrise, (2) bright colorful rainbow arched in the sky, (3) yacht floating on the lake. Never drop yacht or rainbow.`;
  } else if (personas && escenaPideActuacion(src) && escenaPidePaisaje(src) && !/\b(yate|arcoiris|rainbow|yacht)\b/.test(sinAcentos(src))) {
    anclaEscena = `SCENE: Photoreal outdoor action shot — ${mustEn || src}. Subject mid-action in the described place; full environment visible; SFW clothes.`;
  } else if (!personas) {
    anclaEscena = `SCENE (exact): ${mustEn ? `${mustEn}. ${src}` : src}. Photoreal award-winning photo of the place/objects described — do not invent people.`;
  } else {
    anclaEscena = `SCENE (exact): ${mustEn ? `${mustEn}. ${src}` : src}. Photoreal award-winning photo, perfect symmetrical face, realistic hands.`;
  }

  const exteriorNoche = escenaEsExteriorNoche(src);
  const reglasTxt = (animal
    ? [
        '16:9 hyperrealistic wildlife documentary framing.',
        'Correct animal anatomy, natural water/terrain motion, coherent mountain/river perspective.',
        mustEn ? `MUST SHOW: ${mustEn}.` : '',
        'FORBIDDEN: humans, faces, women in water, beauty portrait.',
        'No text, no logo, no watermark.',
      ]
    : exteriorNoche
      ? [
          'SFW opaque clothes.',
          '16:9 wide environmental night shot (NOT beauty headshot, NOT indoor).',
          'Firelight + moonlight, full bodies, campfire+moon+stars must be visible.',
          mustEn ? `MUST SHOW: ${mustEn}.` : '',
          'FORBIDDEN: missing campfire, missing moon, static mannequin pose when dancing asked.',
          'No text, no logo, no watermark.',
        ]
    : [
        personas ? 'SFW opaque clothes.' : 'No invented people unless asked.',
        '16:9 hyperrealistic medium-wide (NOT beauty headshot).',
        personas
          ? 'Canon EOS R5 85mm, perfect symmetrical face, natural skin pores, 5 fingers per hand, sharp car/object geometry.'
          : 'Canon EOS R5, sharp clean geometry, coherent perspective, natural light.',
        mustEn ? `MUST SHOW: ${mustEn}.` : '',
        escenaEsInteriorOPersonas(src) && !escenaEsConduccionExterior(src)
          ? 'Indoor setting. No outdoor park portrait.'
          : '',
        'No text, no logo, no watermark.',
      ]
  ).filter(Boolean).join(' ');

  // Prioridad: ancla de escena + must; reglas al final; nunca cortar la escena.
  const cuerpo = `${anclaEscena} ${reglasTxt}`.replace(/\s+/g, ' ').trim();
  if (cuerpo.length <= 850) return cuerpo;
  // Si aún pasa, recortar reglas, no la ancla.
  const maxAncla = Math.min(anclaEscena.length, 520);
  const resto = 850 - maxAncla - 1;
  return `${anclaEscena.slice(0, maxAncla)} ${reglasTxt.slice(0, Math.max(40, resto))}`.replace(/\s+/g, ' ').trim().slice(0, 850);
}

export function negativosParaEscena(original = '') {
  const base = [
    'watermark', 'text', 'logo', 'letters', 'pollinations', 'pollinations.ai',
    'blurry', 'low quality', 'jpeg artifacts', 'noisy', 'soft focus', 'wrong scene',
    'beauty headshot only', 'solo portrait',
    'cropped head', 'cut off face',
    'deformed face', 'melted face', 'distorted face', 'asymmetric eyes', 'uneven eyes',
    'crossed eyes', 'lazy eye', 'crooked nose', 'warped mouth', 'disfigured',
    'bad anatomy', 'mutated hands', 'deformed hands', 'extra fingers', 'missing fingers',
    'fused fingers', 'too many fingers', 'extra limbs', 'missing limbs', 'twisted limbs',
    'long neck', 'broken proportions', 'plastic skin', 'waxy skin', 'doll-like face',
    'nude', 'naked', 'nsfw', 'topless', 'lingerie', 'erotic', 'porn',
    'sheer dress', 'see-through clothes', 'transparent outfit',
    'pale skin wrong ethnicity', 'wrong ethnicity', 'east asian features when african american asked',
  ];
  if (escenaEsEspejoORecamara(original)) {
    base.push('outdoor foliage background', 'park portrait', 'missing mirror', 'missing apple', 'missing bedroom', 'no reflection', 'headshot only', 'white woman', 'pale skin');
  }
  if (escenaEsInteriorOPersonas(original) && !escenaPidePaisaje(original) && !escenaEsConduccionExterior(original)) {
    base.push('outdoor landscape', 'meadow', 'river valley', 'mountains scenery', 'nature field', 'empty landscape');
  }
  if (escenaEsExteriorNoche(original)) {
    base.push(
      'missing campfire', 'no fire', 'no flames', 'missing full moon', 'empty dark sky no stars',
      'indoor studio', 'static standing pose when dancing', 'mannequin pose', 'foggy empty clearing without fire',
    );
  }
  if (/\b(arcoiris|rainbow)\b/.test(sinAcentos(original))) {
    base.push('missing rainbow', 'no rainbow', 'empty sky without rainbow');
  }
  if (/\b(yate|yacht|barco|boat)\b/.test(sinAcentos(original))) {
    base.push('missing yacht', 'missing boat', 'no yacht on water', 'empty boat no fisherman');
  }
  if (/\b(pesc\w*|fisherman|fishing)\b/.test(sinAcentos(original))) {
    base.push(
      'missing fisherman', 'missing fishing rod', 'nobody fishing', 'empty yacht',
      'driving the boat', 'steering wheel', 'piloting', 'captain at helm', 'hands on wheel', 'no fishing rod',
    );
  }
  if (/\b(pantera|panther)\b/.test(sinAcentos(original)) && /\b(mono|monkey|capuchin)\b/.test(sinAcentos(original))) {
    base.push(
      'bear', 'grizzly', 'gorilla', 'ape', 'hybrid chimera', 'fused animal', 'anthropomorphic',
      'single animal only', 'missing monkey', 'missing panther', 'two panthers', 'two monkeys only',
      'ken burns still', 'frozen statue animals',
    );
  }
  if (escenaTieneDosPersonas(original) && /\b(cafe|taza|escritorio|laptop)\b/.test(sinAcentos(original))) {
    base.push('only one person', 'missing boyfriend', 'missing coffee cup', 'close-up crop');
  } else if (escenaTieneDosPersonas(original)) {
    base.push('only one person', 'close-up crop');
  }
  if (escenaEsConduccionExterior(original)) {
    base.push('face only', 'missing sports car', 'missing mountain road', 'missing city skyline', 'empty car no driver', 'no woman', 'standing outside car', 'posing next to car', 'warped car body', 'melted car', 'east asian woman', 'wrong ethnicity');
  } else if (escenaEsVehiculoMirandoAfuera(original)) {
    base.push('missing car', 'missing steering wheel', 'no storefront', 'wrong ethnicity');
  }
  if (escenaEsDramatica(original)) {
    base.push('peaceful lake', 'calm postcard', 'tourist flowers meadow', 'no eruption', 'no lightning');
  }
  if (escenaEsPescaEpica(original) || /\bmegalodon\b/.test(sinAcentos(original))) {
    base.push(
      'calm fishing', 'peaceful angler', 'missing megalodon', 'tiny fish', 'no shark',
      'green forest river', 'missing dam', 'yacht with rainbow', 'tranquil fishing postcard',
    );
  }
  if (escenaEsAnimalONaturaleza(original) && !escenaPidePersonas(original)) {
    base.push(
      'people', 'humans', 'women', 'men', 'girls bathing', 'group of women', 'human faces',
      'replacing animals with people', 'swimsuit models', 'lake bathers',
    );
  }
  if (/\bsiames|siamesa\b/.test(sinAcentos(original))) {
    base.push('grey tabby', 'wrong cat breed', 'no helmet', 'missing astronaut helmet');
  }
  return base.join(', ');
}

/** Seed estable por escena + jitter anti-caché (evita cruzar con la generación anterior). */
export function seedDesdePrompt(texto = '') {
  const s = String(texto || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const base = Math.abs(h) % 900000;
  const jitter = Date.now() % 997;
  return base + jitter;
}

function parsearExpansion(raw) {
  const texto = String(raw || '').trim();
  if (!texto) return null;
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      const promptEn = String(data.prompt_en || data.prompt || '').trim();
      if (promptEn.length > 24) {
        return {
          promptEn: promptEn.slice(0, 1200),
          resumen: String(data.resumen || '').trim().slice(0, 180),
        };
      }
    } catch {
      /* texto plano */
    }
  }
  const plano = texto.replace(/^```[\s\S]*?```/g, '').replace(/["']/g, '').trim();
  if (plano.length > 24) return { promptEn: plano.slice(0, 1200), resumen: '' };
  return null;
}

export async function expandirPromptVisual(prompt, { modo = 'imagen' } = {}) {
  const original = String(prompt || '').replace(/\s+/g, ' ').trim();
  const fallback = {
    promptEn: promptVisualFallback(original, modo),
    resumen: '',
    via: 'fallback',
    director: null,
  };
  if (!original) return fallback;

  // Cerebro principal: Director Semántico (conjuntos + inferencias), no glosario palabra a palabra.
  try {
    const director = await dirigirEscena(original, {
      modalidad: modo === 'clip' ? 'clip' : 'imagen',
    });
    const motion = modo === 'clip';
    let promptEn = briefAPromptVisual(director, { motion });
    if (!promptEn || promptEn.length < 24) {
      promptEn = promptVisualFallback(original, modo);
    }
    // Red de seguridad: calidad/composición y prohibidos locales.
    promptEn = motion
      ? promptClipReforzado(promptEn, original)
      : promptImagenReforzado(promptEn, original);
    return {
      promptEn: promptEn.slice(0, 2000),
      resumen: director.resumen_es || director.intencion || '',
      via: director.via || 'director',
      director,
    };
  } catch (err) {
    console.warn('expandirPromptVisual/director:', err?.message || err);
  }

  // Fallback clásico si el director falla.
  const apiKey = groqKeyVisual();
  if (!apiKey) return fallback;

  const tarea = modo === 'clip'
    ? 'Write an English prompt for a cinematic 16:9 film plate or short clip of the EXACT user scene. Prefer clear subjects and natural motion; never invent a different place.'
    : 'Write an English prompt for a single photorealistic 16:9 photograph of the EXACT user scene.';

  const system = `You turn a user's scene (usually Spanish) into ONE English image/video prompt.
Rules:
- First line of prompt_en MUST list required subjects: "MUST INCLUDE: …"
- Keep EVERY subject, place, prop, breed, accessory and implied world logic.
- Reply ONLY JSON: {"prompt_en":"...","resumen":"...","elementos":["..."]}`;

  try {
    for (const model of MODELOS_GROQ_VISUAL) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.05,
          max_tokens: 400,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `${tarea}\nEscena del usuario: ${original}` },
          ],
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) continue;
      const parsed = parsearExpansion(data?.choices?.[0]?.message?.content);
      if (parsed?.promptEn) {
        const must = clausulaMustInclude(original);
        const ancla = anclarVueloAlPaisaje(original);
        const prohibidos = clausulaProhibidos(original);
        let promptEn = parsed.promptEn.startsWith('MUST INCLUDE')
          ? parsed.promptEn
          : `${must}${parsed.promptEn} Original: "${original}"`;
        if (ancla && !/FORBIDDEN: empty blue sky/i.test(promptEn)) promptEn += ancla;
        if (!/FORBIDDEN:/i.test(promptEn)) promptEn += prohibidos;
        return {
          promptEn: promptEn.slice(0, 1600),
          resumen: parsed.resumen,
          via: `groq:${model}`,
          director: null,
        };
      }
    }
  } catch (err) {
    console.warn('expandirPromptVisual:', err?.message || err);
  }
  return fallback;
}
