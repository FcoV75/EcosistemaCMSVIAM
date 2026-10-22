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

/**
 * CRÍTICO: respuestas NDJSON = Function streaming en Netlify → tope duro ~60s
 * (aunque netlify.toml diga timeout=120). Soft/force DEBEN quedar bajo 55s
 * o el kill cierra el stream sin `result` → "respuesta incompleta" en el cliente.
 */
export const BUDGET_CLIP_MS = 54000;
/** Dejar de lanzar proveedores; devolver placa/video antes del kill streaming. */
export const SOFT_DEADLINE_MS = 48000;
/** Forzar write(result) si el trabajo sigue colgado (antes del kill ~60s). */
export const FORCE_FLUSH_MS = 52000;

function tiempoRestante(inicio, budget = BUDGET_CLIP_MS) {
  return Math.max(0, budget - (Date.now() - inicio));
}

function pasadoSoftDeadline(inicio) {
  return Date.now() - inicio >= SOFT_DEADLINE_MS;
}

/** Tiempo útil hasta soft deadline (nunca arrancar un wait que mate el NDJSON). */
export function tiempoHastaSoft(inicio) {
  return Math.max(0, SOFT_DEADLINE_MS - (Date.now() - inicio));
}

/**
 * Duración pedida por el usuario → valor aceptado por cada proveedor.
 * Gemini Omni 3–10 s; Fal/LTX 6|8|10; Vidu hasta 16. Premium pide 8/10/12.
 */
export function duracionClipParaProveedor(paso, segundos, maxWaitMs = 60000) {
  const pedida = Math.max(5, Math.round(Number(segundos) || 8));
  if (paso === 'veo-t2v') {
    return Math.max(3, Math.min(10, pedida));
  }
  if (paso === 'vidu-i2v' || paso === 'vidu-t2v') {
    return Math.max(5, Math.min(16, pedida));
  }
  if (paso === 'fal-i2v' || paso === 'fal-t2v') {
    // LTX/Hailuo: preferir 6/8/10 (12 → 10). Con poco margen, 6.
    const snaps = [6, 8, 10];
    let best = snaps.reduce((a, b) => (Math.abs(b - pedida) < Math.abs(a - pedida) ? b : a));
    if (maxWaitMs < 20000 && best > 6) best = 6;
    if (maxWaitMs < 14000) best = 5;
    return best;
  }
  return Math.min(12, pedida);
}

/** Wait real de un paso: min(presupuesto ideal, soft restante − margen). */
export function waitPasoClip(paso, inicio, opts = {}) {
  const restBudget = tiempoRestante(inicio);
  const restSoft = Math.max(0, tiempoHastaSoft(inicio) - 4000);
  const ideal = presupuestoPasoClip(paso, restBudget, opts);
  if (!ideal) return 0;
  return Math.min(ideal, restSoft, restBudget);
}

function resumenProveedor(status, body) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body || {});
  return `HTTP ${status || '?'}: ${raw.replace(/\s+/g, ' ').slice(0, 220)}`;
}

/** Saldo/créditos agotados en cualquier proveedor de video. */
export function esErrorCreditoClip(err = '') {
  return /exhausted balance|creditinsufficient|top[_ ]?up|user is locked|credits?:?\s*0|insufficient credit|billing|saldo agotado/i
    .test(String(err || ''));
}

export function proveedorFalBloqueado(errores = []) {
  return errores.some((e) => /fal-(?:i2v|t2v)|fal:/i.test(String(e))
    && (esErrorCreditoClip(e) || /HTTP 403|forbidden/i.test(String(e))));
}

/** 401/403/créditos de Vidu: no reintentar el otro modo; el tiempo es para Veo/Fal. */
export function proveedorViduBloqueado(errores = []) {
  return errores.some((e) => /vidu(?:-i2v|-t2v)?/i.test(String(e))
    && (esErrorCreditoClip(e) || /HTTP 401|HTTP 403|invalid api key|unauthorized|forbidden/i.test(String(e))));
}

