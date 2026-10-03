import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { clamp, limitesClipPara } from './lib/estudio-limites.mjs';
import {
  expandirPromptVisual,
  promptMotionParaVideo,
  escenaPideActuacion,
  escenaEsPescaEpica,
  seedDesdePrompt,
  beatsActuacionParaClip,
} from './lib/estudio-prompt-visual.mjs';
import { generarImagenEstudio } from './lib/estudio-imagen-gen.mjs';
import {
  esEscenaPanteraMono,
  generarSecuenciaPanteraMono,
} from './lib/estudio-secuencia-fauna.mjs';

/** Usar casi todo el timeout Netlify (90s); dejar margen para escribir result. */
const BUDGET_CLIP_MS = 86000;
/** Soft deadline alto: más segundos reales para I2V (antes 62s dejaba solo placa). */
const SOFT_DEADLINE_MS = 80000;

function tiempoRestante(inicio, budget = BUDGET_CLIP_MS) {
  return Math.max(0, budget - (Date.now() - inicio));
}

function pasadoSoftDeadline(inicio) {
  return Date.now() - inicio >= SOFT_DEADLINE_MS;
}

function resumenProveedor(status, body) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body || {});
  return `HTTP ${status || '?'}: ${raw.replace(/\s+/g, ' ').slice(0, 220)}`;
}

function proveedorFalBloqueado(errores = []) {
  return errores.some((e) => /fal-(?:i2v|t2v)|fal:/i.test(String(e))
    && /exhausted balance|top_up|user is locked|billing|saldo/i.test(String(e)));
}

function dataUriDesdeImagen(imagen) {
  if (!imagen?.imagen_base64) return '';
  const mime = String(imagen.mime || 'image/jpeg').split(';')[0] || 'image/jpeg';
  return `data:${mime};base64,${imagen.imagen_base64}`;
}

