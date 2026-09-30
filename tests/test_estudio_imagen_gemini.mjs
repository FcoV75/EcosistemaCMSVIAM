import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-gemini-key';

const originalFetch = globalThis.fetch;
const imageBytes = Buffer.alloc(5000, 7).toString('base64');

globalThis.fetch = async () => new Response(JSON.stringify({
  candidates: [{
    content: {
      parts: [{
        inlineData: {
          mimeType: 'image/png',
          data: imageBytes,
        },
      }],
    },
  }],
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

try {
  const { generarImagenGemini } = await import('../netlify/functions/lib/estudio-imagen-gen.mjs');
  const result = await generarImagenGemini('A red apple on a white table', { timeoutMs: 18000 });

  assert.equal(result?.fuente, 'gemini-3.1-flash-image');
  assert.equal(result?.mime, 'image/png');
  assert.equal(result?.imagen_base64, imageBytes);

  console.log('test_estudio_imagen_gemini: ok');
} finally {
  globalThis.fetch = originalFetch;
}
