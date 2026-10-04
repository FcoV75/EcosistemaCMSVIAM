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
  proveedorFalBloqueado,
  proveedorViduBloqueado,
  clavesVideoClip,
} = await import('../netlify/functions/estudio-clip.mjs');

function falEsUltimo(pasos) {
  const primeroFal = pasos.findIndex((p) => p.startsWith('fal'));
  if (primeroFal === -1) return;
  assert.ok(
    pasos.slice(0, primeroFal).every((p) => !p.startsWith('fal')),
    `Fal no quedó al final: ${pasos.join(',')}`,
  );
  assert.ok(
    pasos.slice(primeroFal).every((p) => p.startsWith('fal')),
    `Hay un proveedor no-Fal después de Fal: ${pasos.join(',')}`,
  );
}

const sinPlaca = planIntentosClip({ tieneVeo: true, tieneVidu: true, tieneFal: true, conPlaca: false });
assert.deepEqual(sinPlaca, ['veo-t2v', 'vidu-i2v', 'vidu-t2v', 'fal-i2v', 'fal-t2v']);
falEsUltimo(sinPlaca);

const conPlaca = planIntentosClip({ tieneVeo: true, tieneVidu: true, tieneFal: true, conPlaca: true });
assert.deepEqual(conPlaca, ['vidu-i2v', 'veo-t2v', 'vidu-t2v', 'fal-i2v', 'fal-t2v']);
falEsUltimo(conPlaca);
assert.equal(conPlaca[0], 'vidu-i2v');

assert.deepEqual(
  planIntentosClip({ tieneFal: true }),
  ['fal-i2v', 'fal-t2v'],
);
assert.deepEqual(
  planIntentosClip({ tieneVeo: true }),
  ['veo-t2v'],
);
assert.deepEqual(
  planIntentosClip({ tieneVidu: true, conPlaca: true }),
  ['vidu-i2v', 'vidu-t2v'],
);
assert.deepEqual(planIntentosClip({}), []);

assert.equal(presupuestoPasoClip('veo-t2v', 86000, { reservarVidu: true }), 42000);
assert.equal(presupuestoPasoClip('veo-t2v', 86000), 70000);
assert.equal(presupuestoPasoClip('veo-t2v', 80000, { reintentoPlaca: true }), 22000);
assert.equal(presupuestoPasoClip('veo-t2v', 30000, { reservarVidu: true }), 0);
assert.equal(presupuestoPasoClip('vidu-i2v', 50000), 44000);
assert.equal(presupuestoPasoClip('vidu-i2v', 80000, { pescaEpica: true }), 52000);
assert.equal(presupuestoPasoClip('fal-i2v', 14000), 0);
assert.equal(presupuestoPasoClip('fal-t2v', 15000), 0);
assert.equal(presupuestoPasoClip('vidu-t2v', 20000), 14000);
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

const originalFetch = globalThis.fetch;
const placa = 'A'.repeat(120);

async function invocar(body) {
  const response = await clipHandler(new Request('http://localhost/.netlify/functions/estudio-clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const videoBase64 = Buffer.alloc(2048, 7).toString('base64');
  process.env.GEMINI_API_KEY = 'veo-key';
  process.env.VIDU_API_KEY = 'vidu-key';
  process.env.FAL_KEY = 'fal-key';
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes(':predictLongRunning')) {
      return new Response(JSON.stringify({ name: 'operations/orden-veo' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('/operations/orden-veo')) {
      return new Response(JSON.stringify({
        done: true,
        response: {
          generateVideoResponse: {
            generatedSamples: [{
              video: { bytesBase64Encoded: videoBase64, mimeType: 'video/mp4' },
            }],
          },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`No debía llamarse ${u}`);
  };

  const veoOk = await invocar({
    prompt: 'Una bailarina mueve los brazos en un estudio con luces neón',
    duracionSeg: 8,
  });
  assert.equal(veoOk.status, 200);
  assert.equal(veoOk.result?.success, true);
  assert.equal(veoOk.result?.tipo, 'video');
  assert.match(veoOk.result?.fuente || '', /^gemini-veo:/);
  assert.deepEqual(hostsDe(calls), ['veo', 'veo']);

  calls.length = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('api.vidu.com/ent/v2/img2video')) {
      return new Response(JSON.stringify({ task_id: 'vidu-task-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('/tasks/vidu-task-1/creations')) {
      return new Response(JSON.stringify({
        state: 'success',
        creations: [{ url: 'https://cdn.example/vidu-clip.mp4' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`No debía llamarse ${u}`);
  };

  const viduOk = await invocar({
    prompt: 'Una bailarina mueve los brazos en un estudio con luces neón',
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(viduOk.result?.success, true);
  assert.equal(viduOk.result?.tipo, 'video');
  assert.equal(viduOk.result?.fuente, 'vidu-i2v');
  assert.equal(viduOk.result?.video_url, 'https://cdn.example/vidu-clip.mp4');
  assert.deepEqual(hostsDe(calls), ['vidu', 'vidu']);

  calls.length = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    return new Response(JSON.stringify({ detail: 'Exhausted balance. User is locked.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const fal403 = await invocar({
    prompt: 'Una bailarina mueve los brazos en un estudio con luces neón',
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(fal403.result?.success, true);
  assert.equal(fal403.result?.tipo, 'cinematico');
  assert.match(fal403.result?.motivo_fallback || '', /vidu-i2v HTTP 403/);
  assert.match(fal403.result?.motivo_fallback || '', /fal-i2v:/);
  assert.match(fal403.result?.motivo_fallback || '', /HTTP 403/);
  const orden403 = hostsDe(calls);
  assert.deepEqual(orden403, ['vidu', 'veo', 'fal']);
  assert.ok(!orden403.slice(orden403.indexOf('fal') + 1).includes('fal'), 'Fal T2V no debe reintentarse tras un 403');

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
    prompt: 'Una bailarina mueve los brazos en un estudio con luces neón',
    duracionSeg: 8,
    imagen_base64: placa,
    mime: 'image/jpeg',
  });
  assert.equal(sinClaves.result?.success, true);
  assert.equal(sinClaves.result?.tipo, 'cinematico');
  assert.equal(sinClaves.result?.motivo_fallback, 'sin_claves_video');
  assert.equal(calls.length, 0);

  console.log('test_estudio_clip_orden: ok');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnap)) delete process.env[key];
  }
  Object.assign(process.env, envSnap);
}
