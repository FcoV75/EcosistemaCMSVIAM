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
    'volando', 'vuela', 'vuelo', 'brillantes', 'variados', 'colores', 'libando',
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
  return unicas.slice(0, 12);
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
  return /montana|rio|orilla|bosque|selva|playa|valle|atardecer|amanecer|paisaje|landscape|river|mountain|forest|beach|jungle|sunset|dawn|lake|lago/.test(n);
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
  const cabeza = modo === 'clip'
    ? 'Photorealistic cinematic 16:9 film plate of the EXACT user scene. Sharp details, lighting matching the described time of day.'
    : 'Photorealistic 16:9 photograph of the EXACT user scene, sharp focus, high detail, natural professional lighting.';
  return `${cabezaMust}${cabeza} Original scene (keep it): "${escena}". OBEY THIS SCENE EXACTLY (do not invent a different place or drop characters): ${sujetos}${ancla} No text, no watermark, no logo, no letters.`;
}

/** Refuerzo para Imagen IA: obedece la escena; no inyecta paisaje genérico. */
export function promptImagenReforzado(promptEn, original = '') {
  const p = String(promptEn || '').trim();
  if (!p) return '';
  const src = String(original || p).trim();
  const ancla = anclarVueloAlPaisaje(src);
  const must = clausulaMustInclude(src);
  const paisaje = escenaPidePaisaje(src)
    ? 'Show the full place and setting the user described; keep all named subjects visible together.'
    : 'OBEY the user scene exactly. Do NOT invent rivers, flowers, mountains, birds, bakeries or landscapes that were not asked for.';
  return `${must}Photorealistic 16:9 still. ${paisaje} Do not replace or simplify the scene.${ancla} ${p}`
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
  const paisaje = escenaPidePaisaje(src)
    ? 'Keep the described place fully visible while the camera moves.'
    : 'OBEY the user scene exactly. Do NOT invent extra places or drop named subjects.';
  return `${must}Cinematic 16:9 clip / film plate. ${paisaje} Natural motion matching the description (zoom, pan or subject motion).${ancla} ${p}`
    .replace(/\s+/g, ' ')
    .trim();
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
- First line of prompt_en MUST list required subjects: "MUST INCLUDE: …" using English names plus the original Spanish in parentheses (example: hummingbird (colibrí), bread (pan)).
- Keep EVERY subject, place, time of day, weather and camera idea from the user. Quote the original sentence inside the English prompt.
- If two animals or people are named, both must appear, named twice (example: "a deer AND a zebra, both fully visible in the same frame").
- Do NOT invent subjects, places or props the user did not mention (no extra rivers, flowers, mountains, birds, bakeries, etc.).
- Do not replace the scene with clouds, a lone sky, or a flying silhouette.
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
          temperature: 0.1,
          max_tokens: 360,
          messages,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) continue;
      const parsed = parsearExpansion(data?.choices?.[0]?.message?.content);
      if (parsed?.promptEn) {
        const must = clausulaMustInclude(original);
        const ancla = anclarVueloAlPaisaje(original);
        let promptEn = parsed.promptEn.startsWith('MUST INCLUDE')
          ? parsed.promptEn
          : `${must}${parsed.promptEn} Original: "${original}"`;
        if (ancla && !/FORBIDDEN: empty blue sky/i.test(promptEn)) promptEn += ancla;
        if (!escenaPidePaisaje(original) && !/Do NOT invent/i.test(promptEn)) {
          promptEn += ' Do NOT invent rivers, flowers, mountains or birds that were not asked for.';
        }
        return { promptEn: promptEn.slice(0, 1600), resumen: parsed.resumen, via: `groq:${model}` };
      }
    }
  } catch (err) {
    console.warn('expandirPromptVisual:', err?.message || err);
  }
  return fallback;
}
