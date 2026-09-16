/** Diagnóstico ligero: ¿GEMINI_API_KEY responde? Lista modelos y prueba texto/imagen. */
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
    modelos_utiles: [],
    texto: null,
    imagen: null,
    imagen4: null,
    tts: null,
  };

  if (!apiKey) {
    return jsonResponse({ ...out, ok: false, error: 'GEMINI_API_KEY no configurada en este sitio Netlify.' }, 200);
  }

  try {
    const r = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      {},
      20000,
    );
    const names = (r.data?.models || []).map((m) => String(m.name || '').replace(/^models\//, ''));
    out.modelos_utiles = names.filter((n) =>
      /flash|image|imagen|tts|pro/i.test(n),
    ).slice(0, 80);
    out.modelos_total = names.length;
  } catch (err) {
    out.modelos_error = String(err?.name || err?.message || err);
  }

  const candidatosTexto = out.modelos_utiles.filter((n) =>
    /flash/i.test(n) && !/image|tts|imagen|embed/i.test(n),
  );
  const textoModelo = candidatosTexto.find((n) => /gemini-3\.8-flash|gemini-3\.7-flash|gemini-3\.6-flash|gemini-flash-latest/i.test(n))
    || candidatosTexto.find((n) => /gemini-3/i.test(n))
    || 'gemini-3.6-flash';

  try {
    const r = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${textoModelo}:generateContent?key=${apiKey}`,
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
      modelo: textoModelo,
      muestra: String(text).slice(0, 40),
      error: r.ok ? null : JSON.stringify(r.data).slice(0, 160),
    };
  } catch (err) {
    out.texto = { ok: false, error: String(err?.name || err?.message || err) };
  }

  const candidatosImg = [
    ...out.modelos_utiles.filter((n) => /image/i.test(n) && !/imagen/i.test(n)),
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
  ];
  try {
    let imagen = null;
    for (const modelo of [...new Set(candidatosImg)].slice(0, 6)) {
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
          : JSON.stringify(r.data).slice(0, 220),
      };
      if (imagen.ok) break;
    }
    out.imagen = imagen;
  } catch (err) {
    out.imagen = { ok: false, error: String(err?.name || err?.message || err) };
  }

  const candidatosImagen4 = [
    ...out.modelos_utiles.filter((n) => /imagen/i.test(n)),
    'imagen-4.0-generate-001',
    'imagen-3.0-generate-002',
  ];
  try {
    let imagen4 = null;
    for (const modelo of [...new Set(candidatosImagen4)].slice(0, 4)) {
      const r = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:predict?key=${apiKey}`,
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
      imagen4 = {
        ok: r.ok && String(b64).length > 4000,
        status: r.status,
        modelo,
        error: r.ok
          ? (String(b64).length > 4000 ? null : 'Sin bytes de imagen')
          : JSON.stringify(r.data).slice(0, 220),
      };
      if (imagen4.ok) break;
    }
    out.imagen4 = imagen4;
  } catch (err) {
    out.imagen4 = { ok: false, error: String(err?.name || err?.message || err) };
  }

  const ttsModelo = out.modelos_utiles.find((n) => /tts/i.test(n)) || 'gemini-2.5-flash-preview-tts';
  try {
    const r = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${ttsModelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hola' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        }),
      },
      20000,
    );
    const parts = r.data?.candidates?.[0]?.content?.parts || [];
    const tieneAudio = parts.some((p) => p.inlineData?.data || p.inline_data?.data);
    out.tts = {
      ok: r.ok && !!tieneAudio,
      status: r.status,
      modelo: ttsModelo,
      error: r.ok ? (tieneAudio ? null : 'Sin audio') : JSON.stringify(r.data).slice(0, 160),
    };
  } catch (err) {
    out.tts = { ok: false, error: String(err?.name || err?.message || err) };
  }

  out.ok = !!(out.texto?.ok || out.imagen?.ok || out.imagen4?.ok || out.tts?.ok);
  return jsonResponse(out);
};
