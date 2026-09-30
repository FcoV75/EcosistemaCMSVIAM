import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-gemini-key';
delete process.env.GEMINI_VEO_MODEL;

const originalFetch = globalThis.fetch;
const videoBase64 = Buffer.alloc(2048, 3).toString('base64');
const calls = [];

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET' });
  if (String(url).includes(':predictLongRunning')) {
    return new Response(JSON.stringify({ name: 'operations/test-veo-op' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (String(url).includes('/operations/test-veo-op')) {
    return new Response(JSON.stringify({
      done: true,
      response: {
        generateVideoResponse: {
          generatedSamples: [{
            video: {
              bytesBase64Encoded: videoBase64,
              mimeType: 'video/mp4',
            },
          }],
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  throw new Error(`Unexpected fetch ${url}`);
};

try {
  const { generarClipGeminiVeoT2V } = await import('../netlify/functions/estudio-clip.mjs');
  const result = await generarClipGeminiVeoT2V('A dancer moves in a neon studio', 8, 20000);

  assert.equal(result?.fuente, 'gemini-veo:veo-3.1-fast-generate-preview');
  assert.equal(result?.mime, 'video/mp4');
  assert.equal(result?.video_base64, videoBase64);
  assert.equal(result?.actuacion, true);
  assert.equal(calls.length, 2);

  console.log('test_estudio_clip_veo: ok');
} finally {
  globalThis.fetch = originalFetch;
}
