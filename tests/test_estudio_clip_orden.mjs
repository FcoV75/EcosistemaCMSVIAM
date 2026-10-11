import assert from 'node:assert/strict';

const envSnap = { ...process.env };
delete process.env.ECOSISTEMA_SESSION_SECRET;
delete process.env.RAILWAY_INTERNAL_SECRET;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_VEO_MODEL;
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

// Default priorizarFal: LTX primero para caber en ~60s.
const conFal = planIntentosClip({
  tieneVeo: true, tieneVidu: true, tieneFal: true, conPlaca: false, priorizarFal: true,
});
assert.deepEqual(conFal, ['fal-i2v', 'vidu-i2v', 'veo-t2v', 'vidu-t2v', 'fal-t2v']);
assert.equal(conFal[0], 'fal-i2v');

const conFalOmitVeo = planIntentosClip({
  tieneVeo: true, tieneVidu: true, tieneFal: true, omitVeo: true, priorizarFal: true,
});
assert.deepEqual(conFalOmitVeo, ['fal-i2v', 'vidu-i2v', 'vidu-t2v', 'fal-t2v']);

// Sin Fal: orden clásico (legacy).
assert.deepEqual(
  planIntentosClip({ tieneVeo: true, tieneVidu: true, conPlaca: false, priorizarFal: false }),
  ['veo-t2v', 'vidu-i2v', 'vidu-t2v'],
);
assert.deepEqual(
  planIntentosClip({ tieneVeo: true, tieneVidu: true, conPlaca: true, priorizarFal: false }),
  ['vidu-i2v', 'veo-t2v', 'vidu-t2v'],
);
assert.deepEqual(planIntentosClip({ tieneFal: true }), ['fal-i2v', 'fal-t2v']);
assert.deepEqual(
  planIntentosClip({ tieneVeo: true, priorizarFal: false }),
  ['veo-t2v'],
);
assert.deepEqual(
  planIntentosClip({ tieneVidu: true, conPlaca: true, priorizarFal: false }),
  ['vidu-i2v', 'vidu-t2v'],
);
assert.deepEqual(planIntentosClip({}), []);

// Duraciones 8 / 10 / 12 → mapeo por proveedor.
assert.equal(duracionClipParaProveedor('veo-t2v', 8), 8);
assert.equal(duracionClipParaProveedor('veo-t2v', 10), 8);
assert.equal(duracionClipParaProveedor('veo-t2v', 12), 8);
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

  // 8 s charola: Fal I2V primero (priorizarFal + omitVeo por tener Fal).
  let bodyFal = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('queue.fal.run') && opts.method === 'POST') {
      bodyFal = JSON.parse(opts.body || '{}');
      return new Response(JSON.stringify({
        status_url: 'https://queue.fal.run/status/1',
        response_url: 'https://queue.fal.run/response/1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('queue.fal.run/status')) {
      return new Response(JSON.stringify({ status: 'COMPLETED' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('queue.fal.run/response')) {
      return new Response(JSON.stringify({ video: { url: 'https://cdn.example/fal-8.mp4' } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      throw new Error(`Veo no debe llamarse con Fal disponible: ${u}`);
    }
    throw new Error(`No debía llamarse ${u}`);
  };

  const falOk = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(falOk.status, 200);
  assert.equal(falOk.result?.success, true);
  assert.equal(falOk.result?.tipo, 'video');
  assert.match(falOk.result?.fuente || '', /^fal-i2v:/);
  assert.equal(falOk.result?.duracionSeg, 8);
  assert.equal(String(bodyFal?.duration), '8');
  assert.ok(Array.isArray(falOk.result?.registro), 'debe traer registro de tiempos');
  assert.ok(falOk.result.registro.some((r) => r.paso === 'fal-i2v' && r.ok));
  assert.ok(!hostsDe(calls).includes('veo'));

  // 10 s y 12 s Premium: duración pedida a Fal (12→10); sin Veo.
  for (const segs of [10, 12]) {
    calls.length = 0;
    bodyFal = null;
    const esperada = segs === 12 ? 10 : segs;
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('queue.fal.run') && opts.method === 'POST') {
        bodyFal = JSON.parse(opts.body || '{}');
        return new Response(JSON.stringify({
          status_url: `https://queue.fal.run/status/${segs}`,
          response_url: `https://queue.fal.run/response/${segs}`,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('/status/')) {
        return new Response(JSON.stringify({ status: 'COMPLETED' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('/response/')) {
        return new Response(JSON.stringify({ video: { url: `https://cdn.example/fal-${segs}.mp4` } }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('generativelanguage.googleapis.com')) {
        throw new Error(`Veo no debe entrar en ${segs}s`);
      }
      throw new Error(`No debía llamarse ${u}`);
    };

    const clipLargo = await invocar({
      prompt: PROMPT_CHAROLA,
      duracionSeg: segs,
      imagen_base64: placa,
      mime: 'image/jpeg',
    }, { premium: true });
    assert.equal(clipLargo.result?.success, true);
    assert.equal(clipLargo.result?.tipo, 'video');
    assert.match(clipLargo.result?.fuente || '', /^fal-i2v:/);
    assert.equal(clipLargo.result?.duracionSeg, segs);
    assert.equal(String(bodyFal?.duration), String(esperada));
    assert.ok(!hostsDe(calls).includes('veo'), `Veo no en ${segs}s`);
  }

  // Sin Fal: Vidu I2V con placa (omitVeo por tener Vidu).
  calls.length = 0;
  delete process.env.FAL_KEY;
  delete process.env.FAL_API_KEY;
  process.env.VIDU_API_KEY = 'vidu-key';
  process.env.GEMINI_API_KEY = 'veo-key';
  let bodyVidu = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push(u);
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
    if (u.includes('generativelanguage.googleapis.com')) {
      throw new Error(`Veo omitido si hay Vidu: ${u}`);
    }
    throw new Error(`No debía llamarse ${u}`);
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
  assert.deepEqual(hostsDe(calls), ['vidu', 'vidu']);

  // 403 en cascada: Fal → Vidu → placa (con registro).
  calls.length = 0;
  process.env.FAL_KEY = 'fal-key';
  process.env.VIDU_API_KEY = 'vidu-key';
  process.env.GEMINI_API_KEY = 'veo-key';
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ detail: 'Exhausted balance. User is locked.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const fal403 = await invocar({
    prompt: PROMPT_CHAROLA,
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(fal403.result?.success, true);
  assert.equal(fal403.result?.tipo, 'cinematico');
  assert.match(fal403.result?.motivo_fallback || '', /fal-i2v:/);
  assert.match(fal403.result?.motivo_fallback || '', /HTTP 403/);
  assert.ok(Array.isArray(fal403.result?.registro));
  const orden403 = hostsDe(calls);
  assert.equal(orden403[0], 'fal');
  assert.ok(orden403.includes('vidu'));
  assert.ok(!orden403.includes('veo'));

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
