import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { LIMITES_CLIP, clamp, esPremiumPayload } from './lib/estudio-limites.mjs';
import { expandirPromptVisual, seedDesdePrompt } from './lib/estudio-prompt-visual.mjs';
import { generarImagenEstudio } from './lib/estudio-imagen-gen.mjs';

/** Presupuesto total para no disparar Inactivity Timeout de Safari/Netlify (~60s). */
const BUDGET_CLIP_MS = 42000;

function tiempoRestante(inicio, budget = BUDGET_CLIP_MS) {
  return Math.max(0, budget - (Date.now() - inicio));
}

async function esperarFal(statusUrl, responseUrl, headers, timeoutMs = 14000) {
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
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

async function generarClipVidu(promptEn, segundos, maxWaitMs = 14000) {
  const key = (process.env.VIDU_API_KEY || process.env.VIDU_KEY || '').trim();
  if (!key || maxWaitMs < 4000) return null;
  const model = process.env.VIDU_VIDEO_MODEL || 'viduq3-turbo';
  const dur = Math.max(5, Math.min(16, Math.round(Number(segundos) || 8)));
  const headers = {
    Authorization: `Token ${key}`,
    'Content-Type': 'application/json',
  };
  const r = await fetch('https://api.vidu.com/ent/v2/text2video', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      prompt: String(promptEn || '').slice(0, 2000),
      duration: dur,
      resolution: '720p',
      style: 'general',
    }),
  });
  const queued = await r.json().catch(() => ({}));
  const taskId = queued.task_id || queued.id;
  if (!r.ok || !taskId) {
    console.warn('Vidu:', r.status, queued);
    return null;
  }
  const inicio = Date.now();
  while (Date.now() - inicio < maxWaitMs) {
    const st = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, { headers: { Authorization: `Token ${key}` } });
    const data = await st.json().catch(() => ({}));
    const status = String(data.state || data.status || '').toLowerCase();
    if (status === 'success' || status === 'completed') {
      const url = data.creations?.[0]?.url
        || data.creations?.[0]?.video_url
        || data.video?.url
        || data.url;
      if (url) return { video_url: url, fuente: 'vidu', mime: 'video/mp4', duracionSeg: dur };
    }
    if (status === 'failed' || status === 'error') {
      console.warn('Vidu tarea:', data);
      return null;
    }
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return null;
}

async function generarClipFal(promptEn, segundos, maxWaitMs = 14000) {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
  if (!key || maxWaitMs < 4000) return null;
  const modelos = [
    process.env.FAL_VIDEO_MODEL,
    'fal-ai/ltx-video',
    'fal-ai/kling-video/v2.1/standard/text-to-video',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);
  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
  const frames = Math.max(97, Math.min(241, Math.round(segundos * 24)));
  // Un solo modelo rápido dentro del presupuesto (evitar encadenar 50s×N).
  for (const model of modelos.slice(0, 1)) {
    const r = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        negative_prompt: 'text, watermark, logo, pollinations, nude, naked, nsfw, deformed face, asymmetric eyes, melted face, extra fingers, bad anatomy, distortion, low quality, empty sky, missing subjects, solo portrait wrong scene',
        prompt: `${promptEn}, cinematic camera, photorealistic hyperrealistic 8k, perfect symmetrical faces, correct hands, smooth motion, 16:9, no text, no watermark`,
        num_frames: frames,
        duration: segundos,
      }),
    });
    const queued = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.warn('Fal queue:', model, r.status, queued);
      continue;
    }
    const statusUrl = queued.status_url;
    const responseUrl = queued.response_url;
    if (!statusUrl || !responseUrl) continue;
    const result = await esperarFal(statusUrl, responseUrl, headers, maxWaitMs);
    const videoUrl = result?.video?.url || result?.video_url || result?.output?.url;
    if (videoUrl) return { video_url: videoUrl, fuente: `fal:${model}`, mime: 'video/mp4' };
  }
  return null;
}

async function generarClipReplicate(promptEn, segundos, maxWaitMs = 12000) {
  const token = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (!token || maxWaitMs < 4000) return null;
  const model = process.env.REPLICATE_VIDEO_MODEL || 'wavespeedai/wan-2.1-t2v-480p';
  const waitSec = Math.max(5, Math.min(20, Math.floor(maxWaitMs / 1000)));
  const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: `wait=${waitSec}`,
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

  const inicio = Date.now();
  try {
    const body = await req.json();
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return jsonResponse({ error: 'Describe el clip que quieres generar.' }, 400);

    const premium = esPremiumPayload(guard.payload);
    const lim = premium ? LIMITES_CLIP.premium : LIMITES_CLIP.free;
    const duracion = clamp(body.duracionSeg ?? body.duracion ?? lim.minSeg, lim.minSeg, lim.maxSeg);
    const expansion = await expandirPromptVisual(prompt, { modo: 'clip' });
    const promptEn = expansion.promptEn;
    const dir = expansion.director;
    const metaDirector = dir
      ? {
          intencion: dir.intencion,
          inferencias: dir.inferencias?.slice(0, 4) || [],
          resumen_es: dir.resumen_es,
          via: dir.via,
        }
      : null;

    let nativo = null;
    // Presupuesto corto por proveedor; si no llega a tiempo → placa + Ken Burns (siempre responde).
    if (tiempoRestante(inicio) > 8000) {
      try {
        nativo = await generarClipVidu(promptEn, duracion, Math.min(14000, tiempoRestante(inicio) - 6000));
      } catch (err) {
        console.warn('Vidu clip:', err?.message || err);
      }
    }
    if (!nativo && tiempoRestante(inicio) > 8000) {
      try {
        nativo = await generarClipFal(promptEn, duracion, Math.min(14000, tiempoRestante(inicio) - 6000));
      } catch (err) {
        console.warn('Fal clip:', err?.message || err);
      }
    }
    if (!nativo && tiempoRestante(inicio) > 8000) {
      try {
        nativo = await generarClipReplicate(promptEn, duracion, Math.min(12000, tiempoRestante(inicio) - 5000));
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
        prompt_en: promptEn.slice(0, 500),
        via_prompt: expansion.via || '',
        director: metaDirector,
      });
    }

    // Fallback rápido: still + Ken Burns en el navegador.
    const cine = await generarImagenEstudio(promptEn, {
      width: 1920,
      height: 1080,
      seed: seedDesdePrompt(`clip:${prompt}`),
      original: prompt,
    });
    if (!cine) {
      return jsonResponse({
        error: 'No se pudo generar el clip a tiempo. Intenta de nuevo; si tarda, usa Imagen IA + Movimiento.',
      }, 502);
    }

    return jsonResponse({
      success: true,
      tipo: 'cinematico',
      imagen_base64: cine.imagen_base64,
      mime: cine.mime,
      duracionSeg: duracion,
      fuente: cine.fuente,
      marca_agua_pollinations: !!cine.marca_agua_pollinations,
      movimiento: true,
      resumen: expansion.resumen || '',
      prompt_en: promptEn.slice(0, 500),
      via_prompt: expansion.via || '',
      director: metaDirector,
      aviso: `Clip de ${duracion} s (placa + Ken Burns): no es una imagen fija de la pestaña Imagen; el navegador graba el movimiento.`,
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/abort|timeout|inactivity/i.test(msg)) {
      return jsonResponse({
        error: 'El clip tardó demasiado. Intenta de nuevo; suele completar con placa + movimiento.',
      }, 504);
    }
    return jsonResponse({ error: msg }, 500);
  }
};
