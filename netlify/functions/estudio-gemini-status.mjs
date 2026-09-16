/** Diagnóstico ligero: ¿GEMINI_API_KEY responde en texto / imagen? (sin filtrar la key). */
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

async function fetchJson(url, opciones, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opciones, signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const out = {
    sitio: 'estudio-gemini-status',
    gemini_key_presente: apiKey.length > 8,
    gemini_key_longitud: apiKey.length,
    texto: null,
    imagen: null,
    imagen4: null,
  };

  if (!apiKey) {
    return jsonResponse({ ...out, ok: false, error: 'GEMINI_API_KEY no configurada en este sitio Netlify.' }, 200);
  }

  // 1) Texto (misma familia que ContacNeed llm.ts)
  try {
    const r = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde solo: OK' }] }],
        }),
      },
      15000,
    );
    const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    out.texto = {
      ok: r.ok && /ok/i.test(text),
      status: r.status,
      muestra: String(text).slice(0, 40),
      error: r.ok ? null : JSON.stringify(r.data).slice(0, 160),
    };
  } catch (err) {
    out.texto = { ok: false, error: String(err?.name || err?.message || err) };
  }

  // 2) Imagen nativa Gemini (Video Diamante)
  try {
    const modelos = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'];
    let imagen = null;
    for (const modelo of modelos) {
      const r = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Generate a tiny photoreal photo of a red apple on a white table, 16:9.' }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        },
        45000,
      );
      const parts = r.data?.candidates?.[0]?.content?.parts || [];
      const tieneImg = parts.some((p) => p.inlineData?.data || p.inline_data?.data);
      imagen = {
        ok: r.ok && !!tieneImg,
        status: r.status,
        modelo,
        error: r.ok
          ? (tieneImg ? null : 'Sin inline image en la respuesta')
          : JSON.stringify(r.data).slice(0, 200),
      };
      if (imagen.ok) break;
    }
    out.imagen = imagen;
  } catch (err) {
    out.imagen = { ok: false, error: String(err?.name || err?.message || err) };
  }

  // 3) Imagen 4 predict
  try {
    const r = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: 'A red apple on a white table, photoreal' }],
          parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'dont_allow' },
        }),
      },
      45000,
    );
    const pred = r.data?.predictions?.[0] || {};
    const b64 = pred.bytesBase64Encoded || pred.bytesBase64encoded || '';
    out.imagen4 = {
      ok: r.ok && String(b64).length > 4000,
      status: r.status,
      error: r.ok
        ? (String(b64).length > 4000 ? null : 'Sin bytes de imagen')
        : JSON.stringify(r.data).slice(0, 200),
    };
  } catch (err) {
    out.imagen4 = { ok: false, error: String(err?.name || err?.message || err) };
  }

  out.ok = !!(out.texto?.ok || out.imagen?.ok || out.imagen4?.ok);
  return jsonResponse(out);
};
