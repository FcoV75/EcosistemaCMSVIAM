import assert from 'node:assert/strict';

const envSnap = { ...process.env };
delete process.env.ECOSISTEMA_SESSION_SECRET;
delete process.env.RAILWAY_INTERNAL_SECRET;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_VEO_MODEL;
delete process.env.GEMINI_VIDEO_MODEL;
delete process.env.VIDU_API_KEY;
delete process.env.VIDU_KEY;
delete process.env.FAL_KEY;
delete process.env.FAL_API_KEY;
delete process.env.REPLICATE_API_TOKEN;

const {
  planIntentosClip,
  presupuestoPasoClip,
  waitPasoClip,
  duracionClipParaProveedor,
  proveedorFalBloqueado,
  proveedorViduBloqueado,
  esErrorCreditoClip,
  resumenMotivoClip,
  avisoMotivoClip,
  clavesVideoClip,
  SOFT_DEADLINE_MS,
  BUDGET_CLIP_MS,
  FORCE_FLUSH_MS,
} = await import('../netlify/functions/estudio-clip.mjs');

// Streaming Netlify ~60s: soft/force/budget DEBEN quedar debajo.
assert.ok(SOFT_DEADLINE_MS < 55000, `soft ${SOFT_DEADLINE_MS}`);
assert.ok(FORCE_FLUSH_MS < 58000, `force ${FORCE_FLUSH_MS}`);
assert.ok(BUDGET_CLIP_MS < 58000, `budget ${BUDGET_CLIP_MS}`);
assert.ok(FORCE_FLUSH_MS > SOFT_DEADLINE_MS, 'force después de soft');
assert.ok(BUDGET_CLIP_MS >= SOFT_DEADLINE_MS, 'budget >= soft');

// Gemini primero, Fal al final. La placa no es un paso de esta lista.
const orden = planIntentosClip({
  tieneVeo: true, tieneVidu: true, tieneFal: true,
});
assert.deepEqual(orden, ['veo-t2v', 'vidu-i2v', 'vidu-t2v', 'fal-i2v', 'fal-t2v']);
assert.equal(orden[0], 'veo-t2v');
assert.equal(orden.at(-1), 'fal-t2v');

const sinGemini = planIntentosClip({
  tieneVeo: true, tieneVidu: true, tieneFal: true, omitVeo: true,
});
assert.deepEqual(sinGemini, ['vidu-i2v', 'vidu-t2v', 'fal-i2v', 'fal-t2v']);

assert.deepEqual(
  planIntentosClip({ tieneVeo: true, tieneVidu: true }),
  ['veo-t2v', 'vidu-i2v', 'vidu-t2v'],
);
assert.deepEqual(planIntentosClip({ tieneFal: true }), ['fal-i2v', 'fal-t2v']);
assert.deepEqual(planIntentosClip({ tieneVeo: true }), ['veo-t2v']);
assert.deepEqual(planIntentosClip({ tieneVidu: true }), ['vidu-i2v', 'vidu-t2v']);
assert.deepEqual(planIntentosClip({}), []);

// Omni 3–10 s. 12 s pedido se acota a 10; Vidu conserva 12.
assert.equal(duracionClipParaProveedor('veo-t2v', 8), 8);
assert.equal(duracionClipParaProveedor('veo-t2v', 10), 10);
assert.equal(duracionClipParaProveedor('veo-t2v', 12), 10);
assert.equal(duracionClipParaProveedor('vidu-i2v', 8), 8);
assert.equal(duracionClipParaProveedor('vidu-i2v', 10), 10);
assert.equal(duracionClipParaProveedor('vidu-i2v', 12), 12);
assert.equal(duracionClipParaProveedor('fal-i2v', 8), 8);
assert.equal(duracionClipParaProveedor('fal-i2v', 10), 10);
assert.equal(duracionClipParaProveedor('fal-i2v', 12), 10);
assert.equal(duracionClipParaProveedor('fal-t2v', 12), 10);
assert.equal(duracionClipParaProveedor('fal-i2v', 12, 15000), 6);