async function esperarFal(statusUrl, responseUrl, headers, timeoutMs = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const st = await fetch(statusUrl, {
      headers,
      signal: AbortSignal.timeout(Math.min(8000, timeoutMs)),
    });
    const data = await st.json().catch(() => ({}));
    const status = String(data.status || '').toUpperCase();
    if (status === 'COMPLETED') {
      const done = await fetch(responseUrl, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
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

  // Con presupuesto corto: LTX primero (más rápido). Con margen: Hailuo/Kling.
  const modelosRapidos = [
    process.env.FAL_I2V_MODEL,
    'fal-ai/ltx-video/image-to-video',
    'fal-ai/minimax/hailuo-02/standard/image-to-video',
  ];
  const modelosLargos = [
    process.env.FAL_I2V_MODEL,
    'fal-ai/minimax/hailuo-02/standard/image-to-video',
    'fal-ai/kling-video/v2.1/standard/image-to-video',
    'fal-ai/ltx-video/image-to-video',
  ];
  const modelos = (maxWaitMs < 28000 ? modelosRapidos : modelosLargos)
    .filter((m, i, arr) => m && arr.indexOf(m) === i);

  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
  // Duración más corta = más probabilidad de completar a tiempo.
  const dur = maxWaitMs < 25000
    ? 5
    : Math.max(5, Math.min(10, Math.round(Number(segundos) || 8)));
  const tStart = Date.now();
  // Un solo modelo con TODO el presupuesto (partir a la mitad mataba I2V).
  const model = modelos[0];
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
          'static pose, frozen mannequin, no motion, still photograph only, Ken Burns zoom only, camera zoom without subject motion, aerial drone, mountain-sized kaiju shark, missing fishing rod, missing fisherman, text, watermark, nude, nsfw, deformed face, extra fingers',
      }),
      signal: AbortSignal.timeout(12000),
    });
    const queued = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.warn('Fal I2V queue:', model, r.status, JSON.stringify(queued).slice(0, 180));
      return { error: `fal-i2v:${model} ${resumenProveedor(r.status, queued)}` };
    }
    const statusUrl = queued.status_url;
    const responseUrl = queued.response_url;
    if (!statusUrl || !responseUrl) return { error: `fal-i2v:${model} sin status_url/response_url` };
    const waitLeft = Math.max(5000, maxWaitMs - (Date.now() - tStart));
    if (waitLeft < 5000) return null;
    const result = await esperarFal(statusUrl, responseUrl, headers, waitLeft);
    const videoUrl = result?.video?.url || result?.video_url || result?.output?.url;
    if (videoUrl) {
      return { video_url: videoUrl, fuente: `fal-i2v:${model}`, mime: 'video/mp4', actuacion: true };
    }
  } catch (err) {
    console.warn('Fal I2V:', model, err?.name || err?.message || err);
    return { error: `fal-i2v:${model} ${err?.message || err?.name || err}` };
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
  const tStart = Date.now();
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
      signal: AbortSignal.timeout(Math.min(12000, maxWaitMs)),
    });
    const queued = await r.json().catch(() => ({}));
    const taskId = queued.task_id || queued.id;
    if (!r.ok || !taskId) {
      console.warn('Vidu I2V:', r.status, queued);
      return { error: `vidu-i2v ${resumenProveedor(r.status, queued)}` };
    }
    while (Date.now() - tStart < maxWaitMs) {
      const left = maxWaitMs - (Date.now() - tStart);
      if (left < 2000) break;
      const st = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, {
        headers: { Authorization: `Token ${key}` },
        signal: AbortSignal.timeout(Math.min(8000, left)),
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
        return { error: `vidu-i2v tarea ${JSON.stringify(data).slice(0, 220)}` };
      }
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  } catch (err) {
    console.warn('Vidu I2V:', err?.name || err?.message || err);
    return { error: `vidu-i2v ${err?.message || err?.name || err}` };
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
  const tStart = Date.now();
  let r;
  try {
    r = await fetch('https://api.vidu.com/ent/v2/text2video', {
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
      signal: AbortSignal.timeout(Math.min(12000, maxWaitMs)),
    });
  } catch (err) {
    console.warn('Vidu T2V queue:', err?.name || err?.message || err);
    return null;
  }
  const queued = await r.json().catch(() => ({}));
  const taskId = queued.task_id || queued.id;
  if (!r.ok || !taskId) {
    console.warn('Vidu T2V:', r.status, queued);
    return { error: `vidu-t2v ${resumenProveedor(r.status, queued)}` };
  }
  while (Date.now() - tStart < maxWaitMs) {
    const left = maxWaitMs - (Date.now() - tStart);
    if (left < 2000) break;
    try {
      const st = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, {
        headers: { Authorization: `Token ${key}` },
        signal: AbortSignal.timeout(Math.min(8000, left)),
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
        return { error: `vidu-t2v tarea ${JSON.stringify(data).slice(0, 220)}` };
      }
    } catch (err) {
      console.warn('Vidu T2V poll:', err?.name || err?.message || err);
      return { error: `vidu-t2v poll ${err?.message || err?.name || err}` };
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
  const tStart = Date.now();
  for (const model of modelos.slice(0, 1)) {
    try {
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
        signal: AbortSignal.timeout(12000),
      });
      const queued = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Fal T2V queue:', model, r.status, queued);
        return { error: `fal-t2v:${model} ${resumenProveedor(r.status, queued)}` };
      }
      const statusUrl = queued.status_url;
      const responseUrl = queued.response_url;
      if (!statusUrl || !responseUrl) return { error: `fal-t2v:${model} sin status_url/response_url` };
      const waitLeft = Math.max(5000, maxWaitMs - (Date.now() - tStart));
      if (waitLeft < 5000) break;
      const result = await esperarFal(statusUrl, responseUrl, headers, waitLeft);
      const videoUrl = result?.video?.url || result?.video_url || result?.output?.url;
      if (videoUrl) return { video_url: videoUrl, fuente: `fal:${model}`, mime: 'video/mp4', actuacion: true };
    } catch (err) {
      console.warn('Fal T2V:', model, err?.name || err?.message || err);
      return { error: `fal-t2v:${model} ${err?.message || err?.name || err}` };
    }
  }
  return null;
}

function modelosVeo() {
  return [
    process.env.GEMINI_VEO_MODEL,
    'veo-3.1-fast-generate-preview',
    'veo-3.1-lite-generate-preview',
    'veo-3.1-generate-preview',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);
}

