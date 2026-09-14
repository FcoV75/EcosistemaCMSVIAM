/**
 * Director Semántico VIAM — cerebro de escena por significados y conjuntos.
 *
 * No pulimos palabra por palabra: leemos la orden como un cuadro completo
 * (sujetos, objetos, acciones, colores, sonidos, secuencia) e inferimos
 * lo lógico del mundo (p. ej. camaleón → cambia de color en cada superficie).
 */

const MODELOS_DIRECTOR = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
];

export function groqKeyDirector() {
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

function listaUnica(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = String(x || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const k = sinAcentos(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function parsearJsonDirector(raw) {
  const texto = String(raw || '').trim();
  if (!texto) return null;
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** Elige un resumen concreto; evita que reglas genéricas (“mientras”) dominen. */
export function elegirResumenInferencias(inferencias, original = '') {
  const lista = Array.isArray(inferencias) ? inferencias : [];
  const concreta = lista.find((x) => !/continuidad temporal/i.test(String(x || '')));
  return String(concreta || lista[0] || original).slice(0, 220);
}

/** Inferencias locales rápidas cuando no hay Groq o como refuerzo. */
export function inferenciasLocales(orden) {
  const n = sinAcentos(orden);
  const out = [];

  if (/\bcamaleon\b/.test(n)) {
    out.push('El camaleón cambia de color según cada superficie que pisa (árbol, piedra, hielo, desierto, fruta, vehículo, etc.), sin que haga falta pedirlo.');
  }
  if (/\b(mujer|hombre|novio|novia|persona).{0,80}(cafe|taza|laptop|escritorio)\b/.test(n)
    || /\b(cafe|taza).{0,80}(novio|novia|mujer|hombre)\b/.test(n)) {
    out.push('Escena de interacción SFW: ambas personas vestidas, taza de café entregada y sonrisa en el mismo plano (nunca desnudos ni retrato erótico).');
  }
  if (/\b(espejo|recamara|habitacion).{0,40}(manzana|afroamerican|mujer)|manzana.{0,60}(espejo|recamara)\b/.test(n)
    || (/\bespejo\b/.test(n) && /\b(recamara|habitacion|manzana)\b/.test(n))) {
    out.push('Recámara + espejo de cuerpo completo: se ve el reflejo, la manzana en la mano hacia la boca y el cuarto; no un retrato outdoor sin espejo.');
  }
  if (/\b(carro|coche|auto|automovil|vehiculo|deportivo).{0,80}(carretera|camino|montana|ciudad)\b/.test(n)
    || /\b(manej|conduc).{0,80}(carretera|camino|montana)\b/.test(n)) {
    out.push('Plano amplio de conducción: vehículo deportivo en la carretera/montaña con la ciudad al fondo; no un close-up de cara sin coche.');
  } else if (/\b(carro|coche|auto|automovil|conduc|manej|volante|ventanilla)\b/.test(n)
    && /\b(tienda|escaparat|joyeria|diamante)\b/.test(n)) {
    out.push('Interior de auto de lujo: conductora al volante, tablero/asientos visibles; la tienda o calle se ve POR LA VENTANA (no un retrato suelto sin coche).');
  }
  if (/\b(tienda|escaparat|joyeria|diamante)\b/.test(n) && !/\b(carretera|montana)\b/.test(n)) {
    out.push('Escaparate/tienda de diamantes o joyería reconocible fuera del vehículo o en la calle descrita.');
  }
  if (/\bucranian\w*\b/.test(n)) {
    out.push('Etnia/apariencia ucraniana (europea del este) según lo pedido, sin sustituir por otro origen.');
  }
  if (/\bsiames|siamesa\b/.test(n)) {
    out.push('Raza siamés: cuerpo crema, puntos oscuros en cara/orejas/patas, ojos azules.');
  }
  if (/\bcasco|astronauta\b/.test(n)) {
    out.push('El casco de astronauta debe verse claro sobre el sujeto.');
  }
  if (/\bvolcan|erupcion|piroclast|relampago|rayo\b/.test(n)) {
    out.push('Ambiente dramático: humo/ceniza, relámpagos y energía de erupción, no postal pacífica.');
  }
  if (/\b(amanecer|atardecer|noche|lluvia|nieve|niebla)\b/.test(n)) {
    out.push('La atmósfera y la luz deben coherir con el momento del día o clima nombrado.');
  }
  // Continuidad genérica al final y solo si no hay inferencia concreta de escena.
  if (out.length === 0 && /\b(caminando|camina|recorriendo|secuencia|luego|despues|mientras)\b/.test(n)) {
    out.push('Hay continuidad temporal: el movimiento y la secuencia deben sentirse lógicos cuadro a cuadro.');
  }
  return out;
}

function extraerTokensBasicos(orden) {
  const stop = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'con', 'por', 'para',
    'al', 'a', 'y', 'o', 'u', 'que', 'se', 'su', 'sus', 'mi', 'tu', 'lo', 'le', 'les', 'es', 'son',
    'muy', 'mas', 'como', 'mientras', 'esta', 'este', 'hay', 'tiene', 'hacer', 'haciendo',
  ]);
  return String(orden || '')
    .replace(/[.,;:!?¿¡]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => {
      const k = sinAcentos(w);
      return k.length >= 3 && !stop.has(k) && !/^\d+$/.test(k);
    })
    .slice(0, 16);
}

/**
 * Brief de emergencia sin LLM: arma conjuntos mínimos + inferencias locales.
 */
export function directorFallback(orden, modalidad = 'imagen') {
  const original = String(orden || '').replace(/\s+/g, ' ').trim();
  const tokens = extraerTokensBasicos(original);
  const inferencias = inferenciasLocales(original);
  const cuadro = [
    `Escena pedida: ${original}.`,
    inferencias.length ? `Inferencias lógicas: ${inferencias.join(' ')}` : '',
    'Mostrar el conjunto completo (sujetos, objetos, acciones y atmósfera) en un solo cuadro coherente.',
  ].filter(Boolean).join(' ');

  const briefVisual = [
    `Photorealistic 16:9 scene that OBEYS the full meaning of: "${original}".`,
    `Key elements: ${tokens.join(', ') || original}.`,
    inferencias.length ? `Implied world logic: ${inferencias.join(' ')}` : '',
    'Show the complete set together with correct anatomy, sharp detail, natural lighting. No text/watermark.',
  ].filter(Boolean).join(' ');

  const briefMotion = [
    briefVisual,
    'Continuous natural motion matching the described actions and sequence; camera logic supports the story.',
  ].join(' ');

  return normalizarBrief({
    orden_original: original,
    modalidad,
    intencion: original.slice(0, 160),
    conjuntos: {
      sujetos: tokens.slice(0, 6),
      objetos: [],
      lugares: [],
      colores: [],
      acciones: [],
      movimientos: [],
      sonidos: [],
      atmosfera: [],
      secuencia: [],
    },
    inferencias,
    cuadro_completo: cuadro,
    brief_visual_en: briefVisual,
    brief_motion_en: briefMotion,
    brief_voz_es: `Narra con naturalidad la escena y su sentido completo: ${original}`,
    brief_musica: {
      mood: /volcan|erupcion|rayo|energia|cometa/i.test(original) ? 'dramatico' : 'cinematico',
      tempo: /caminando|lento|suave/i.test(original) ? 'moderado' : 'medio',
      estilo: 'cinematico',
    },
    prohibidos: [
      'inventar otra escena',
      'omitir sujetos u objetos del conjunto',
      'paisaje genérico si no se pidió',
      'recorte que rompa la acción',
    ],
    estilo_camara: modalidad === 'clip' ? 'plano continuo con movimiento natural' : 'plano medio-ancho 16:9',
    resumen_es: elegirResumenInferencias(inferencias, original),
    via: 'fallback-local',
  }, modalidad);
}

function normalizarBrief(data, modalidad = 'imagen') {
  const original = String(data.orden_original || data.orden || '').replace(/\s+/g, ' ').trim();
  const conjuntosIn = data.conjuntos || {};
  const conjuntos = {
    sujetos: listaUnica(conjuntosIn.sujetos),
    objetos: listaUnica(conjuntosIn.objetos),
    lugares: listaUnica(conjuntosIn.lugares),
    colores: listaUnica(conjuntosIn.colores),
    acciones: listaUnica(conjuntosIn.acciones),
    movimientos: listaUnica(conjuntosIn.movimientos),
    sonidos: listaUnica(conjuntosIn.sonidos),
    atmosfera: listaUnica(conjuntosIn.atmosfera),
    secuencia: listaUnica(conjuntosIn.secuencia),
  };
  const inferencias = listaUnica([
    ...(Array.isArray(data.inferencias) ? data.inferencias : []),
    ...inferenciasLocales(original),
  ]).slice(0, 8);

  const briefVisual = String(data.brief_visual_en || data.prompt_en || '').trim()
    || directorFallback(original, modalidad).brief_visual_en;
  const briefMotion = String(data.brief_motion_en || '').trim() || `${briefVisual} Natural continuous motion.`;
  const musica = data.brief_musica && typeof data.brief_musica === 'object'
    ? data.brief_musica
    : { mood: 'cinematico', tempo: 'medio', estilo: 'cinematico' };

  return {
    orden_original: original,
    modalidad: String(data.modalidad || modalidad),
    intencion: String(data.intencion || original).slice(0, 220),
    conjuntos,
    inferencias,
    cuadro_completo: String(data.cuadro_completo || original).slice(0, 900),
    brief_visual_en: briefVisual.slice(0, 1800),
    brief_motion_en: briefMotion.slice(0, 1800),
    brief_voz_es: String(data.brief_voz_es || '').slice(0, 600),
    brief_musica: {
      mood: String(musica.mood || 'cinematico').slice(0, 40),
      tempo: String(musica.tempo || 'medio').slice(0, 40),
      estilo: String(musica.estilo || 'cinematico').slice(0, 40),
    },
    prohibidos: listaUnica(data.prohibidos).slice(0, 10),
    estilo_camara: String(data.estilo_camara || '16:9 medium-wide').slice(0, 120),
    resumen_es: (() => {
      const r = String(data.resumen_es || data.resumen || '').trim();
      if (r && !/continuidad temporal/i.test(r)) return r.slice(0, 220);
      return elegirResumenInferencias(inferencias, original);
    })(),
    via: String(data.via || 'director'),
  };
}

const SYSTEM_DIRECTOR = `Eres el Director Semántico del Ecosistema VIAM (Video Diamante y ContacNeed).
Tu trabajo NO es traducir palabra por palabra. Debes entender SIGNIFICADOS y CONJUNTOS.

Dada una orden del usuario (suele estar en español), construyes el CUADRO COMPLETO:
- sujetos, objetos, lugares, colores, acciones, movimientos, sonidos, atmósfera
- secuencia temporal si la hay
- INFERENCIAS LÓGICAS del mundo real (ej. camaleón camina por superficies distintas ⇒ cambia de color en cada una, aunque no lo digan)
- cámara, ritmo y coherencia narrativa

Reglas:
1) Obedece el conjunto, no un token suelto.
2) Si faltan detalles implícitos por conocimiento general, INFIÉRELOS y decláralos en "inferencias".
3) No inventes otra historia: amplía la pedida con lógica, no la sustituyas.
4) Si hay dos personas/objetos de interacción, ambos deben quedar en el cuadro.
5) SFW obligatorio: personas vestidas, sin desnudos ni contenido erótico salvo que el usuario lo pida explícitamente (casi nunca).
6) Si hay coche/conducir/tienda: el vehículo y el lugar deben verse; no sustituyas por un retrato close-up.
7) brief_visual_en y brief_motion_en van en inglés, listos para modelos de imagen/video.
8) brief_voz_es en español oral, breve, para locución.
9) brief_musica sugiere mood/tempo/estilo para MIDI o pista.
10) Responde SOLO JSON válido con esta forma:
{
  "intencion":"...",
  "conjuntos":{"sujetos":[],"objetos":[],"lugares":[],"colores":[],"acciones":[],"movimientos":[],"sonidos":[],"atmosfera":[],"secuencia":[]},
  "inferencias":["..."],
  "cuadro_completo":"...",
  "brief_visual_en":"...",
  "brief_motion_en":"...",
  "brief_voz_es":"...",
  "brief_musica":{"mood":"...","tempo":"...","estilo":"..."},
  "prohibidos":["..."],
  "estilo_camara":"...",
  "resumen_es":"..."
}`;

/**
 * Dirige una orden hacia un brief semántico completo.
 * @param {string} orden
 * @param {{ modalidad?: 'imagen'|'clip'|'voz'|'discurso'|'musica' }} [opts]
 */
export async function dirigirEscena(orden, { modalidad = 'imagen' } = {}) {
  const original = String(orden || '').replace(/\s+/g, ' ').trim();
  const base = directorFallback(original, modalidad);
  if (!original) return base;

  const apiKey = groqKeyDirector();
  if (!apiKey) return base;

  const tarea = {
    imagen: 'Dirige una FOTO fija 16:9 del cuadro completo.',
    clip: 'Dirige un CLIP/VIDEO corto con secuencia, movimiento e inferencias visibles.',
    voz: 'Dirige una locución: qué debe sentirse y decirse.',
    discurso: 'Dirige un discurso hablado coherente con la intención del usuario.',
    musica: 'Dirige el clima musical (mood/tempo/estilo) coherente con la escena.',
  }[modalidad] || 'Dirige la escena completa.';

  const messages = [
    { role: 'system', content: SYSTEM_DIRECTOR },
    {
      role: 'user',
      content: `${tarea}\nModalidad: ${modalidad}\nOrden del usuario: ${original}\n\nRecuerda: conjuntos + inferencias lógicas + cuadro completo. No te quedes en palabras sueltas.`,
    },
  ];

  try {
    for (const model of MODELOS_DIRECTOR) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 900,
          messages,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) continue;
      const parsed = parsearJsonDirector(data?.choices?.[0]?.message?.content);
      if (!parsed) continue;
      return normalizarBrief({
        ...parsed,
        orden_original: original,
        modalidad,
        via: `director:${model}`,
      }, modalidad);
    }
  } catch (err) {
    console.warn('dirigirEscena:', err?.message || err);
  }
  return base;
}

/** Convierte el brief del director en prompt listo para generadores visuales. */
export function briefAPromptVisual(brief, { motion = false } = {}) {
  if (!brief) return '';
  const base = motion ? (brief.brief_motion_en || brief.brief_visual_en) : brief.brief_visual_en;
  const conjuntos = brief.conjuntos || {};
  const mustParts = [
    ...listaUnica(conjuntos.sujetos),
    ...listaUnica(conjuntos.objetos),
    ...listaUnica(conjuntos.lugares),
  ].slice(0, 12);
  const must = mustParts.length ? `MUST INCLUDE (full set visible): ${mustParts.join(', ')}. ` : '';
  const infer = (brief.inferencias || []).length
    ? ` World logic: ${brief.inferencias.join(' ')}`
    : '';
  const prohib = (brief.prohibidos || []).length
    ? ` FORBIDDEN: ${brief.prohibidos.join('; ')}.`
    : '';
  const cam = brief.estilo_camara ? ` Camera: ${brief.estilo_camara}.` : '';
  return `${must}${base}${infer}${cam}${prohib} Exact meaning of the user order. Sharp photoreal, correct anatomy, no text.`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

/** Guía corta para discurso/voz a partir del director. */
export function briefAGuiaOral(brief) {
  if (!brief) return '';
  const partes = [
    brief.brief_voz_es,
    brief.cuadro_completo ? `Cuadro: ${brief.cuadro_completo}` : '',
    (brief.inferencias || []).length ? `Incluye con naturalidad: ${brief.inferencias.join(' ')}` : '',
  ].filter(Boolean);
  return partes.join('\n').slice(0, 1200);
}
