import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { clamp, limitesClipPara } from './lib/estudio-limites.mjs';
import {
  expandirPromptVisual,
  promptMotionParaVideo,
  escenaPideActuacion,
  seedDesdePrompt,
} from './lib/estudio-prompt-visual.mjs';
import { generarImagenEstudio } from './lib/estudio-imagen-gen.mjs';

/** Usar casi todo el timeout Netlify (90s); dejar margen. */
const BUDGET_CLIP_MS = 78000;

function tiempoRestante(inicio, budget = BUDGET_CLIP_MS) {
  return Math.max(0, budget - (Date.now() - inicio));
}

function dataUriDesdeImagen(imagen) {
  if (!imagen?.imagen_base64) return '';
  const mime = String(imagen.mime || 'image/jpeg').split(';')[0] || 'image/jpeg';
  return `data:${mime};base64,${imagen.imagen_base64}`;
}

async function esperarFal(statusUrl, responseUrl, headers, timeoutMs = 20000) {
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

/** Image-to-video: anima la placa (bailes/actuación). */
async function generarClipFalI2V(imagen, motionPrompt, segundos, maxWaitMs = 22000) {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
  if (!key || maxWaitMs < 5000) return null;
  const imageUrl = dataUriDesdeImagen(imagen);
  if (!imageUrl) return null;

  const modelos = [
    process.env.FAL_I2V_MODEL,
    'fal-ai/kling-video/v2.1/standard/image-to-video',
    'fal-ai/minimax/hailuo-02/standard/image-to-video',
    'fal-ai/ltx-video/image-to-video',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
  const dur = Math.max(5, Math.min(10, Math.round(Number(segundos) || 8)));

  for (const model of modelos.slice(0, 1)) {
    try {
      const r = await fetch(`https://queue.fal.run/${model}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: String(motionPrompt || '').slice(0, 1800),
          image_url: imageUrl,
          duration: String(dur),
          aspect_ratio: '16:9',
          negative_prompt:
            'static pose, frozen mannequin, no motion, still photograph only, text, watermark, nude, nsfw, deformed face, extra fingers',
        }),
      });
      const queued = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Fal I2V queue:', model, r.status, JSON.stringify(queued).slice(0, 180));
        continue;
      }
      const statusUrl = queued.status_url;
      const responseUrl = queued.response_url;
      if (!statusUrl || !responseUrl) continue;
      const result = await esperarFal(statusUrl, responseUrl, headers, maxWaitMs);
      const videoUrl = result?.video?.url || result?.video_url || result?.output?.url;
      if (videoUrl) {
        return { video_url: videoUrl, fuente: `fal-i2v:${model}`, mime: 'video/mp4', actuacion: true };
      }
    } catch (err) {
      console.warn('Fal I2V:', model, err?.message || err);
    }
  }
  return null;
}

async function generarClipViduI2V(imagen, motionPrompt, segundos, maxWaitMs = 20000) {
  const key = (process.env.VIDU_API_KEY || process.env.VIDU_KEY || '').trim();
  if (!key || maxWaitMs < 5000) return null;
  const imageUrl = dataUriDesdeImagen(imagen);
  if (!imageUrl) return null;
  const model = process.env.VIDU_I2V_MODEL || 'viduq2-pro';
  const dur = Math.max(5, Math.min(16, Math.round(Number(segundos) || 8)));
  const headers = {
    Authorization: `Token ${key}`,
    'Content-Type': 'application/json',
  };
  try {
    const r = await fetch('https://api.vidu.com/ent/v2/img2video', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        images: [imageUrl],
        prompt: String(motionPrompt || '').slice(0, 2000),
        duration: dur,
        resolution: '720p',
        movement_amplitude: 'auto',
      }),
    });
    const queued = await r.json().catch(() => ({}));
    const taskId = queued.task_id || queued.id;
    if (!r.ok || !taskId) {
      console.warn('Vidu I2V:', r.status, queued);
      return null;
    }
    const inicio = Date.now();
    while (Date.now() - inicio < maxWaitMs) {
      const st = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, {
        headers: { Authorization: `Token ${key}` },
      });
      const data = await st.json().catch(() => ({}));
      const status = String(data.state || data.status || '').toLowerCase();
      if (status === 'success' || status === 'completed') {
        const url = data.creations?.[0]?.url
          || data.creations?.[0]?.video_url
          || data.video?.url
          || data.url;
        if (url) return { video_url: url, fuente: 'vidu-i2v', mime: 'video/mp4', actuacion: true };
      }
      if (status === 'failed' || status === 'error') {
        console.warn('Vidu I2V tarea:', data);
        return null;
      }
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  } catch (err) {
    console.warn('Vidu I2V:', err?.message || err);
  }
  return null;
}

async function generarClipViduT2V(promptEn, segundos, maxWaitMs = 16000) {
  const key = (process.env.VIDU_API_KEY || process.env.VIDU_KEY || '').trim();
  if (!key || maxWaitMs < 5000) return null;
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
      movement_amplitude: 'large',
    }),
  });
  const queued = await r.json().catch(() => ({}));
  const taskId = queued.task_id || queued.id;
  if (!r.ok || !taskId) {
    console.warn('Vidu T2V:', r.status, queued);
    return null;
  }
  const inicio = Date.now();
  while (Date.now() - inicio < maxWaitMs) {
    const st = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, {
      headers: { Authorization: `Token ${key}` },
    });
    const data = await st.json().catch(() => ({}));
    const status = String(data.state || data.status || '').toLowerCase();
    if (status === 'success' || status === 'completed') {
      const url = data.creations?.[0]?.url
        || data.creations?.[0]?.video_url
        || data.video?.url
        || data.url;
      if (url) return { video_url: url, fuente: 'vidu', mime: 'video/mp4', actuacion: true };
    }
    if (status === 'failed' || status === 'error') {
      console.warn('Vidu T2V tarea:', data);
      return null;
    }
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return null;
}

async function generarClipFalT2V(promptEn, segundos, maxWaitMs = 16000) {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
  if (!key || maxWaitMs < 5000) return null;
  const modelos = [
    process.env.FAL_VIDEO_MODEL,
    'fal-ai/kling-video/v2.1/standard/text-to-video',
    'fal-ai/ltx-video',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);
  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
  for (const model of modelos.slice(0, 1)) {
    const r = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        negative_prompt:
          'static pose, frozen, still photo, text, watermark, logo, nude, naked, nsfw, deformed face, asymmetric eyes, melted face, extra fingers, bad anatomy, missing subjects',
        prompt: `${promptEn}, subject body performance and continuous motion, photorealistic hyperrealistic 8k, SFW clothed, smooth dance/acting motion, 16:9, no text, no watermark`,
        duration: segundos,
        aspect_ratio: '16:9',
      }),
    });
    const queued = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.warn('Fal T2V queue:', model, r.status, queued);
      continue;
    }
    const statusUrl = queued.status_url;
    const responseUrl = queued.response_url;
    if (!statusUrl || !responseUrl) continue;
    const result = await esperarFal(statusUrl, responseUrl, headers, maxWaitMs);
    const videoUrl = result?.video?.url || result?.video_url || result?.output?.url;
    if (videoUrl) return { video_url: videoUrl, fuente: `fal:${model}`, mime: 'video/mp4', actuacion: true };
  }
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ecosistema-Token',
    'Cache-Control': 'no-cache, no-transform',
    'X-Content-Type-Options': 'nosniff',
  };
}

/** NDJSON con pings: Safari corta si no recibe bytes (~Inactivity Timeout). */
function ndjsonClipResponse(trabajoAsync) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      const ping = setInterval(() => {
        try {
          write({ type: 'ping', t: Date.now() });
        } catch {
          /* stream cerrado */
        }
      }, 3500);
      try {
        write({ type: 'status', msg: 'Director y placa en marcha…' });
        const result = await trabajoAsync(write);
        write({ type: 'result', ...result });
      } catch (err) {
        write({
          type: 'result',
          success: false,
          error: String(err?.message || err),
        });
      } finally {
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/x-ndjson; charset=utf-8',
    },
  });
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
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400);
  }

  return ndjsonClipResponse(async (write) => {
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return { success: false, error: 'Describe el clip que quieres generar.' };

    const lim = limitesClipPara(guard.payload);
    const duracion = clamp(body.duracionSeg ?? body.duracion ?? lim.minSeg, lim.minSeg, lim.maxSeg);
    const pideActuacion = escenaPideActuacion(prompt);

    write({ type: 'status', msg: `Creando clip de ${duracion} s (actuación del sujeto)…` });
    const expansion = await expandirPromptVisual(prompt, { modo: 'clip' });
    const promptEn = expansion.promptEn;
    const motionPrompt = promptMotionParaVideo(prompt, promptEn);
    const dir = expansion.director;
    const metaDirector = dir
      ? {
          intencion: dir.intencion,
          inferencias: dir.inferencias?.slice(0, 4) || [],
          resumen_es: dir.resumen_es,
          via: dir.via,
        }
      : null;

    write({ type: 'status', msg: 'Generando placa obediente…' });
    const cine = await generarImagenEstudio(promptEn, {
      width: 1920,
      height: 1080,
      seed: seedDesdePrompt(`clip:${prompt}`),
      original: prompt,
    });
    if (!cine?.imagen_base64) {
      return { success: false, error: 'No se pudo generar la placa del clip. Intenta de nuevo.' };
    }

    let nativo = null;
    let motivoFallback = '';

    // Un solo intento I2V fuerte (evitar encadenar timeouts).
    const waitI2V = Math.min(20000, tiempoRestante(inicio) - 8000);
    if (waitI2V >= 9000) {
      write({ type: 'status', msg: 'Animando actuación (I2V)…' });
      try {
        nativo = await generarClipFalI2V(cine, motionPrompt, duracion, waitI2V);
      } catch (err) {
        console.warn('Fal I2V clip:', err?.message || err);
      }
      if (!nativo && tiempoRestante(inicio) > 12000) {
        try {
          nativo = await generarClipViduI2V(
            cine,
            motionPrompt,
            duracion,
            Math.min(16000, tiempoRestante(inicio) - 5000),
          );
        } catch (err) {
          console.warn('Vidu I2V clip:', err?.message || err);
        }
      }
    } else {
      motivoFallback = 'presupuesto_corto_i2v';
    }

    // T2V solo si aún hay margen amplio.
    if (!nativo && tiempoRestante(inicio) > 16000) {
      write({ type: 'status', msg: 'Intentando video nativo T2V…' });
      try {
        nativo = await generarClipViduT2V(
          motionPrompt || promptEn,
          duracion,
          Math.min(14000, tiempoRestante(inicio) - 5000),
        );
      } catch (err) {
        console.warn('Vidu T2V clip:', err?.message || err);
      }
    }

    if (nativo?.video_url) {
      return {
        success: true,
        tipo: 'video',
        video_url: nativo.video_url,
        mime: nativo.mime,
        duracionSeg: duracion,
        fuente: nativo.fuente,
        actuacion: !!nativo.actuacion,
        resumen: expansion.resumen || '',
        prompt_en: promptEn.slice(0, 500),
        via_prompt: expansion.via || '',
        director: metaDirector,
        aviso: nativo.actuacion
          ? `Clip nativo con actuación/movimiento del sujeto (${nativo.fuente}).`
          : undefined,
      };
    }

    if (!motivoFallback) {
      const tieneFal = !!(process.env.FAL_KEY || process.env.FAL_API_KEY);
      const tieneVidu = !!(process.env.VIDU_API_KEY || process.env.VIDU_KEY);
      if (!tieneFal && !tieneVidu) motivoFallback = 'sin_claves_video';
      else motivoFallback = 'timeout_proveedor';
    }

    const avisoActuacion = pideActuacion
      ? ` Solo cámara sobre la placa — aún sin actuación nativa (fallback ${motivoFallback}). Reintenta; con Fal/Vidu I2V el sujeto sí debe moverse.`
      : ` Placa + Ken Burns (fallback ${motivoFallback}).`;

    write({ type: 'status', msg: 'Entregando placa (fallback cámara)…' });
    return {
      success: true,
      tipo: 'cinematico',
      imagen_base64: cine.imagen_base64,
      mime: cine.mime,
      duracionSeg: duracion,
      fuente: cine.fuente,
      marca_agua_pollinations: !!cine.marca_agua_pollinations,
      movimiento: true,
      actuacion: false,
      sin_actuacion: pideActuacion,
      motivo_fallback: motivoFallback,
      resumen: expansion.resumen || '',
      prompt_en: promptEn.slice(0, 500),
      via_prompt: expansion.via || '',
      director: metaDirector,
      aviso: `Clip de ${duracion} s (placa+cámara).${avisoActuacion}`,
    };
  });
};
