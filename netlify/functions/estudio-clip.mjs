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

    // Reintento: placa del cliente → todo el presupuesto a I2V.
    let cine = null;
    const placaIn = String(body.imagen_base64 || body.placa_base64 || '').trim();
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

    const metaBase = {
      resumen: expansion.resumen || '',
      prompt_en: promptEn.slice(0, 500),
      via_prompt: expansion.via || '',
      director: metaDirector,
      duracionSeg: duracion,
    };

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

    let nativo = null;
    let motivoFallback = '';
    const erroresProveedor = [];

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
    }

    if (nativo?.video_url) {
      write({ type: 'status', msg: 'Entregando microfilme nativo…' });
      return {
        success: true,
        tipo: 'video',
        video_url: nativo.video_url,
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
      if (!tieneFal && !tieneVidu) motivoFallback = 'sin_claves_video';
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
      ' El microfilme real requiere Fal/Vidu I2V; sin él no inventamos diapositivas.',
    );
  });
};
