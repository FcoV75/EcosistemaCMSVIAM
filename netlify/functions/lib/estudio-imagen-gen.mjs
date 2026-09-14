/** Generadores de imagen HD para Estudio VIAM.
 * Orden: Imagen 4 → Fal Flux → Gemini → Replicate → Pollinations (último recurso).
 * Pollinations: sin gptimage (propenso a NSFW); flux + SFW + nologo.
 */

import { negativosParaEscena, promptCortoParaFlux, seedDesdePrompt } from './estudio-prompt-visual.mjs';

async function extraerImagenGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (!inline?.data) continue;
    const mime = String(inline.mimeType || inline.mime_type || 'image/png');
    if (!mime.startsWith('image/')) continue;
    const buf = Buffer.from(inline.data, 'base64');
    if (buf.length < 4000) continue;
    return { buffer: buf, mime };
  }
  return null;
}

async function fetchConTimeout(url, opciones, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opciones, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const SFW_HARD = 'SFW, fully clothed opaque clothing, tasteful family-friendly, no nudity, no erotic content, no logos, no watermarks.';
const ANATOMY_HARD = 'Hyperrealistic 8k detail; perfect symmetrical human face (aligned eyes, natural nose/mouth); correct hands with five fingers; coherent body proportions; no deformed/melted/warped anatomy; vehicles and objects with clean symmetric geometry; landscapes with coherent perspective.';

export async function generarImagenGemini(promptEn) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  const modelos = [
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-preview-image-generation',
    'gemini-2.0-flash-preview-image-generation',
  ];
  const cuerpo = {
    contents: [{
      parts: [{
        text: `${promptEn}\n\nHard requirements: ${SFW_HARD} ${ANATOMY_HARD} Show EVERY named subject and prop; full heads in frame; ultra sharp 16:9 photoreal; no text.`,
      }],
    }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
  for (const modelo of modelos) {
    try {
      const r = await fetchConTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        },
        50000,
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Gemini imagen', modelo, r.status, JSON.stringify(data).slice(0, 180));
        continue;
      }
      const extraido = extraerImagenGemini(data);
      if (extraido) {
        return {
          imagen_base64: extraido.buffer.toString('base64'),
          mime: extraido.mime,
          fuente: modelo,
        };
      }
    } catch (err) {
      console.warn('Gemini imagen', modelo, err?.name || err?.message || err);
    }
  }
  return null;
}

