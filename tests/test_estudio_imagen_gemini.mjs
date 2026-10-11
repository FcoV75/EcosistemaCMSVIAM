import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.FAL_KEY = 'fal-debe-quedar-al-final';

const originalFetch = globalThis.fetch;
const imageBytes = Buffer.alloc(5000, 7).toString('base64');
const urls = [];

function respuestaGemini() {
  return new Response(JSON.stringify({
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
}

globalThis.fetch = async (url) => {
  urls.push(String(url));
  if (String(url).includes('fal.run')) {
    throw new Error('Fal no debe llamarse antes que Gemini en placa rapida');
  }
  return respuestaGemini();
};

try {
  const {
    generarImagenEstudio,
    generarImagenGemini,
  } = await import('../netlify/functions/lib/estudio-imagen-gen.mjs');
  const result = await generarImagenGemini('A red apple on a white table', { timeoutMs: 18000 });

  assert.equal(result?.fuente, 'gemini-3.1-flash-image');
  assert.equal(result?.mime, 'image/png');
  assert.equal(result?.imagen_base64, imageBytes);
  assert.equal(urls.some((u) => u.includes('fal.run')), false);

  urls.length = 0;
  const rapido = await generarImagenEstudio('A butterfly landing on a pear tree branch', {
    prioridad: 'rapido',
    timeoutMs: 18000,
  });
  assert.equal(rapido?.fuente, 'gemini-3.1-flash-image');
  assert.equal(rapido?.imagen_base64, imageBytes);
  assert.equal(urls.some((u) => u.includes('fal.run')), false);

  console.log('test_estudio_imagen_gemini: ok');
} finally {
  globalThis.fetch = originalFetch;
}
