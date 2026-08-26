/** Generadores de imagen HD para Estudio VIAM (Gemini, luego Flux). */

async function extraerImagenGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (!inline?.data) continue;
    const mime = String(inline.mimeType || inline.mime_type || 'image/png');
    if (!mime.startsWith('image/')) continue;
    const buf = Buffer.from(inline.data, 'base64');
    if (buf.length < 4000) continue;
    return { buffer: buf, mime };
  }
  return null;
}

export async function generarImagenGemini(promptEn) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  const modelos = [
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-preview-image-generation',
    'gemini-2.0-flash-preview-image-generation',
  ];
  const cuerpo = {
    contents: [{ parts: [{ text: promptEn }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
  for (const modelo of modelos) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        },
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Gemini imagen', modelo, r.status, JSON.stringify(data).slice(0, 180));
        continue;
      }
      const extraido = extraerImagenGemini(data);
      if (extraido) {
        return {
          imagen_base64: extraido.buffer.toString('base64'),
          mime: extraido.mime,
          fuente: modelo,
        };
      }
    } catch (err) {
      console.warn('Gemini imagen', modelo, err?.message || err);
    }
  }
  return null;
}

export async function generarImagenPollinations(promptEn, { width = 1920, height = 1080, seed } = {}) {
  const escena = String(promptEn || '').trim().slice(0, 900);
  if (!escena) return null;
  const n = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 99999);
  const negativo = encodeURIComponent('empty blue sky, silhouette bird, no flowers, no river, no mountain, watermark, text, logo');
  const modelos = ['flux', 'flux-realism', 'gptimage'];
  for (const model of modelos) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(escena)}?width=${width}&height=${height}&nologo=true&enhance=false&model=${model}&seed=${n}&negative=${negativo}`;
    try {
      const img = await fetch(url);
      if (!img.ok) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 8000) continue;
      return {
        imagen_base64: buf.toString('base64'),
        mime: img.headers.get('content-type') || 'image/jpeg',
        fuente: `pollinations-${model}`,
      };
    } catch (err) {
      console.warn('Pollinations', model, err?.message || err);
    }
  }
  return null;
}

export async function generarImagenImagen4(promptEn) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  const escena = String(promptEn || '').trim();
  if (!escena) return null;
  const modelos = ['imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001'];
  for (const modelo of modelos) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: escena }],
            parameters: { sampleCount: 1, aspectRatio: '16:9' },
          }),
        },
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Imagen', modelo, r.status, JSON.stringify(data).slice(0, 180));
        continue;
      }
      const pred = data?.predictions?.[0] || {};
      const b64 = pred.bytesBase64Encoded || pred.bytesBase64encoded || pred.image || '';
      if (String(b64).length > 4000) {
        return { imagen_base64: b64, mime: 'image/png', fuente: modelo };
      }
    } catch (err) {
      console.warn('Imagen', modelo, err?.message || err);
    }
  }
  return null;
}

export async function generarImagenEstudio(promptEn, opts = {}) {
  const imagen4 = await generarImagenImagen4(promptEn);
  if (imagen4) return imagen4;
  const gemini = await generarImagenGemini(promptEn);
  if (gemini) return gemini;
  return generarImagenPollinations(promptEn, opts);
}