/** Fal Flux Pro / Dev: mucho mejor obediencia y nitidez que Pollinations. */
export async function generarImagenFal(promptEn) {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
  if (!key) return null;
  const modelos = [
    process.env.FAL_IMAGE_MODEL,
    'fal-ai/flux-pro/v1.1',
    'fal-ai/flux/dev',
    'fal-ai/recraft/v3/text-to-image',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };

  for (const model of modelos) {
    try {
      const r = await fetchConTimeout(`https://fal.run/${model}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `${String(promptEn || '').slice(0, 2100)}. ${SFW_HARD} ${ANATOMY_HARD}`,
          image_size: 'landscape_16_9',
          num_images: 1,
          enable_safety_checker: true,
          output_format: 'jpeg',
          num_inference_steps: 28,
          guidance_scale: 3.5,
        }),
      }, 55000);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Fal imagen', model, r.status, JSON.stringify(data).slice(0, 180));
        continue;
      }
      const url = data?.images?.[0]?.url || data?.image?.url || data?.output?.url;
      if (!url) continue;
      const img = await fetchConTimeout(url, {}, 30000);
      if (!img.ok) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 8000) continue;
      return {
        imagen_base64: buf.toString('base64'),
        mime: img.headers.get('content-type') || 'image/jpeg',
        fuente: `fal:${model}`,
      };
    } catch (err) {
      console.warn('Fal imagen', model, err?.name || err?.message || err);
    }
  }
  return null;
}

export async function generarImagenReplicate(promptEn) {
  const token = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (!token) return null;
  const modelos = [
    process.env.REPLICATE_IMAGE_MODEL,
    'black-forest-labs/flux-1.1-pro',
    'black-forest-labs/flux-schnell',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  for (const model of modelos) {
    try {
      const r = await fetchConTimeout(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=50',
        },
        body: JSON.stringify({
          input: {
            prompt: `${String(promptEn || '').slice(0, 1700)}. ${SFW_HARD} ${ANATOMY_HARD}`,
            aspect_ratio: '16:9',
            output_format: 'jpg',
            output_quality: 95,
          },
        }),
      }, 55000);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Replicate imagen', model, r.status, JSON.stringify(data).slice(0, 180));
        continue;
      }
      const out = data.output;
      const url = Array.isArray(out) ? out[0] : (out?.url || out);
      if (!url || typeof url !== 'string') continue;
      const img = await fetchConTimeout(url, {}, 30000);
      if (!img.ok) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 8000) continue;
      return {
        imagen_base64: buf.toString('base64'),
        mime: img.headers.get('content-type') || 'image/jpeg',
        fuente: `replicate:${model}`,
      };
    } catch (err) {
      console.warn('Replicate imagen', model, err?.name || err?.message || err);
    }
  }
  return null;
}

export async function generarImagenPollinations(promptEn, { width = 1920, height = 1080, seed, original = '' } = {}) {
  const escena = promptCortoParaFlux(original || promptEn, promptEn);
  if (!escena) return null;
  const baseSeed = Number.isFinite(Number(seed)) ? Number(seed) : seedDesdePrompt(original || promptEn);
  const negativo = encodeURIComponent(negativosParaEscena(original || promptEn));
  // Personas: enhance=true en Pollinations suele derretir caras/manos.
  // Priorizar flux-realism sin enhance para anatomía más limpia.
  const conPersonas = /\b(mujer|hombre|woman|man|person|girl|boy|driver|novio|novia)\b/i.test(
    `${original} ${promptEn} ${escena}`,
  );
  const intentos = conPersonas
    ? [
        { model: 'flux-realism', enhance: false },
        { model: 'flux', enhance: false },
        { model: 'flux-realism', enhance: true },
      ]
    : [
        { model: 'flux-realism', enhance: true },
        { model: 'flux', enhance: true },
        { model: 'flux-realism', enhance: false },
      ];
  for (let i = 0; i < intentos.length; i += 1) {
    const { model, enhance } = intentos[i];
    const n = baseSeed + i * 97;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(escena)}?width=${width}&height=${height}&nologo=true&private=true&nofeed=true&enhance=${enhance ? 'true' : 'false'}&model=${model}&seed=${n}&negative=${negativo}&referrer=video_diamante`;
    try {
      const img = await fetchConTimeout(url, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      }, 40000);
      if (!img.ok) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 12000) continue;
      return {
        imagen_base64: buf.toString('base64'),
        mime: img.headers.get('content-type') || 'image/jpeg',
        fuente: `pollinations-${model}`,
        // El cliente cubre el logo residual de Pollinations y estampa video_diamante en Free.
        marca_agua_pollinations: true,
      };
    } catch (err) {
      console.warn('Pollinations', model, err?.name || err?.message || err);
    }
  }
  return null;
}

export async function generarImagenImagen4(promptEn) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  const escena = `${String(promptEn || '').trim()}. ${SFW_HARD} ${ANATOMY_HARD}`;
  if (!String(promptEn || '').trim()) return null;
  const modelos = ['imagen-4.0-generate-001', 'imagen-4.0-ultra-generate-001', 'imagen-4.0-fast-generate-001'];
  for (const modelo of modelos) {
    try {
      const r = await fetchConTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: escena }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '16:9',
              personGeneration: 'allow_adult',
            },
          }),
        },
        55000,
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Imagen', modelo, r.status, JSON.stringify(data).slice(0, 180));
        continue;
      }
      const pred = data?.predictions?.[0] || {};
      const b64 = pred.bytesBase64Encoded || pred.bytesBase64encoded || pred.image || '';
      if (String(b64).length > 4000) {
        return { imagen_base64: b64, mime: 'image/png', fuente: modelo };
      }
    } catch (err) {
      console.warn('Imagen', modelo, err?.name || err?.message || err);
    }
  }
  return null;
}

export async function generarImagenEstudio(promptEn, opts = {}) {
  // Modelos fuertes primero: Imagen 4 y Fal dominan detalle/obediencia.
  const imagen4 = await generarImagenImagen4(promptEn);
  if (imagen4) return imagen4;

  const fal = await generarImagenFal(promptEn);
  if (fal) return fal;

  const gemini = await generarImagenGemini(promptEn);
  if (gemini) return gemini;

  const replicate = await generarImagenReplicate(promptEn);
  if (replicate) return replicate;

  return generarImagenPollinations(promptEn, opts);
}
