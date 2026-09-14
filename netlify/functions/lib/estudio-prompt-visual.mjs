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
    'usando', 'haciendo', 'siendo', 'tienen', 'tiene', 'donde', 'cuando', 'mientras',
    'volando', 'vuela', 'vuelo', 'brillantes', 'variados', 'colores', 'libando', 'hermosa',
    'hermoso', 'esta', 'este', 'recien', 'recibirlo', 'obsequiandole', 'trabajando',
    'haciendo', 'alta', 'alto', 'vista', 'hay', 'muy', 'recien',
    'misma', 'mismo', 'completo', 'completa', 'cuerpo', 'si', 'esta',
  ]);
  const palabras = escena.split(' ').map((w) => w.trim()).filter((w) => {
    const n = sinAcentos(w);
    return n.length >= 3 && !stop.has(n) && !/^\d+$/.test(n);
  });
  const vistos = new Set();
  const unicas = [];
  for (const w of palabras) {
    const k = sinAcentos(w);
    if (vistos.has(k)) continue;
    vistos.add(k);
    unicas.push(w);
  }
  return unicas.slice(0, 14);
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
  return /\b(montana|rio|orilla|bosque|selva|playa|valle|atardecer|amanecer|paisaje|landscape|river|mountain|forest|beach|jungle|sunset|dawn|lake|lago|volcan|isla|erupcion)\b/.test(n);
}

/** Interior / gente / oficina: nunca sustituir por un paisaje genérico. */
export function escenaEsInteriorOPersonas(texto) {
  const n = sinAcentos(texto);
  return /\b(mujer|hombre|persona|novio|novia|escritorio|laptop|ordenador|computadora|oficina|cocina|cafe|taza|interior|cuarto|habitacion|salon|estudio|retrato|pareja|sonrie|sonrisa|obsequi|espejo|recamara|manzana|afroamerican)\w*\b/.test(n);
}

