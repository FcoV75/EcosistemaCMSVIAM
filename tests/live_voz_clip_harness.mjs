#!/usr/bin/env node
/**
 * Pruebas LIVE de voz (chunked) y diagnóstico de keys.
 * Uso:
 *   node tests/live_voz_clip_harness.mjs
 *   BASE=https://centromultidisciplinarioags.com node tests/live_voz_clip_harness.mjs
 *
 * Sin GROQ_API_KEY/GEMINI_API_KEY locales prueba solo contra BASE (producción)
 * si se pasa TOKEN=... o el sitio permite legacy-open.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CHUNK_CHARS_VOZ,
  envolverTextoTtsGemini,
  palabrasParaSegundos,
  partirTextoVoz,
  speechFicticio,
  stitchAudioBuffers,
} from '../netlify/functions/lib/estudio-voz-helpers.mjs';

const OUT = path.resolve('artifacts/live-voz-clip');
fs.mkdirSync(OUT, { recursive: true });

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const TOKEN = process.env.TOKEN || process.env.ECOSISTEMA_TOKEN || '';
const GROQ = process.env.GROQ_API_KEY || '';
const GEMINI = process.env.GEMINI_API_KEY || '';
const FAL = process.env.FAL_KEY || process.env.FAL_API_KEY || '';

const report = {
  started_at: new Date().toISOString(),
  keys: {
    GROQ_API_KEY: GROQ.length,
    GEMINI_API_KEY: GEMINI.length,
    FAL_KEY: FAL.length,
  },
  environment_note:
    GROQ.length === 0 && GEMINI.length === 0 && FAL.length === 0
      ? 'Keys ausentes en esta VM: el Environment Cursor no está vinculado a este agente.'
      : 'Keys presentes en runtime local.',
  chunk_plan: {},
  local_tts: [],
  remote_voz: [],
  remote_clip: null,
  gemini_status: null,
};

for (const seg of [30, 60, 120, 300]) {
  const palabras = palabrasParaSegundos(seg);
  const speech = speechFicticio(palabras);
  const chunks = partirTextoVoz(speech, CHUNK_CHARS_VOZ);
  report.chunk_plan[`${seg}s`] = {
    palabras,
    chars: speech.length,
    chunks: chunks.length,
    max_chunk_chars: Math.max(...chunks.map((c) => c.length)),
  };
}

async function ttsGroqLocal(texto) {
  if (!GROQ) return { ok: false, error: 'GROQ_API_KEY ausente' };
  const r = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'playai-tts',
      voice: 'Celeste-PlayAI',
      input: texto.slice(0, 900),
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(28000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    return { ok: false, error: `HTTP ${r.status}: ${t.slice(0, 200)}` };
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return { ok: buf.length > 400, bytes: buf.length, buffer: buf, fuente: 'groq' };
}

async function ttsGeminiLocal(texto) {
  if (!GEMINI) return { ok: false, error: 'GEMINI_API_KEY ausente' };
  const modelo = 'gemini-2.5-flash-preview-tts';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: envolverTextoTtsGemini(texto.slice(0, 380)) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, error: `HTTP ${r.status}: ${JSON.stringify(data).slice(0, 220)}` };
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      const buf = Buffer.from(inline.data, 'base64');
      return { ok: buf.length > 400, bytes: buf.length, buffer: buf, fuente: 'gemini', mime: inline.mimeType || 'audio/wav' };
    }
  }
  return { ok: false, error: 'sin audio en respuesta Gemini' };
}

async function generarSpeechSeg(seg) {
  const palabras = palabrasParaSegundos(seg);
  const speech = speechFicticio(palabras);
  const chunks = partirTextoVoz(speech, CHUNK_CHARS_VOZ);
  const buffers = [];
  const fuentes = [];
  const errores = [];
  for (let i = 0; i < chunks.length; i++) {
    let res = await ttsGroqLocal(chunks[i]);
    if (!res.ok) {
      errores.push(`chunk${i}/groq: ${res.error}`);
      res = await ttsGeminiLocal(chunks[i]);
      if (!res.ok) {
        errores.push(`chunk${i}/gemini: ${res.error}`);
        return { ok: false, seg, chunks: chunks.length, errores };
      }
    }
    buffers.push(res.buffer);
    fuentes.push(res.fuente);
  }
  const stitched = stitchAudioBuffers(buffers);
  const file = path.join(OUT, `voz-${seg}s.mp3`);
  fs.writeFileSync(file, stitched);
  return {
    ok: true,
    seg,
    chunks: chunks.length,
    bytes: stitched.length,
    fuentes: [...new Set(fuentes)],
    file,
    errores,
  };
}

if (GROQ || GEMINI) {
  for (const seg of [30, 60, 120, 300]) {
    console.log(`LIVE voz ${seg}s…`);
    const r = await generarSpeechSeg(seg);
    report.local_tts.push(r);
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok && seg <= 60) break;
  }
} else {
  report.local_tts.push({
    ok: false,
    skipped: true,
    reason: 'Sin GROQ_API_KEY ni GEMINI_API_KEY en esta VM (Environment no vinculado).',
  });
}

if (BASE) {
  try {
    const st = await fetch(`${BASE}/.netlify/functions/estudio-gemini-status`, {
      signal: AbortSignal.timeout(60000),
    });
    report.gemini_status = await st.json().catch(() => ({ status: st.status }));
  } catch (err) {
    report.gemini_status = { ok: false, error: String(err?.message || err) };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  for (const seg of [30, 60]) {
    const speech = speechFicticio(palabrasParaSegundos(Math.min(seg, 30)));
    const chunks = partirTextoVoz(speech, CHUNK_CHARS_VOZ).slice(0, 1);
    try {
      const t0 = Date.now();
      const r = await fetch(`${BASE}/.netlify/functions/estudio-voz`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          texto: chunks[0],
          voz: 'femenina',
          solo_tts: true,
          chunkIndex: 0,
          chunkTotal: 1,
        }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await r.json().catch(() => ({}));
      const entry = {
        seg,
        status: r.status,
        ok: r.ok && !!data.audio_base64,
        fuente: data.fuente || null,
        modelo: data.modelo || null,
        ms: Date.now() - t0,
        error: data.error || null,
        detalle_proveedor: data.detalle_proveedor || null,
      };
      if (entry.ok) {
        const buf = Buffer.from(data.audio_base64, 'base64');
        const file = path.join(OUT, `prod-voz-${seg}s.${(data.mime || '').includes('wav') ? 'wav' : 'mp3'}`);
        fs.writeFileSync(file, buf);
        entry.file = file;
        entry.bytes = buf.length;
      }
      report.remote_voz.push(entry);
    } catch (err) {
      report.remote_voz.push({ seg, ok: false, error: String(err?.message || err) });
    }
  }
}

const reportPath = path.join(OUT, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('Report:', reportPath);
console.log(JSON.stringify(report, null, 2));

const liveOk = report.local_tts.some((x) => x.ok) || report.remote_voz.some((x) => x.ok);
if (!liveOk) {
  console.error('LIVE incompleto: sin audio real (keys ausentes o proveedores fallaron).');
  process.exitCode = 2;
}
