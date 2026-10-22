import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-gemini-key';
delete process.env.GEMINI_VEO_MODEL;
delete process.env.GEMINI_VIDEO_MODEL;

const originalFetch = globalThis.fetch;
const videoBytes = Buffer.alloc(2048, 3);
const calls = [];
let body = null;

globalThis.fetch = async (url, options = {}) => {
  const u = String(url);
  calls.push({ url: u, method: options.method || 'GET', body: options.body || '' });
  if (u.includes('/v1beta/interactions') && (options.method || 'GET') === 'POST') {
    body = JSON.parse(options.body || '{}');
    return new Response(JSON.stringify({
      id: 'v1_test',
      status: 'completed',
      model: 'gemini-omni-1.1-flash',
      steps: [{
        type: 'model_output',
        content: [{
          type: 'video',
          mime_type: 'video/mp4',
          uri: 'https://generativelanguage.googleapis.com/v1beta/files/testclip:download?alt=media',
        }],
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (u.includes('/files/testclip')) {
    return new Response(videoBytes, {
      status: 200,
      headers: { 'Content-Type': 'video/mp4' },
    });
  }
  throw new Error(`Unexpected fetch ${url}`);
};

try {
  const { generarClipGeminiVeoT2V, MODELO_VIDEO_GEMINI } = await import('../netlify/functions/estudio-clip.mjs');
  const result = await generarClipGeminiVeoT2V('A dancer moves in a neon studio', 8, 20000);

  assert.equal(MODELO_VIDEO_GEMINI, 'gemini-omni-1.1-flash');
  assert.equal(result?.fuente, 'gemini-veo:gemini-omni-1.1-flash');
  assert.equal(result?.mime, 'video/mp4');
  assert.equal(result?.video_base64, videoBytes.toString('base64'));
  assert.equal(result?.actuacion, true);
  assert.equal(body?.model, 'gemini-omni-1.1-flash');
  assert.equal(body?.response_format?.delivery, 'uri');
  assert.equal(body?.background, false);
  assert.ok(!calls.some((c) => c.url.includes('predictLongRunning')));
  assert.ok(!calls.some((c) => c.url.includes('veo-3')));
  assert.equal(calls.length, 2);

  console.log('test_estudio_clip_veo: ok');
} finally {
  globalThis.fetch = originalFetch;
}