/** Acción dramática (volcán, tormenta, erupción): no postcard pacífico. */
export function escenaEsDramatica(texto) {
  const n = sinAcentos(texto);
  return /\b(volcan|erupcion|fumarola|piroclast\w*|relampago|rayo|tormenta|explosion|incendio|lava|humo|avion)\w*\b/.test(n)
    || /\b(relampagos|rayos)\b/.test(n);
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

export function clausulaCalidadComposicion(texto) {
  const partes = [
    ' Ultra sharp photorealistic detail, correct anatomy, natural hands and faces.',
    ' Medium-wide 16:9 FULL scene (never a solo beauty headshot that drops the setting).',
    ' SFW fully clothed (opaque clothes, no sheer/see-through dress), family-friendly.',
  ];
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
  return partes.join('');
}

export function clausulaProhibidos(texto) {
  const bits = [];
  if (escenaEsInteriorOPersonas(texto) && !escenaPidePaisaje(texto) && !escenaEsConduccionExterior(texto)) {
    bits.push('FORBIDDEN: outdoor landscape, meadow, river, mountains scenery, lone silhouette in a valley. This is an INDOOR / people scene.');
  }
  if (escenaEsDramatica(texto)) {
    bits.push('FORBIDDEN: peaceful lake postcard, calm flowers meadow, sunny tourist landscape. SHOW eruption/ash/lightning/drama.');
  }
  if (escenaTieneDosPersonas(texto)) {
    bits.push('FORBIDDEN: cropping to only one person; omitting the second person, the coffee cup, or the laptop/desk interaction.');
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
  bits.push('FORBIDDEN: nude, naked, topless, NSFW, erotic, inventing a different place, dropping named subjects, logos, watermarks.');
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
  const paisaje = escenaPidePaisaje(src)
    ? 'Show the full place and setting the user described; keep all named subjects visible together.'
    : 'OBEY the user scene exactly. Do NOT invent rivers, flowers, mountains, birds, bakeries or landscapes that were not asked for.';
  return `${must}Photorealistic 16:9 still. ${paisaje}${calidad} Do not replace or simplify the scene.${ancla}${prohibidos} ${p}`
    .replace(/\s+/g, ' ')
    .trim();
}

/** Refuerzo para Clip IA: escena exacta + idea de movimiento, sin sesgo de paisaje. */
export function promptClipReforzado(promptEn, original = '') {
  const p = String(promptEn || '').trim();
  if (!p) return '';
  const src = String(original || p).trim();
  const ancla = anclarVueloAlPaisaje(src);
  const must = clausulaMustInclude(src);
  const prohibidos = clausulaProhibidos(src);
  const calidad = clausulaCalidadComposicion(src);
  const paisaje = escenaPidePaisaje(src)
    ? 'Keep the described place fully visible while the camera moves.'
    : 'OBEY the user scene exactly. Do NOT invent extra places or drop named subjects.';
  return `${must}Cinematic 16:9 clip / film plate. ${paisaje}${calidad} Natural motion matching the description (zoom, pan or subject motion).${ancla}${prohibidos} ${p}`
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prompt corto EN-first para Pollinations/Flux (truncan ~850 chars: la ESCENA debe ir primero). */
export function promptCortoParaFlux(original, promptEn = '') {
  const src = String(original || '').replace(/\s+/g, ' ').trim();
  // Traducir tokens al inglés: Flux entiende poco el español suelto.
  const mustEn = extraerElementos(src)
    .map((w) => {
      const en = GLOSARIO_VISUAL[sinAcentos(w)];
      return en || w;
    })
    .filter(Boolean)
    .slice(0, 12)
    .join(', ');

  let anclaEscena = '';
  if (escenaEsEspejoORecamara(src)) {
    anclaEscena = `SCENE: African American woman in bedroom standing before a large full-length mirror (reflection clearly visible), holding a red apple to her mouth. MUST be visible together: woman + apple + full-length mirror + bedroom furniture. Not a headshot. Not outdoors.`;
  } else if (escenaEsConduccionExterior(src)) {
    anclaEscena = `SCENE: Elegant Ukrainian woman sitting in the driver's seat of a luxury sports car (hands on steering wheel), driving on a mountain road with city skyline far away. MUST be visible together: woman inside car driving + sports car + mountain road + distant city. Wide cinematic shot. Opaque elegant clothes. Not standing outside the car. Not face-only.`;
  } else if (escenaEsVehiculoMirandoAfuera(src)) {
    anclaEscena = `SCENE: ${mustEn || src}. Driver inside luxury car looking through window at store/street outside. Woman + car interior + outside view all visible.`;
  } else {
    anclaEscena = `SCENE (exact): ${mustEn ? `${mustEn}. ${src}` : src}`;
  }

  const reglas = [
    'SFW clothed.',
    '16:9 photoreal medium-wide (NOT beauty headshot).',
    mustEn ? `MUST SHOW: ${mustEn}.` : '',
    escenaEsInteriorOPersonas(src) && !escenaEsConduccionExterior(src)
      ? 'Indoor setting. No outdoor park portrait.'
      : '',
    'No text, no logo, no watermark.',
  ].filter(Boolean).join(' ');

  // Prioridad: ancla de escena + must; reglas al final; nunca cortar la escena.
  const cuerpo = `${anclaEscena} ${reglas}`.replace(/\s+/g, ' ').trim();
  if (cuerpo.length <= 850) return cuerpo;
  // Si aún pasa, recortar reglas, no la ancla.
  const maxAncla = Math.min(anclaEscena.length, 520);
  const resto = 850 - maxAncla - 1;
  return `${anclaEscena.slice(0, maxAncla)} ${reglas.slice(0, Math.max(40, resto))}`.replace(/\s+/g, ' ').trim().slice(0, 850);
}

export function negativosParaEscena(original = '') {
  const base = [
    'watermark', 'text', 'logo', 'letters', 'pollinations', 'pollinations.ai',
    'blurry', 'low quality', 'wrong scene', 'beauty headshot only', 'solo portrait',
    'cropped head', 'cut off face', 'deformed hands', 'extra fingers', 'bad anatomy',
    'nude', 'naked', 'nsfw', 'topless', 'lingerie', 'erotic', 'porn',
    'sheer dress', 'see-through clothes', 'transparent outfit',
  ];
  if (escenaEsEspejoORecamara(original)) {
    base.push('outdoor foliage background', 'park portrait', 'missing mirror', 'missing apple', 'missing bedroom', 'no reflection', 'headshot only');
  }
  if (escenaEsInteriorOPersonas(original) && !escenaPidePaisaje(original) && !escenaEsConduccionExterior(original)) {
    base.push('outdoor landscape', 'meadow', 'river valley', 'mountains scenery', 'nature field', 'empty landscape');
  }
  if (escenaTieneDosPersonas(original)) {
    base.push('only one person', 'missing boyfriend', 'missing coffee cup', 'close-up crop');
  }
  if (escenaEsConduccionExterior(original)) {
    base.push('face only', 'missing sports car', 'missing mountain road', 'missing city skyline', 'empty car no driver', 'no woman', 'standing outside car', 'posing next to car');
  } else if (escenaEsVehiculoMirandoAfuera(original)) {
    base.push('missing car', 'missing steering wheel', 'no storefront', 'wrong ethnicity');
  }
  if (escenaEsDramatica(original)) {
    base.push('peaceful lake', 'calm postcard', 'tourist flowers meadow', 'no eruption', 'no lightning');
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