async function esperarGeminiOperacion(nombre, apiKey, timeoutMs = 25000) {
  const inicio = Date.now();
  const opName = String(nombre || '').replace(/^\/+/, '');
  if (!opName) return null;
  const opUrl = /^https?:\/\//i.test(opName)
    ? opName
    : `https://generativelanguage.googleapis.com/v1beta/${opName}`;
  while (Date.now() - inicio < timeoutMs) {
    const left = timeoutMs - (Date.now() - inicio);
    if (left < 1500) break;
    const sep = opUrl.includes('?') ? '&' : '?';
    const st = await fetch(`${opUrl}${sep}key=${apiKey}`, {
      signal: AbortSignal.timeout(Math.min(9000, left)),
    });
    const data = await st.json().catch(() => ({}));
    if (!st.ok) throw new Error(`gemini-veo poll ${resumenProveedor(st.status, data)}`);
    if (data.done) return data;
    await new Promise((ok) => setTimeout(ok, 1800));
  }
  return null;
}

function buscarVideoGemini(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.bytesBase64Encoded === 'string' && obj.bytesBase64Encoded.length > 1000) {
    return {
      video_base64: obj.bytesBase64Encoded,
      mime: obj.mimeType || obj.mime_type || 'video/mp4',
    };
  }
  if (typeof obj.bytesBase64encoded === 'string' && obj.bytesBase64encoded.length > 1000) {
    return {
      video_base64: obj.bytesBase64encoded,
      mime: obj.mimeType || obj.mime_type || 'video/mp4',
    };
  }
  if (typeof obj.uri === 'string' && obj.uri) {
    return { uri: obj.uri, mime: obj.mimeType || obj.mime_type || 'video/mp4' };
  }
  if (typeof obj.url === 'string' && obj.url) {
    return { uri: obj.url, mime: obj.mimeType || obj.mime_type || 'video/mp4' };
  }
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = buscarVideoGemini(item);
        if (found) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = buscarVideoGemini(value);
      if (found) return found;
    }
  }
  return null;
}

async function descargarVideoGemini(uri, apiKey, timeoutMs = 20000) {
  if (!/^https?:\/\//i.test(String(uri || ''))) return null;
  const headers = { 'x-goog-api-key': apiKey };
  const sep = uri.includes('?') ? '&' : '?';
  const candidatos = [
    uri,
    `${uri}${sep}key=${apiKey}`,
  ];
  for (const url of candidatos) {
    try {
      const r = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1000) continue;
      const maxBytes = Number(process.env.GEMINI_VEO_MAX_INLINE_BYTES || 8_000_000);
      if (buf.length > maxBytes) {
        return { error: `gemini-veo video ${buf.length} bytes supera inline ${maxBytes}` };
      }
      return {
        video_base64: buf.toString('base64'),
        mime: r.headers.get('content-type') || 'video/mp4',
      };
    } catch {
      // prueba el siguiente modo de descarga
    }
  }
  return { error: 'gemini-veo no pudo descargar el video generado' };
}

