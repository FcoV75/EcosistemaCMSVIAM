/** Reescribe la escena del usuario a un prompt visual en inglés, sin perder sujetos. */

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
  novio: 'boyfriend',
  novia: 'girlfriend',
  escritorio: 'desk',
  laptop: 'laptop',
  ordenador: 'computer',
  computadora: 'computer',
  oficina: 'office',
  oriental: 'East Asian',
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
  return /\b(mujer|hombre|persona|novio|novia|escritorio|laptop|ordenador|computadora|oficina|cocina|cafe|taza|interior|cuarto|habitacion|salon|estudio|retrato|pareja|sonrie|sonrisa|obsequi)\w*\b/.test(n);
}

/** Acción dramática (volcán, tormenta, erupción): no postcard pacífico. */
export function escenaEsDramatica(texto) {
  const n = sinAcentos(texto);
  return /\b(volcan|erupcion|fumarola|piroclast\w*|relampago|rayo|tormenta|explosion|incendio|lava|humo|avion)\w*\b/.test(n)
    || /\b(relampagos|rayos)\b/.test(n);
}

export function clausulaProhibidos(texto) {
  if (escenaEsInteriorOPersonas(texto) && !escenaPidePaisaje(texto)) {
    return ' FORBIDDEN: replacing the scene with an outdoor landscape, meadow, river, mountains, field, nature scenery, or a lone silhouette in a valley. This is an INDOOR / people scene.';
  }
  if (escenaEsDramatica(texto)) {
    return ' FORBIDDEN: peaceful lake postcard, calm flowers meadow, sunny tourist landscape, Mount Fuji calm postcard look. SHOW the eruption, ash, lightning and drama described.';
  }
  return ' FORBIDDEN: inventing a different place or dropping named subjects.';
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
  const cabeza = modo === 'clip'
    ? 'Photorealistic cinematic 16:9 film plate of the EXACT user scene. Sharp details, lighting matching the described time of day.'
    : 'Photorealistic 16:9 photograph of the EXACT user scene, sharp focus, high detail, natural professional lighting.';
  return `${cabezaMust}${cabeza} Original scene (keep it): "${escena}". OBEY THIS SCENE EXACTLY (do not invent a different place or drop characters): ${sujetos}${ancla}${prohibidos} No text, no watermark, no logo, no letters.`;
}

/** Refuerzo para Imagen IA: obedece la escena; no inyecta paisaje genérico. */
export function promptImagenReforzado(promptEn, original = '') {
  const p = String(promptEn || '').trim();
  if (!p) return '';
  const src = String(original || p).trim();
  const ancla = anclarVueloAlPaisaje(src);
  const must = clausulaMustInclude(src);
  const prohibidos = clausulaProhibidos(src);
  const paisaje = escenaPidePaisaje(src)
    ? 'Show the full place and setting the user described; keep all named subjects visible together.'
    : 'OBEY the user scene exactly. Do NOT invent rivers, flowers, mountains, birds, bakeries or landscapes that were not asked for.';
  return `${must}Photorealistic 16:9 still. ${paisaje} Do not replace or simplify the scene.${ancla}${prohibidos} ${p}`
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
  const paisaje = escenaPidePaisaje(src)
    ? 'Keep the described place fully visible while the camera moves.'
    : 'OBEY the user scene exactly. Do NOT invent extra places or drop named subjects.';
  return `${must}Cinematic 16:9 clip / film plate. ${paisaje} Natural motion matching the description (zoom, pan or subject motion).${ancla}${prohibidos} ${p}`
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prompt corto y sujeto-primero para proveedores que truncuan (p. ej. Pollinations Flux). */
export function promptCortoParaFlux(original, promptEn = '') {
  const src = String(original || '').replace(/\s+/g, ' ').trim();
  const must = clausulaMustInclude(src).replace(/^MUST INCLUDE:\s*/i, '').replace(/\.\s*$/, '');
  const prohibidos = clausulaProhibidos(src);
  const base = String(promptEn || '').trim();
  const corto = base
    ? base.slice(0, 420)
    : `Photorealistic 16:9 of: ${src}`;
  return `MUST INCLUDE visible: ${must || src}. ${corto}${prohibidos} Exact scene only. No text.`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 780);
}

export function negativosParaEscena(original = '') {
  const base = ['watermark', 'text', 'logo', 'letters', 'blurry', 'low quality', 'wrong scene'];
  if (escenaEsInteriorOPersonas(original) && !escenaPidePaisaje(original)) {
    return [...base, 'outdoor landscape', 'meadow', 'river valley', 'mountains scenery', 'nature field', 'lone silhouette in grass', 'empty landscape'].join(', ');
  }
  if (escenaEsDramatica(original)) {
    return [...base, 'peaceful lake', 'calm postcard', 'tourist flowers meadow', 'sunny serene mountain', 'no eruption', 'no lightning'].join(', ');
  }
  return [...base, 'empty blue sky only', 'lone silhouette'].join(', ');
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
  };
  const apiKey = groqKeyVisual();
  if (!apiKey || !original) return fallback;

  const tarea = modo === 'clip'
    ? 'Write an English prompt for a cinematic 16:9 film plate or short clip of the EXACT user scene. Prefer clear subjects and natural motion; never invent a different place.'
    : 'Write an English prompt for a single photorealistic 16:9 photograph of the EXACT user scene.';

  const system = `You turn a user's scene (usually Spanish) into ONE English image/video prompt.
Rules:
- First line of prompt_en MUST list required subjects: "MUST INCLUDE: …" using English names plus the original Spanish in parentheses (example: coffee cup (café), boyfriend (novio), desk (escritorio), volcano (volcán)).
- Keep EVERY subject, place, time of day, weather and camera idea from the user. Quote the original sentence inside the English prompt.
- If two people or animals are named, both must appear, named twice (example: "a woman AND a man, both fully visible").
- Do NOT invent subjects, places or props the user did not mention.
- If the scene is indoor/people (desk, laptop, coffee, couple): describe an INDOOR room. Never turn it into a nature landscape.
- If the scene is a volcano/eruption/lightning: keep ash, lava, lightning, drama — never a peaceful postcard mountain.
- Only if the user says volando/flying near flowers or a river: describe hovering at the blossoms with those places still in frame.
- 50-110 words. Photorealistic, sharp, 16:9. Exact obedience over generic beauty.
- No text, watermark, logo or letters in the image.
- Reply ONLY JSON: {"prompt_en":"...","resumen":"una línea en español de lo que debe verse","elementos":["..."]}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `${tarea}\nEscena del usuario: ${original}` },
  ];

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
          messages,
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
        else if (!escenaPidePaisaje(original) && escenaEsInteriorOPersonas(original) && !/INDOOR/i.test(promptEn)) {
          promptEn += prohibidos;
        }
        return { promptEn: promptEn.slice(0, 1600), resumen: parsed.resumen, via: `groq:${model}` };
      }
    }
  } catch (err) {
    console.warn('expandirPromptVisual:', err?.message || err);
  }
  return fallback;
}
