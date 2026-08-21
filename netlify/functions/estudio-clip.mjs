import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { LIMITES_CLIP, clamp, esPremiumPayload } from './lib/estudio-limites.mjs';
import { expandirPromptVisual, promptImagenReforzado } from './lib/estudio-prompt-visual.mjs';
import { generarImagenEstudio } from './lib/estudio-imagen-gen.mjs';

async function esperarFal(statusUrl, responseUrl, headers, timeoutMs = 50000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const st = await fetch(statusUrl, { headers });
    const data = await st.json().catch(() => ({}));
    const status = String(data.status || '').toUpperCase();
    if (status === 'COMPLETED') {
      const done = await fetch(responseUrl, { headers });
      return done.json();
    }
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'ERROR') {
      throw new Error(data.error || 'El proveedor de video IA falló.');
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function generarClipFal(promptEn, segundos) {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
  if (!key) return null;
  const model = process.env.FAL_VIDEO_MODEL || 'fal-ai/ltx-video';
  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
  const frames = Math.max(97, Math.min(241, Math.round(segundos * 24)));
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: `${promptEn}, cinematic camera, photorealistic, 16:9, smooth motion, no text, no watermark`,
      negative_prompt: 'text, watermark, logo, distortion, low quality, empty sky, missing subjects',
      num_frames: frames,
    }),
  });
  const queued = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.warn('Fal queue:', r.status, queued);
    return null;
  }
  const statusUrl = queued.status_url;
  const responseUrl = queued.response_url;
  if (!statusUrl || !responseUrl) return null;
  const result = await esperarFal(statusUrl, responseUrl, headers);
  const videoUrl = result?.video?.url || result?.video_url || result?.output?.url;
  if (!videoUrl) return null;
  return { video_url: videoUrl, fuente: 'fal', mime: 'video/mp4' };
}

async function generarClipReplicate(promptEn, segundos) {
  const token = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (!token) return null;
  const model = process.env.REPLICATE_VIDEO_MODEL || 'wavespeedai/wan-2.1-t2v-480p';
  const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=50',
    },
    body: JSON.stringify({
      input: {
        prompt: `${promptEn}, cinematic, 16:9, no text`,
        duration: segundos,
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.warn('Replicate video:', r.status, data);
    return null;
  }
  const out = data.output;
  const videoUrl = Array.isArray(out) ? out[0] : (out?.url || out);
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  return { video_url: videoUrl, fuente: 'replicate', mime: 'video/mp4' };
}

export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'estudio_clip',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const body = await req.json();
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return jsonResponse({ error: 'Describe el clip que quieres generar.' }, 400);

    const premium = esPremiumPayload(guard.payload);
    const lim = premium ? LIMITES_CLIP.premium : LIMITES_CLIP.free;
    const duracion = clamp(body.duracionSeg ?? body.duracion ?? lim.minSeg, lim.minSeg, lim.maxSeg);
    const expansion = await expandirPromptVisual(prompt, { modo: 'clip' });
    const promptEn = promptImagenReforzado(expansion.promptEn);

    let nativo = null;
    try {
      nativo = await generarClipFal(promptEn, duracion);
    } catch (err) {
      console.warn('Fal clip:', err?.message || err);
    }
    if (!nativo) {
      try {
        nativo = await generarClipReplicate(promptEn, duracion);
      } catch (err) {
        console.warn('Replicate clip:', err?.message || err);
      }
    }
    if (nativo?.video_url) {
      return jsonResponse({
        success: true,
        tipo: 'video',
        video_url: nativo.video_url,
        mime: nativo.mime,
        duracionSeg: duracion,
        fuente: nativo.fuente,
        resumen: expansion.resumen || '',
      });
    }

    const cine = await generarImagenEstudio(promptEn, {
      width: 1920,
      height: 1080,
      seed: Date.now() % 99999,
    });
    if (!cine) {
      return jsonResponse({
        error: 'No se pudo generar el clip. Intenta de nuevo o usa Imagen IA + Movimiento.',
      }, 502);
    }

    return jsonResponse({
      success: true,
      tipo: 'cinematico',
      imagen_base64: cine.imagen_base64,
      mime: cine.mime,
      duracionSeg: duracion,
      fuente: cine.fuente,
      movimiento: true,
      resumen: expansion.resumen || '',
      aviso: `Clip de ${duracion} s: escena según tu descripción; el navegador graba el movimiento.`,
    });
  } catch (e) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
};