/** Motivo corto para UI (sin dumps JSON de Fal/Vidu). */
export function resumenMotivoClip(errores = [], { sinClaves = false } = {}) {
  if (sinClaves) return 'sin_claves_video';
  const lista = (Array.isArray(errores) ? errores : [errores]).map((e) => String(e || ''));
  const falCredito = lista.some((e) => /fal/i.test(e) && esErrorCreditoClip(e));
  const viduCredito = lista.some((e) => /vidu/i.test(e) && esErrorCreditoClip(e));
  const veoFail = lista.some((e) => /veo|gemini-veo/i.test(e));
  if (falCredito && viduCredito) {
    return 'saldo_agotado_fal_y_vidu';
  }
  if (falCredito) return 'saldo_agotado_fal';
  if (viduCredito) return 'saldo_agotado_vidu';
  if (veoFail && (falCredito || viduCredito)) return 'saldo_agotado_y_veo_fallo';
  const joined = lista.filter(Boolean).join(' | ').slice(0, 280);
  return joined || 'timeout_proveedor_i2v';
}

export function avisoMotivoClip(motivo, duracion) {
  const m = String(motivo || '');
  if (m === 'saldo_agotado_fal_y_vidu') {
    return `Clip de ${duracion} s: Fal y Vidu sin crédito (saldo 0). Recarga en fal.ai/dashboard/billing y Vidu, o deja margen a Gemini. Se entregó la placa.`;
  }
  if (m === 'saldo_agotado_fal') {
    return `Clip de ${duracion} s: Fal sin crédito. Recarga en fal.ai o usa Vidu/Gemini. Se entregó la placa.`;
  }
  if (m === 'saldo_agotado_vidu') {
    return `Clip de ${duracion} s: Vidu sin crédito. Recarga Vidu o usa Fal/Gemini. Se entregó la placa.`;
  }
  if (m === 'sin_claves_video') {
    return `Clip de ${duracion} s: no hay claves de video (Gemini/Vidu/Fal). Se entregó la placa.`;
  }
  if (m === 'presupuesto_corto' || m === 'presupuesto_corto_i2v') {
    return `Clip de ${duracion} s: presupuesto corto para video nativo. Reintenta. Se entregó la placa.`;
  }
  return `Clip de ${duracion} s: se entregó placa (sin video nativo: ${m.slice(0, 180)}).`;
}