// Presupuestos acotados al soft streaming.
assert.equal(presupuestoPasoClip('veo-t2v', 54000, { reservarVidu: true }), 18000);
assert.equal(presupuestoPasoClip('veo-t2v', 54000), 28000);
assert.equal(presupuestoPasoClip('veo-t2v', 40000, { reintentoPlaca: true }), 16000);
assert.equal(presupuestoPasoClip('veo-t2v', 20000, { reservarVidu: true }), 0);
assert.equal(presupuestoPasoClip('fal-i2v', 40000), 30000);
assert.equal(presupuestoPasoClip('vidu-i2v', 40000), 20000);
assert.equal(presupuestoPasoClip('vidu-i2v', 40000, { pescaEpica: true }), 24000);
assert.equal(presupuestoPasoClip('fal-i2v', 12000), 0);
assert.equal(presupuestoPasoClip('fal-t2v', 12000), 0);
assert.equal(presupuestoPasoClip('vidu-t2v', 20000), 12000);
assert.equal(presupuestoPasoClip('desconocido', 80000), 0);

assert.equal(proveedorFalBloqueado(['fal-i2v:fal-ai/ltx-video/image-to-video HTTP 403: Forbidden']), true);
assert.equal(proveedorFalBloqueado(['fal-t2v:x Exhausted balance. top_up']), true);
assert.equal(proveedorFalBloqueado(['vidu-i2v HTTP 403: Forbidden']), false);
assert.equal(proveedorFalBloqueado(['fal-i2v:x timeout']), false);
assert.equal(proveedorViduBloqueado(['vidu-i2v HTTP 403: Forbidden']), true);
assert.equal(proveedorViduBloqueado(['vidu-i2v HTTP 401: unauthorized']), true);
assert.equal(proveedorViduBloqueado(['fal-i2v HTTP 403: Forbidden']), false);
assert.equal(proveedorViduBloqueado(['vidu-i2v timeout']), false);
assert.equal(proveedorViduBloqueado(['vidu-i2v tarea {"err_code":"CreditInsufficient","credits":0}']), true);
assert.equal(esErrorCreditoClip('User is locked. Exhausted balance'), true);
assert.equal(esErrorCreditoClip('CreditInsufficient'), true);
assert.equal(esErrorCreditoClip('timeout_operacion'), false);
assert.equal(
  resumenMotivoClip([
    'fal-i2v HTTP 403: Exhausted balance',
    'vidu-i2v CreditInsufficient credits:0',
  ]),
  'saldo_agotado_fal_y_vidu',
);
assert.match(avisoMotivoClip('saldo_agotado_fal_y_vidu', 8), /Fal y Vidu sin crédito/);

process.env.GEMINI_API_KEY = '  ';
process.env.VIDU_KEY = 'vidu-test';
delete process.env.VIDU_API_KEY;
process.env.FAL_API_KEY = 'fal-test';
delete process.env.FAL_KEY;
const claves = clavesVideoClip();
assert.equal(claves.veo, false);
assert.equal(claves.vidu, true);
assert.equal(claves.fal, true);

delete process.env.GEMINI_API_KEY;
delete process.env.VIDU_KEY;
delete process.env.FAL_API_KEY;

const { default: clipHandler } = await import('../netlify/functions/estudio-clip.mjs');
const { createAccessToken } = await import('../netlify/functions/lib/ecosistema-auth.mjs');

const originalFetch = globalThis.fetch;
const placa = 'A'.repeat(120);
const TEST_SECRET = 'test-clip-orden-secret';
const PROMPT_CHAROLA = 'una charola con pan con formas variadas dentro de ella puesta en una mesa de una sala elegante son un mantel blanco con encajes, con detalles nítidos en cada pieza de pan y vista desde un ángulo medio superior de derecha a izquierda';

function tokenPremium() {
  process.env.ECOSISTEMA_SESSION_SECRET = TEST_SECRET;
  return createAccessToken({
    sub: 'test-clip-premium',
    product: 'video_diamante_premium',
    plan: 'premium',
    tier: 'premium',
  }, TEST_SECRET, 3600);
}