export async function generarClipGeminiVeoT2V(promptEn, segundos, maxWaitMs = 68000) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || maxWaitMs < 9000) return null;
  const requestedDur = Math.max(4, Math.min(8, Math.round(Number(segundos) || 8)));
  const dur = requestedDur <= 4 ? 4 : (requestedDur <= 6 ? 6 : 8);
  const prompt = String(promptEn || '').slice(0, 1800);
  if (!prompt) return null;

  const tStart = Date.now();
  for (const model of modelosVeo()) {
    const left = maxWaitMs - (Date.now() - tStart);
    if (left < 9000) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{
            prompt: `${prompt}. Real subject motion, continuous cinematic video, not a still image, no slideshow, no text, no watermark.`,
          }],
          parameters: {
            aspectRatio: '16:9',
            durationSeconds: dur,
          },
        }),
        signal: AbortSignal.timeout(Math.min(12000, left)),
      });
      const queued = await r.json().catch(() => ({}));
      if (!r.ok || !queued?.name) {
        console.warn('Gemini Veo queue:', model, r.status, JSON.stringify(queued).slice(0, 220));
        return { error: `gemini-veo:${model} ${resumenProveedor(r.status, queued)}` };
      }
      const waitLeft = Math.max(6000, maxWaitMs - (Date.now() - tStart));
      const done = await esperarGeminiOperacion(queued.name, apiKey, waitLeft);
      if (!done) return { error: `gemini-veo:${model} timeout_operacion` };
      if (done.error) {
        return { error: `gemini-veo:${model} ${JSON.stringify(done.error).slice(0, 220)}` };
      }
      const video = buscarVideoGemini(done.response || done);
      if (video?.video_base64) {
        return {
          video_base64: video.video_base64,
          mime: video.mime || 'video/mp4',
          fuente: `gemini-veo:${model}`,
          actuacion: true,
        };
      }
      if (video?.uri) {
        const descargado = await descargarVideoGemini(
          video.uri,
          apiKey,
          Math.min(20000, Math.max(6000, maxWaitMs - (Date.now() - tStart))),
        );
        if (descargado?.video_base64) {
          return {
            video_base64: descargado.video_base64,
            mime: descargado.mime || video.mime || 'video/mp4',
            fuente: `gemini-veo:${model}`,
            actuacion: true,
          };
        }
        if (descargado?.error) return { error: `gemini-veo:${model} ${descargado.error}` };
      }
      return { error: `gemini-veo:${model} respuesta sin video utilizable` };
    } catch (err) {
      console.warn('Gemini Veo:', model, err?.name || err?.message || err);
      return { error: `gemini-veo:${model} ${err?.message || err?.name || err}` };
    }
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
    const pescaEpica = escenaEsPescaEpica(prompt);

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
    const placaIn = String(body.imagen_base64 || body.placa_base64 || '').trim();

    const metaBase = {
      resumen: expansion.resumen || '',
      prompt_en: promptEn.slice(0, 500),
      via_prompt: expansion.via || '',
      director: metaDirector,
      duracionSeg: duracion,
    };

    let nativo = null;
    let motivoFallback = '';
    const erroresProveedor = [];

    // Veo es el proveedor nativo más confiable cuando FAL está bloqueado. Intentarlo
    // antes de generar placa deja más margen contra el timeout de Netlify.
    const puedeVeoPrimero = !placaIn && !!(process.env.GEMINI_API_KEY || '').trim();
    if (puedeVeoPrimero && !pasadoSoftDeadline(inicio) && tiempoRestante(inicio) > 28000) {
      write({ type: 'status', msg: 'Filmando video nativo Gemini Veo…' });
      try {
        const veoPrimero = await generarClipGeminiVeoT2V(
          motionPrompt || promptEn,
          duracion,
          Math.min(76000, tiempoRestante(inicio) - 7000),
        );
        if (veoPrimero?.video_url || veoPrimero?.video_base64) nativo = veoPrimero;
        else if (veoPrimero?.error) erroresProveedor.push(veoPrimero.error);
      } catch (err) {
        console.warn('Gemini Veo primero:', err?.message || err);
        erroresProveedor.push(`gemini-veo ${err?.message || err}`);
      }
    }

    if (nativo?.video_url || nativo?.video_base64) {
      write({ type: 'status', msg: 'Entregando microfilme nativo…' });
      return {
        success: true,
        tipo: 'video',
        video_url: nativo.video_url,
        video_base64: nativo.video_base64,
        mime: nativo.mime,
        fuente: nativo.fuente,
        actuacion: true,
        sin_actuacion: false,
        ...metaBase,
        aviso: `Clip nativo con movimiento continuo del sujeto (${nativo.fuente}).`,
      };
    }

    // Reintento: placa del cliente → todo el presupuesto a I2V.
    let cine = null;
    if (placaIn.length > 80) {
      write({ type: 'status', msg: 'Usando placa anterior; filmando I2V…' });
      cine = {
        imagen_base64: placaIn.replace(/^data:[^;]+;base64,/, ''),
        mime: String(body.mime || 'image/jpeg').split(';')[0] || 'image/jpeg',
        fuente: 'placa_reintento',
        marca_agua_pollinations: false,
      };
    } else {
      write({ type: 'status', msg: 'Generando placa rápida…' });
      // Placa RÁPIDA (Fal primero): Gemini imagen con 429 tumba el clip → "respuesta incompleta".
      cine = await generarImagenEstudio(promptEn, {
        width: 1280,
        height: 720,
        seed: seedDesdePrompt(`clip:${prompt}`),
        original: prompt,
        prioridad: 'rapido',
        timeoutMs: 18000,
      });
    }
    if (!cine?.imagen_base64) {
      return { success: false, error: 'No se pudo generar la placa del clip. Intenta de nuevo.' };
    }

    const respuestaPlaca = (motivo, avisoExtra = '') => ({
      success: true,
      tipo: 'cinematico',
      imagen_base64: cine.imagen_base64,
      mime: cine.mime,
      fuente: cine.fuente,
      marca_agua_pollinations: !!cine.marca_agua_pollinations,
      // Cliente NO debe aplicar Ken Burns / menú Movimiento sobre esta placa.
      movimiento: false,
      actuacion: false,
      sin_actuacion: !!pideActuacion,
      motivo_fallback: motivo,
      ...metaBase,
      aviso: `Clip de ${duracion} s: se entregó placa (sin video nativo: ${motivo}).${avisoExtra}`,
    });

    if (pasadoSoftDeadline(inicio) || tiempoRestante(inicio) < 12000) {
      write({ type: 'status', msg: 'Entregando placa (presupuesto corto)…' });
      return respuestaPlaca('presupuesto_corto', ' Reintenta: el microfilme nativo necesita margen I2V.');
    }

    // Microfilme: casi TODO el presupuesto restante a I2V (carrera Fal ∥ Vidu).
    const waitI2V = Math.min(
      pescaEpica ? 52000 : 48000,
      Math.max(0, tiempoRestante(inicio) - 6000),
    );
    if (waitI2V >= 9000) {
      write({ type: 'status', msg: pescaEpica ? 'Filmando la lucha (I2V nativo)…' : 'Filmando actuación (I2V nativo)…' });
      const waitVidu = Math.min(waitI2V, Math.max(9000, tiempoRestante(inicio) - 6000));
      try {
        const candidatos = await Promise.allSettled([
          generarClipFalI2V(cine, motionPrompt, duracion, waitI2V),
          generarClipViduI2V(cine, motionPrompt, duracion, waitVidu),
        ]);
        for (const c of candidatos) {
          if (c.status === 'fulfilled' && c.value?.video_url) {
            nativo = c.value;
            break;
          }
          if (c.status === 'fulfilled' && c.value?.error) {
            erroresProveedor.push(c.value.error);
          }
          if (c.status === 'rejected') {
            console.warn('I2V race:', c.reason?.message || c.reason);
            erroresProveedor.push(`i2v ${c.reason?.message || c.reason}`);
          }
        }
      } catch (err) {
        console.warn('I2V race clip:', err?.message || err);
      }
    } else {
      motivoFallback = 'presupuesto_corto_i2v';
    }

    // T2V nativo si I2V falló y aún hay margen (antes de cualquier slideshow).
    if (!nativo && !pasadoSoftDeadline(inicio) && tiempoRestante(inicio) > 16000) {
      write({ type: 'status', msg: 'Filmando video nativo T2V…' });
      if (!proveedorFalBloqueado(erroresProveedor)) {
        try {
          const falT2V = await generarClipFalT2V(
            motionPrompt || promptEn,
            duracion,
            Math.min(18000, tiempoRestante(inicio) - 6000),
          );
          if (falT2V?.video_url) nativo = falT2V;
          else if (falT2V?.error) erroresProveedor.push(falT2V.error);
        } catch (err) {
          console.warn('Fal T2V clip:', err?.message || err);
          erroresProveedor.push(`fal-t2v ${err?.message || err}`);
        }
      }
      if (!nativo && tiempoRestante(inicio) > 14000) {
        try {
          const viduT2V = await generarClipViduT2V(
            motionPrompt || promptEn,
            duracion,
            Math.min(14000, tiempoRestante(inicio) - 5000),
          );
          if (viduT2V?.video_url) nativo = viduT2V;
          else if (viduT2V?.error) erroresProveedor.push(viduT2V.error);
        } catch (err) {
          console.warn('Vidu T2V clip:', err?.message || err);
          erroresProveedor.push(`vidu-t2v ${err?.message || err}`);
        }
      }
      if (!nativo && tiempoRestante(inicio) > 16000) {
        write({ type: 'status', msg: 'Filmando video nativo Gemini Veo…' });
        try {
          const veoT2V = await generarClipGeminiVeoT2V(
            motionPrompt || promptEn,
            duracion,
            Math.min(68000, tiempoRestante(inicio) - 5000),
          );
          if (veoT2V?.video_url || veoT2V?.video_base64) nativo = veoT2V;
          else if (veoT2V?.error) erroresProveedor.push(veoT2V.error);
        } catch (err) {
          console.warn('Gemini Veo clip:', err?.message || err);
          erroresProveedor.push(`gemini-veo ${err?.message || err}`);
        }
      }
    }

    if (nativo?.video_url || nativo?.video_base64) {
      write({ type: 'status', msg: 'Entregando microfilme nativo…' });
      return {
        success: true,
        tipo: 'video',
        video_url: nativo.video_url,
        video_base64: nativo.video_base64,
        mime: nativo.mime,
        fuente: nativo.fuente,
        actuacion: true,
        sin_actuacion: false,
        ...metaBase,
        aviso: `Clip nativo con movimiento continuo del sujeto (${nativo.fuente}).`,
      };
    }

    if (!motivoFallback) {
      const tieneFal = !!(process.env.FAL_KEY || process.env.FAL_API_KEY);
      const tieneVidu = !!(process.env.VIDU_API_KEY || process.env.VIDU_KEY);
      const tieneVeo = !!(process.env.GEMINI_API_KEY || '').trim();
      if (!tieneFal && !tieneVidu && !tieneVeo) motivoFallback = 'sin_claves_video';
      else motivoFallback = erroresProveedor.length
        ? erroresProveedor.join(' | ').slice(0, 500)
        : 'timeout_proveedor_i2v';
    }

    // Diapositivas SOLO para pantera/pesca cuando queda mucho margen.
    // Escenas normales (cóctel, etc.): placa limpia — el morph parece slideshow, no película.
    let secuencia = [];
    const puedeSlideshowEspecial = (esEscenaPanteraMono(prompt) || pescaEpica)
      && !pasadoSoftDeadline(inicio)
      && tiempoRestante(inicio) > 28000;

    if (puedeSlideshowEspecial) {
      if (esEscenaPanteraMono(prompt)) {
        write({ type: 'status', msg: 'Filmando aproximación pantera→mono (composición)…' });
        try {
          const comp = await generarSecuenciaPanteraMono(prompt, {
            timeoutMs: Math.min(45000, tiempoRestante(inicio) - 8000),
          });
          if (comp?.secuencia?.length >= 2) {
            secuencia = comp.secuencia.map((f) => ({ ...f, fuente: comp.fuente }));
            motivoFallback = motivoFallback || 'composicion_fauna';
          }
        } catch (err) {
          console.warn('secuencia fauna:', err?.message || err);
        }
      }
      if (!secuencia.length && pescaEpica) {
        const beats = beatsActuacionParaClip(prompt).slice(0, 3);
        secuencia.push({
          imagen_base64: cine.imagen_base64,
          mime: cine.mime,
          fuente: cine.fuente,
          marca_agua_pollinations: !!cine.marca_agua_pollinations,
        });
        write({ type: 'status', msg: `Continuidad de pelea (${beats.length} beats)…` });
        for (let i = 0; i < beats.length; i += 1) {
          if (pasadoSoftDeadline(inicio) || tiempoRestante(inicio) < 10000) break;
          if (secuencia.length >= 4) break;
          try {
            const beatPrompt = `${prompt}. ${beats[i]}`;
            const extra = await generarImagenEstudio(`${promptEn}. ${beats[i]}`, {
              width: 1280,
              height: 720,
              seed: seedDesdePrompt(`clip-beat:${i}:${prompt}`),
              original: beatPrompt,
              prioridad: 'rapido',
            });
            if (extra?.imagen_base64) {
              secuencia.push({
                imagen_base64: extra.imagen_base64,
                mime: extra.mime,
                fuente: extra.fuente,
                marca_agua_pollinations: !!extra.marca_agua_pollinations,
              });
            }
          } catch (err) {
            console.warn('beat actuación', i, err?.message || err);
          }
        }
      }
    }

    const haySecuencia = secuencia.length >= 2;
    write({
      type: 'status',
      msg: haySecuencia ? 'Entregando secuencia de continuidad…' : 'Entregando placa (reintenta por microfilme nativo)…',
    });
    if (haySecuencia) {
      return {
        success: true,
        tipo: 'cinematico',
        imagen_base64: cine.imagen_base64,
        mime: cine.mime,
        secuencia: secuencia.map((f) => ({
          imagen_base64: f.imagen_base64,
          mime: f.mime || cine.mime,
          marca_agua_pollinations: !!f.marca_agua_pollinations || !!cine.marca_agua_pollinations,
        })),
        fuente: cine.fuente,
        marca_agua_pollinations: !!cine.marca_agua_pollinations,
        movimiento: true,
        actuacion: true,
        sin_actuacion: false,
        motivo_fallback: motivoFallback,
        ...metaBase,
        aviso: `Clip de ${duracion} s con continuidad (${secuencia.length} placas; I2V no respondió: ${motivoFallback}).`,
      };
    }
    return respuestaPlaca(
      motivoFallback,
      ' El microfilme real requiere Fal/Vidu/Gemini Veo; sin él no inventamos diapositivas.',
    );
  });
};