export function clavesVideoClip() {
  return {
    veo: !!(process.env.GEMINI_API_KEY || '').trim(),
    vidu: !!(process.env.VIDU_API_KEY || process.env.VIDU_KEY || '').trim(),
    fal: !!(process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim(),
  };
}

/**
 * Orden de video nativo: Gemini Omni primero, luego Vidu I2V, Vidu T2V y Fal al final.
 * La placa se arma después de Gemini y antes de Vidu I2V (hace falta para imagen→video).
 * Kling no tiene cliente propio: solo como modelo `fal-ai/kling-video`, dentro de Fal.
 */
export function planIntentosClip({
  tieneVeo = false,
  tieneVidu = false,
  tieneFal = false,
  /** Omni llega a 10 s. Un clip de 12 s lo resuelve Vidu; Gemini se omite. */
  omitVeo = false,
} = {}) {
  const pasos = [];
  if (tieneVeo && !omitVeo) pasos.push('veo-t2v');
  if (tieneVidu) pasos.push('vidu-i2v', 'vidu-t2v');
  if (tieneFal) pasos.push('fal-i2v', 'fal-t2v');
  return pasos;
}

/**
 * Milisegundos para un paso. 0 = saltar sin llamar a la red.
 * Si Vidu también está configurado, Veo no se queda con los ~80 s: deja margen para la placa y el I2V.
 * Fal no reserva tiempo; solo corre si los anteriores devolvieron antes el fallo.
 */
export function presupuestoPasoClip(paso, restanteMs, {
  pescaEpica = false,
  reservarVidu = false,
  reintentoPlaca = false,
} = {}) {
  const restante = Math.max(0, Number(restanteMs) || 0);
  if (paso === 'veo-t2v') {
    // Veo casi nunca termina dentro del tope streaming 60s: tope bajo.
    if (reintentoPlaca) {
      const libre = restante - 5000;
      if (libre < 9000) return 0;
      return Math.min(16000, libre);
    }
    const reserva = reservarVidu ? 18000 : 0;
    const tope = reservarVidu ? 18000 : 28000;
    const libre = restante - 5000 - reserva;
    if (libre < 9000) return 0;
    return Math.min(tope, libre);
  }
  if (paso === 'fal-i2v') {
    // LTX fast: principal camino fiable bajo 60s.
    const tope = pescaEpica ? 32000 : 30000;
    const libre = restante - 5000;
    if (libre < 8000) return 0;
    return Math.min(tope, libre);
  }
  if (paso === 'vidu-i2v') {
    const tope = pescaEpica ? 24000 : 20000;
    const libre = restante - 5000;
    if (libre < 8000) return 0;
    return Math.min(tope, libre);
  }
  if (paso === 'vidu-t2v') {
    if (restante < 12000) return 0;
    return Math.min(12000, Math.max(8000, restante - 5000));
  }
  if (paso === 'fal-t2v') {
    if (restante < 14000) return 0;
    return Math.min(14000, Math.max(8000, restante - 5000));
  }
  return 0;
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

/**
 * Image-to-video vía Fal (LTX / Hailuo / Kling). Solo se llama como último recurso,
 * cuando Veo y Vidu no están configurados o ya fallaron. Un 403 de saldo vuelve
 * `{ error }` y no lanza: el clip sigue y entrega la placa.
 * Con poco tiempo restante, LTX va primero dentro de Fal porque suele completar antes.
 */
async function generarClipFalI2V(imagen, motionPrompt, segundos, maxWaitMs = 22000) {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim();
  if (!key || maxWaitMs < 5000) return null;
  const imageUrl = dataUriDesdeImagen(imagen);
  if (!imageUrl) return null;

  // Bajo tope streaming 60s: siempre LTX primero (Hailuo/Kling suelen pasarse de 60s).
  const modelos = [
    process.env.FAL_I2V_MODEL,
    'fal-ai/ltx-video/image-to-video',
    'fal-ai/minimax/hailuo-02/standard/image-to-video',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const headers = {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
  const dur = duracionClipParaProveedor('fal-i2v', segundos, maxWaitMs);
  const tStart = Date.now();
  // Un solo modelo con TODO el presupuesto (partir a la mitad mataba I2V).
  // Preferir LTX 2.3 fast cuando existe (completa dentro del soft deadline).
  const model = modelos.find((m) => /ltx-2\.3.*fast|ltx-video/i.test(m)) || modelos[0];
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
  const dur = duracionClipParaProveedor('vidu-i2v', segundos, maxWaitMs);
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
  const dur = duracionClipParaProveedor('vidu-t2v', segundos, maxWaitMs);
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
  const dur = duracionClipParaProveedor('fal-t2v', segundos, maxWaitMs);
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
          duration: dur,
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

/** Preview Veo y Omni preview: apagados el 22 oct 2026. No gastar el presupuesto en ellos. */
const MODELOS_VIDEO_GEMINI_APAGADOS = new Set([
  'veo-2.0-generate-001',
  'veo-3.0-generate-001',
  'veo-3.0-fast-generate-001',
  'veo-3.0-generate-preview',
  'veo-3.0-fast-generate-preview',
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.1-lite-generate-preview',
  'gemini-omni-flash-preview',
]);

export const MODELO_VIDEO_GEMINI = 'gemini-omni-1.1-flash';

function modelosVideoGemini() {
  return [
    process.env.GEMINI_VIDEO_MODEL,
    process.env.GEMINI_VEO_MODEL,
    MODELO_VIDEO_GEMINI,
  ].filter((m, i, arr) => m && !MODELOS_VIDEO_GEMINI_APAGADOS.has(m) && arr.indexOf(m) === i);
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

function partesVideoInteraccion(data) {
  const found = [];
  const push = (part) => {
    if (!part || typeof part !== 'object') return;
    const type = String(part.type || '');
    const mime = String(part.mime_type || part.mimeType || '');
    if (type !== 'video' && !mime.startsWith('video/')) return;
    found.push(part);
  };
  if (data?.output_video && typeof data.output_video === 'object') {
    push({ type: 'video', ...data.output_video });
  }
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (const step of steps) {
    const content = step?.content;
    const list = Array.isArray(content) ? content : (content ? [content] : []);
    for (const part of list) push(part);
  }
  return found;
}

function videoInlineDeParte(part) {
  const raw = part?.data || part?.bytesBase64Encoded || part?.bytesBase64encoded || '';
  if (typeof raw !== 'string' || raw.length < 1000) return null;
  return {
    video_base64: raw,
    mime: part.mime_type || part.mimeType || 'video/mp4',
  };
}

async function esperarInteraccionGemini(data, apiKey, timeoutMs) {
  let current = data;
  const inicio = Date.now();
  const terminal = new Set(['completed', 'failed', 'cancelled', 'error']);
  while (current && current.status && !terminal.has(String(current.status).toLowerCase())) {
    const left = timeoutMs - (Date.now() - inicio);
    if (left < 1500 || !current.id) break;
    await new Promise((ok) => setTimeout(ok, 1500));
    const st = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(current.id)}?key=${apiKey}`,
      { signal: AbortSignal.timeout(Math.min(9000, left)) },
    );
    const next = await st.json().catch(() => ({}));
    if (!st.ok) throw new Error(`gemini-veo poll ${resumenProveedor(st.status, next)}`);
    current = next;
  }
  return current;
}

/**
 * Video Gemini vía Interactions API (`gemini-omni-1.1-flash`).
 * REST: POST /v1beta/interactions. El video viene en steps[].content[] (type video)
 * como base64 `data` o como `uri` (delivery=uri; archivos >4MB).
 * Los modelos Veo preview se apagaron el 22 oct 2026.
 */
export async function generarClipGeminiVeoT2V(promptEn, segundos, maxWaitMs = 68000) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || maxWaitMs < 9000) return null;
  const dur = duracionClipParaProveedor('veo-t2v', segundos, maxWaitMs);
  const prompt = String(promptEn || '').slice(0, 1800);
  if (!prompt) return null;

  const tStart = Date.now();
  let ultimoError = null;
  for (const model of modelosVideoGemini()) {
    const left = maxWaitMs - (Date.now() - tStart);
    if (left < 9000) break;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          input: `${prompt}. Duration: ${dur} seconds. Real subject motion, continuous cinematic 16:9 video, not a still image, no slideshow, no text, no watermark.`,
          response_format: {
            type: 'video',
            aspect_ratio: '16:9',
            resolution: '720p',
            delivery: 'uri',
          },
          generation_config: {
            video_config: { task: 'text_to_video' },
          },
          background: false,
          store: false,
          stream: false,
        }),
        signal: AbortSignal.timeout(Math.min(left - 1000, Math.max(8000, left))),
      });
      const queued = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Gemini video:', model, r.status, JSON.stringify(queued).slice(0, 220));
        ultimoError = { error: `gemini-veo:${model} ${resumenProveedor(r.status, queued)}` };
        continue;
      }
      const waitLeft = Math.max(6000, maxWaitMs - (Date.now() - tStart));
      const done = await esperarInteraccionGemini(queued, apiKey, waitLeft);
      const estado = String(done?.status || '').toLowerCase();
      if (done?.error || estado === 'failed' || estado === 'error') {
        ultimoError = { error: `gemini-veo:${model} ${JSON.stringify(done?.error || done?.status).slice(0, 220)}` };
        continue;
      }
      if (estado && estado !== 'completed' && !partesVideoInteraccion(done).length) {
        ultimoError = { error: `gemini-veo:${model} timeout_operacion` };
        continue;
      }
      const partes = partesVideoInteraccion(done);
      for (const part of partes) {
        const inline = videoInlineDeParte(part);
        if (inline) {
          return {
            ...inline,
            fuente: `gemini-veo:${model}`,
            actuacion: true,
          };
        }
      }
      const conUri = partes.find((part) => part.uri || part.url) || buscarVideoGemini(done);
      const uri = conUri?.uri || conUri?.url;
      if (uri) {
        const descargado = await descargarVideoGemini(
          uri,
          apiKey,
          Math.min(20000, Math.max(6000, maxWaitMs - (Date.now() - tStart))),
        );
        if (descargado?.video_base64) {
          return {
            video_base64: descargado.video_base64,
            mime: descargado.mime || conUri.mime || conUri.mime_type || 'video/mp4',
            fuente: `gemini-veo:${model}`,
            actuacion: true,
          };
        }
        if (descargado?.error) {
          ultimoError = { error: `gemini-veo:${model} ${descargado.error}` };
          continue;
        }
      }
      const legacy = buscarVideoGemini(done);
      if (legacy?.video_base64) {
        return {
          video_base64: legacy.video_base64,
          mime: legacy.mime || 'video/mp4',
          fuente: `gemini-veo:${model}`,
          actuacion: true,
        };
      }
      ultimoError = { error: `gemini-veo:${model} respuesta sin video utilizable` };
    } catch (err) {
      console.warn('Gemini video:', model, err?.name || err?.message || err);
      ultimoError = { error: `gemini-veo:${model} ${err?.message || err?.name || err}` };
    }
  }
  return ultimoError;
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
      let cerrado = false;
      const write = (obj) => {
        if (cerrado) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          cerrado = true;
        }
      };
      const ping = setInterval(() => {
        write({ type: 'ping', t: Date.now() });
      }, 3500);
      // Streaming Netlify ~60s: forzar result ~52s si el trabajo sigue colgado.
      let forceTimer = null;
      const forceResult = new Promise((resolve) => {
        forceTimer = setTimeout(() => {
          resolve({
            success: false,
            error: 'El clip se cortó a mitad (timeout de presupuesto). Reintenta; suele completar al segundo intento.',
            registro: [{ t_ms: FORCE_FLUSH_MS, paso: 'force_flush', ok: false }],
          });
        }, FORCE_FLUSH_MS);
      });
      try {
        write({ type: 'status', msg: 'Director y placa en marcha…' });
        const result = await Promise.race([
          Promise.resolve().then(() => trabajoAsync(write)),
          forceResult,
        ]);
        write({ type: 'result', ...result });
      } catch (err) {
        write({
          type: 'result',
          success: false,
          error: String(err?.message || err),
        });
      } finally {
        if (forceTimer) clearTimeout(forceTimer);
        clearInterval(ping);
        cerrado = true;
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
    const registro = [];
    const mark = (paso, ok, extra = '') => {
      const row = { t_ms: Date.now() - inicio, paso, ok: !!ok };
      if (extra) row.extra = String(extra).slice(0, 120);
      registro.push(row);
      console.log(`[estudio-clip] t=${row.t_ms}ms ${paso} ok=${row.ok}${extra ? ` ${extra}` : ''}`);
      write({ type: 'status', msg: `${paso}… (${Math.round(row.t_ms / 1000)} s)`, registro: row });
    };

    write({ type: 'status', msg: `Creando clip de ${duracion} s (actuación del sujeto)…` });
    const expansion = await expandirPromptVisual(prompt, { modo: 'clip' });
    mark('director', true, expansion.via || '');
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
      registro,
      soft_ms: SOFT_DEADLINE_MS,
      budget_ms: BUDGET_CLIP_MS,
    };

    let nativo = null;
    let motivoFallback = '';
    const erroresProveedor = [];
    const claves = clavesVideoClip();
    const conPlacaCliente = placaIn.length > 80;
    // Omni llega a 10 s. 12 s lo hace Vidu; no recortar ese pedido a un clip más corto.
    const omitVeo = duracion > 10;
    const pasos = planIntentosClip({
      tieneVeo: claves.veo,
      tieneVidu: claves.vidu,
      tieneFal: claves.fal,
      omitVeo,
    });
    let proveedoresIntentados = false;

    const tomarVideo = (resultado) => {
      if (resultado?.video_url || resultado?.video_base64) {
        nativo = resultado;
        return true;
      }
      if (resultado?.error) erroresProveedor.push(resultado.error);
      return false;
    };

    const entregarVideo = () => {
      write({ type: 'status', msg: 'Entregando microfilme nativo…' });
      mark('entregado_video', true, nativo.fuente || '');
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
    };

    // Gemini primero (no necesita placa). La placa va después, antes de Vidu I2V.
    let cine = null;
    const msgPaso = {
      'veo-t2v': 'Filmando video nativo Gemini…',
      'vidu-i2v': pescaEpica ? 'Filmando la lucha con Vidu (I2V)…' : 'Filmando actuación con Vidu (I2V)…',
      'vidu-t2v': 'Filmando video nativo Vidu…',
      'fal-i2v': 'Filmando clip con Fal LTX (I2V)…',
      'fal-t2v': 'Filmando video nativo Fal…',
    };
    const ejecutarPaso = async (paso) => {
      if (nativo?.video_url || nativo?.video_base64) return;
      if (pasadoSoftDeadline(inicio)) return;
      if (paso.startsWith('vidu') && proveedorViduBloqueado(erroresProveedor)) return;
      if (paso.startsWith('fal') && proveedorFalBloqueado(erroresProveedor)) return;
      if (paso.endsWith('-i2v') && !cine?.imagen_base64) return;
      const wait = waitPasoClip(paso, inicio, {
        pescaEpica,
        reservarVidu: paso === 'veo-t2v' && (claves.vidu || claves.fal || !conPlacaCliente),
        reintentoPlaca: paso === 'veo-t2v' && conPlacaCliente,
      });
      if (!wait || wait < 5000) {
        mark(paso, false, 'skip_wait');
        return;
      }
      write({ type: 'status', msg: msgPaso[paso] || 'Filmando video nativo…' });
      proveedoresIntentados = true;
      const tPaso = Date.now();
      try {
        let resultado = null;
        if (paso === 'veo-t2v') {
          resultado = await generarClipGeminiVeoT2V(motionPrompt || promptEn, duracion, wait);
        } else if (paso === 'vidu-i2v') {
          resultado = await generarClipViduI2V(cine, motionPrompt, duracion, wait);
        } else if (paso === 'vidu-t2v') {
          resultado = await generarClipViduT2V(motionPrompt || promptEn, duracion, wait);
        } else if (paso === 'fal-i2v') {
          resultado = await generarClipFalI2V(cine, motionPrompt, duracion, wait);
        } else if (paso === 'fal-t2v') {
          resultado = await generarClipFalT2V(motionPrompt || promptEn, duracion, wait);
        }
        const ok = tomarVideo(resultado);
        mark(paso, ok, ok ? (resultado?.fuente || 'ok') : (resultado?.error || `wait=${wait}`));
        console.log(`[estudio-clip] ${paso} dur_paso=${Date.now() - tPaso}ms wait=${wait}`);
      } catch (err) {
        console.warn('Proveedor clip', paso, err?.message || err);
        erroresProveedor.push(`${paso} ${err?.message || err}`);
        mark(paso, false, err?.message || err);
      }
    };

    if (pasos.includes('veo-t2v')) {
      await ejecutarPaso('veo-t2v');
      if (nativo?.video_url || nativo?.video_base64) return entregarVideo();
    }

    // Placa después de Gemini: Vidu/Fal I2V la necesitan; el fallback también.
    if (placaIn.length > 80) {
      write({ type: 'status', msg: 'Usando placa anterior; filmando I2V…' });
      cine = {
        imagen_base64: placaIn.replace(/^data:[^;]+;base64,/, ''),
        mime: String(body.mime || 'image/jpeg').split(';')[0] || 'image/jpeg',
        fuente: 'placa_reintento',
        marca_agua_pollinations: false,
      };
      mark('placa', true, 'reintento');
    } else {
      write({ type: 'status', msg: 'Generando placa (obediente al prompt)…' });
      // Placa: preferir obediencia (Gemini corto). Fal imagen puede estar sin saldo
      // igual que I2V → Pollinations genérico (sala vacía sin la charola de pan).
      cine = await generarImagenEstudio(promptEn, {
        width: 1280,
        height: 720,
        seed: seedDesdePrompt(`clip:${prompt}`),
        original: prompt,
        prioridad: 'rapido',
        preferirObediencia: true,
        timeoutMs: 14000,
      });
      mark('placa', !!cine?.imagen_base64, cine?.fuente || 'fail');
    }
    if (!cine?.imagen_base64) {
      return { success: false, error: 'No se pudo generar la placa del clip. Intenta de nuevo.', registro };
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
      errores_proveedor: erroresProveedor.slice(0, 6),
      ...metaBase,
      aviso: `${avisoMotivoClip(motivo, duracion)}${avisoExtra}`,
    });

    if (pasadoSoftDeadline(inicio) || tiempoRestante(inicio) < 10000) {
      write({ type: 'status', msg: 'Entregando placa (presupuesto corto)…' });
      mark('fallback_placa', true, 'presupuesto_corto');
      return respuestaPlaca('presupuesto_corto', ' Reintenta: el microfilme nativo necesita margen I2V.');
    }

    // Vidu I2V, Vidu T2V y Fal al final. Gemini ya corrió.
    for (const paso of pasos) {
      if (paso === 'veo-t2v') continue;
      await ejecutarPaso(paso);
    }

    if (nativo?.video_url || nativo?.video_base64) return entregarVideo();

    if (!motivoFallback) {
      if (!claves.veo && !claves.vidu && !claves.fal) motivoFallback = 'sin_claves_video';
      else if (!proveedoresIntentados && !erroresProveedor.length) motivoFallback = 'presupuesto_corto_i2v';
      else {
        motivoFallback = resumenMotivoClip(erroresProveedor, {
          sinClaves: !claves.veo && !claves.vidu && !claves.fal,
        });
      }
    }

    // Diapositivas SOLO para pantera/pesca cuando queda mucho margen.
    // Escenas normales (cóctel, etc.): placa limpia — el morph parece slideshow, no película.
    let secuencia = [];
    // Bajo tope streaming 60s: slideshow solo si aún queda margen real.
    const puedeSlideshowEspecial = (esEscenaPanteraMono(prompt) || pescaEpica)
      && !pasadoSoftDeadline(inicio)
      && tiempoRestante(inicio) > 18000;

    if (puedeSlideshowEspecial) {
      if (esEscenaPanteraMono(prompt)) {
        write({ type: 'status', msg: 'Filmando aproximación pantera→mono (composición)…' });
        try {
          const comp = await generarSecuenciaPanteraMono(prompt, {
            timeoutMs: Math.min(16000, tiempoRestante(inicio) - 6000),
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
      ' El microfilme real requiere Gemini/Vidu/Fal; sin él no inventamos diapositivas.',
    );
  });
};