async function invocar(body, { premium = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (premium) headers.Authorization = `Bearer ${tokenPremium()}`;
  else {
    delete process.env.ECOSISTEMA_SESSION_SECRET;
    delete process.env.RAILWAY_INTERNAL_SECRET;
  }
  const response = await clipHandler(new Request('http://localhost/.netlify/functions/estudio-clip', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }));
  const text = await response.text();
  const events = text.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
  const result = [...events].reverse().find((e) => e.type === 'result') || null;
  return { status: response.status, events, result };
}

function hostsDe(calls) {
  return calls.map((url) => {
    if (url.includes('api.vidu.com')) return 'vidu';
    if (url.includes('generativelanguage.googleapis.com')) return 'veo';
    if (url.includes('fal.run')) return 'fal';
    return `otro:${url}`;
  });
}

try {
  const calls = [];
  process.env.GEMINI_API_KEY = 'veo-key';
  process.env.VIDU_API_KEY = 'vidu-key';
  process.env.FAL_KEY = 'fal-key';

  const videoBytes = Buffer.alloc(2048, 4);
  const respuestaGemini = () => new Response(JSON.stringify({
    id: 'v1_clip',
    status: 'completed',
    model: 'gemini-omni-1.1-flash',
    steps: [{
      type: 'model_output',
      content: [{
        type: 'video',
        mime_type: 'video/mp4',
        uri: 'https://generativelanguage.googleapis.com/v1beta/files/clip123:download?alt=media',
      }],
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  // 8 s: Gemini Omni primero. Si entrega video, no se llama Vidu ni Fal.
  let bodyGemini = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/interactions') && opts.method === 'POST') {
      bodyGemini = JSON.parse(opts.body || '{}');
      return respuestaGemini();
    }
    if (u.includes('/files/clip123')) {
      return new Response(videoBytes, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      });
    }
    throw new Error(`Vidu/Fal no van si Gemini ya entregó: ${u}`);
  };

  const geminiOk = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(geminiOk.status, 200);
  assert.equal(geminiOk.result?.success, true);
  assert.equal(geminiOk.result?.tipo, 'video');
  assert.equal(geminiOk.result?.fuente, 'gemini-veo:gemini-omni-1.1-flash');
  assert.equal(geminiOk.result?.duracionSeg, 8);
  assert.equal(bodyGemini?.model, 'gemini-omni-1.1-flash');
  assert.equal(bodyGemini?.response_format?.type, 'video');
  assert.equal(bodyGemini?.response_format?.aspect_ratio, '16:9');
  assert.equal(bodyGemini?.generation_config?.video_config?.task, 'text_to_video');
  assert.match(bodyGemini?.input || '', /8 seconds/);
  assert.ok(!String(bodyGemini?.model || '').includes('veo-'));
  assert.ok(geminiOk.result.registro.some((r) => r.paso === 'veo-t2v' && r.ok));
  assert.deepEqual(hostsDe(calls), ['veo', 'veo']);
  assert.ok(!calls.some((u) => u.includes('predictLongRunning')));

  // 10 s Premium: Omni sí entra (tope 10 s) y va primero.
  calls.length = 0;
  bodyGemini = null;
  const gemini10 = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 10,
    imagen_base64: placa,
    mime: 'image/jpeg',
  }, { premium: true });
  assert.equal(gemini10.result?.success, true);
  assert.equal(gemini10.result?.fuente, 'gemini-veo:gemini-omni-1.1-flash');
  assert.equal(gemini10.result?.duracionSeg, 10);
  assert.match(bodyGemini?.input || '', /10 seconds/);
  assert.ok(!calls.some((u) => u.includes('fal.run') || u.includes('api.vidu.com')));

  // 12 s: Omni no llega; Vidu I2V antes que Fal.
  calls.length = 0;
  let bodyVidu = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('generativelanguage.googleapis.com')) {
      throw new Error(`Gemini no debe entrar en 12s: ${u}`);
    }
    if (u.includes('api.vidu.com/ent/v2/img2video')) {
      bodyVidu = JSON.parse(opts.body || '{}');
      return new Response(JSON.stringify({ task_id: 'vidu-12' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('/tasks/vidu-12/creations')) {
      return new Response(JSON.stringify({
        state: 'success',
        creations: [{ url: 'https://cdn.example/vidu-12.mp4' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Fal no debe ir antes de Vidu: ${u}`);
  };
  const clip12 = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 12,
    imagen_base64: placa,
    mime: 'image/jpeg',
  }, { premium: true });
  assert.equal(clip12.result?.success, true);
  assert.equal(clip12.result?.tipo, 'video');
  assert.equal(clip12.result?.fuente, 'vidu-i2v');
  assert.equal(clip12.result?.duracionSeg, 12);
  assert.equal(bodyVidu?.duration, 12);
  assert.deepEqual(hostsDe(calls), ['vidu', 'vidu']);

  // Gemini falla → Vidu I2V. Fal no se llama si Vidu entrega.
  calls.length = 0;
  bodyVidu = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/interactions')) {
      return new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('api.vidu.com/ent/v2/img2video')) {
      bodyVidu = JSON.parse(opts.body || '{}');
      return new Response(JSON.stringify({ task_id: 'vidu-8' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('/tasks/vidu-8/creations')) {
      return new Response(JSON.stringify({
        state: 'success',
        creations: [{ url: 'https://cdn.example/vidu-8.mp4' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Fal no debe ir si Vidu ya entregó: ${u}`);
  };
  const viduOk = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(viduOk.result?.success, true);
  assert.equal(viduOk.result?.fuente, 'vidu-i2v');
  assert.equal(bodyVidu?.duration, 8);
  assert.equal(hostsDe(calls)[0], 'veo');
  assert.ok(hostsDe(calls).includes('vidu'));
  assert.ok(!calls.some((u) => u.includes('fal.run')));

  // Gemini, Vidu y Fal sin video: placa y motivo de saldo. Orden Gemini → Vidu → Fal.
  calls.length = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    return new Response(JSON.stringify({
      detail: 'Exhausted balance. User is locked.',
      err_code: 'CreditInsufficient',
      credits: 0,
      state: 'failed',
      error: { message: 'Exhausted balance' },
    }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  };
  const fal403 = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(fal403.result?.success, true);
  assert.equal(fal403.result?.tipo, 'cinematico');
  assert.equal(fal403.result?.motivo_fallback, 'saldo_agotado_fal_y_vidu');
  const orden403 = hostsDe(calls);
  assert.equal(orden403[0], 'veo');
  assert.ok(orden403.includes('vidu'));
  assert.ok(orden403.includes('fal'));
  assert.ok(orden403.indexOf('veo') < orden403.indexOf('vidu'));
  assert.ok(orden403.lastIndexOf('vidu') < orden403.indexOf('fal'));

  // Si Veo también falla: placa + motivo claro de saldo.
  calls.length = 0;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      detail: 'Exhausted balance. User is locked.',
      err_code: 'CreditInsufficient',
      credits: 0,
      state: 'failed',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  };
  const todoSinSaldo = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(todoSinSaldo.result?.success, true);
  assert.equal(todoSinSaldo.result?.tipo, 'cinematico');
  assert.equal(todoSinSaldo.result?.motivo_fallback, 'saldo_agotado_fal_y_vidu');
  assert.match(todoSinSaldo.result?.aviso || '', /sin crédito|saldo/i);
  assert.ok(hostsDe(calls).includes('veo'));

  // Sin claves: placa sin fetch.
  calls.length = 0;
  delete process.env.GEMINI_API_KEY;
  delete process.env.VIDU_API_KEY;
  delete process.env.VIDU_KEY;
  delete process.env.FAL_KEY;
  delete process.env.FAL_API_KEY;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    throw new Error(`Sin claves no debe haber fetch ${url}`);
  };
  const sinClaves = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(sinClaves.result?.success, true);
  assert.equal(sinClaves.result?.tipo, 'cinematico');
  assert.equal(sinClaves.result?.motivo_fallback, 'sin_claves_video');
  assert.equal(calls.length, 0);

  // waitPasoClip capea al soft (inicio hace 40s → ~8s soft restantes − margen).
  const inicioFake = Date.now() - 40000;
  const capped = waitPasoClip('fal-i2v', inicioFake, {});
  assert.ok(capped > 0 && capped <= 8000, `waitPasoClip debe capar al soft: ${capped}`);

  console.log('test_estudio_clip_orden: ok');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnap)) delete process.env[key];
  }
  Object.assign(process.env, envSnap);
}
