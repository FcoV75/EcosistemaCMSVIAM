#!/usr/bin/env node
/**
 * Pruebas LIVE de voz chunked y clip I2V usando los handlers Netlify locales.
 *
 * Uso:
 *   node tests/live_voz_clip_harness.mjs
 *
 * Genera:
 *   artifacts/live-voz-clip/report.json
 *   artifacts/live-voz-clip/REPORT.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { createAccessToken } from '../netlify/functions/lib/ecosistema-auth.mjs';
import {
  CHUNK_CHARS_VOZ,
  palabrasParaSegundos,
  partirTextoVoz,
  speechFicticio,
  stitchAudioBuffers,
} from '../netlify/functions/lib/estudio-voz-helpers.mjs';

const OUT = path.resolve('artifacts/live-voz-clip');
fs.mkdirSync(OUT, { recursive: true });

const GROQ = process.env.GROQ_API_KEY || '';
const GEMINI = process.env.GEMINI_API_KEY || '';
const FAL = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const PAUSA_GROQ_TTS_CHUNK_MS = Number(process.env.LIVE_GROQ_TTS_CHUNK_PAUSE_MS || 6500);
const TEST_SECRET = 'cursor-live-voz-clip-harness-secret';
if (!process.env.ECOSISTEMA_SESSION_SECRET && !process.env.RAILWAY_INTERNAL_SECRET) {
  process.env.ECOSISTEMA_SESSION_SECRET = TEST_SECRET;
}
const token = createAccessToken({
  sub: 'live-harness-owner',
  product: 'video_diamante_premium',
  plan: 'propietario',
  tier: 'owner',
  permanent: true,
}, process.env.ECOSISTEMA_SESSION_SECRET || process.env.RAILWAY_INTERNAL_SECRET || TEST_SECRET, 3600);

const report = {
  started_at: new Date().toISOString(),
  keys: {
    GROQ_API_KEY: GROQ.length,
    FAL_KEY: FAL.length,
    GEMINI_API_KEY: GEMINI.length,
  },
  environment_note:
    GROQ.length === 0 && GEMINI.length === 0 && FAL.length === 0
      ? 'Keys ausentes en esta VM: el Environment Cursor no está vinculado a este agente.'
      : 'Keys presentes en runtime local.',
  chunk_plan: {},
  local_voz: [],
  local_clip: [],
  provider_blockers: [],
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

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function invokeJson(handler, body) {
  const response = await handler(new Request('http://localhost/.netlify/functions/estudio-voz', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  }));
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: response.status, data };
}

async function invokeNdjson(handler, body) {
  const response = await handler(new Request('http://localhost/.netlify/functions/estudio-clip', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  }));
  const text = await response.text();
  const events = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: 'parse_error', raw: line.slice(0, 240) };
      }
    });
  return {
    status: response.status,
    events,
    result: [...events].reverse().find((e) => e.type === 'result') || null,
  };
}

function extensionFor(mime = '') {
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'mp3';
}

function leerWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) return null;
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF' || buf.subarray(8, 12).toString('ascii') !== 'WAVE') {
    return null;
  }
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.subarray(off, off + 4).toString('ascii');
    const size = buf.readUInt32LE(off + 4);
    const start = off + 8;
    const end = Math.min(start + size, buf.length);
    if (id === 'data' && end > start) {
      return { channels, sampleRate, bitsPerSample, data: buf.subarray(start, end) };
    }
    off = end + (size % 2);
  }
  return null;
}

function wavDesdePcm(pcm, sampleRate, channels, bitsPerSample) {
  const bytesPorMuestra = Math.max(1, Math.round(bitsPerSample / 8));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPorMuestra, 28);
  header.writeUInt16LE(channels * bytesPorMuestra, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function stitchAudio(buffers, mimes) {
  const parts = (buffers || []).filter((b) => b?.length);
  if (parts.length <= 1) return parts[0] || null;
  if (!mimes.every((m) => String(m).includes('wav'))) return stitchAudioBuffers(parts);
  const wavs = parts.map(leerWav);
  if (wavs.some((w) => !w)) return Buffer.concat(parts);
  const [first] = wavs;
  const compatibles = wavs.every((w) => (
    w.channels === first.channels &&
    w.sampleRate === first.sampleRate &&
    w.bitsPerSample === first.bitsPerSample
  ));
  if (!compatibles) return Buffer.concat(parts);
  return wavDesdePcm(
    Buffer.concat(wavs.map((w) => w.data)),
    first.sampleRate,
    first.channels,
    first.bitsPerSample,
  );
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function registrarBlockers(texto = '') {
  const s = String(texto);
  if (/model_terms_required/i.test(s)) {
    report.provider_blockers.push('Groq Orpheus requiere aceptar términos del modelo en la consola Groq.');
  }
  if (/exceeded your current quota|quota/i.test(s)) {
    report.provider_blockers.push('Gemini devolvió 429 por cuota agotada.');
  }
  if (/Exhausted balance|User is locked/i.test(s)) {
    report.provider_blockers.push('Fal devolvió saldo agotado / usuario bloqueado.');
  }
}

async function probarVoz(handler, seg) {
  const speech = speechFicticio(palabrasParaSegundos(seg));
  const chunks = partirTextoVoz(speech, CHUNK_CHARS_VOZ);
  const buffers = [];
  const fuentes = [];
  const modelos = [];
  const mimes = [];
  const errores = [];
  const t0 = Date.now();

  for (let i = 0; i < chunks.length; i += 1) {
    const { status, data } = await invokeJson(handler, {
      texto: chunks[i],
      voz: 'femenina',
      solo_tts: true,
      chunkIndex: i,
      chunkTotal: chunks.length,
    });
    if (status >= 400 || !data?.audio_base64) {
      const detalle = data?.detalle_proveedor || data?.error || JSON.stringify(data);
      registrarBlockers(detalle);
      return {
        ok: false,
        seg,
        chunks: chunks.length,
        failed_chunk: i,
        status,
        error: data?.error || 'sin audio_base64',
        detalle_proveedor: detalle,
        ms: Date.now() - t0,
      };
    }
    const buf = Buffer.from(data.audio_base64, 'base64');
    buffers.push(buf);
    fuentes.push(data.fuente || 'desconocida');
    modelos.push(data.modelo || 'desconocido');
    mimes.push(data.mime || 'application/octet-stream');
    if ((data.fuente === 'groq' || /orpheus/i.test(String(data.modelo || ''))) && i < chunks.length - 1) {
      await esperar(PAUSA_GROQ_TTS_CHUNK_MS);
    }
  }

  const stitched = stitchAudio(buffers, mimes);
  const mime = mimes.every((m) => String(m).includes('wav')) ? 'audio/wav' : 'audio/mpeg';
  const file = path.join(OUT, `voz-${seg}s.${extensionFor(mime)}`);
  fs.writeFileSync(file, stitched);
  return {
    ok: true,
    seg,
    chunks: chunks.length,
    bytes: stitched.length,
    fuentes: [...new Set(fuentes)],
    modelos: [...new Set(modelos)],
    mimes: [...new Set(mimes)],
    file,
    ms: Date.now() - t0,
  };
}

async function probarClip(handler) {
  const prompt = process.env.LIVE_CLIP_PROMPT || [
    'Una bailarina mexicana en un estudio con luces neón mueve brazos, torso y pasos laterales con energía real.',
    'Cámara fija a nivel de ojos, movimiento continuo del sujeto, no Ken Burns, no zoom de foto.',
  ].join(' ');
  const t0 = Date.now();
  const entry = {
    prompt,
    requested_provider: 'fal-i2v',
    duracionSeg: 8,
  };
  try {
    const { status, events, result } = await invokeNdjson(handler, {
      prompt,
      duracionSeg: 8,
      preferProveedor: 'fal',
    });
    const safeEvents = events.map((e) => (
      e.type === 'result'
        ? {
            ...e,
            imagen_base64: e.imagen_base64 ? `[base64:${e.imagen_base64.length}]` : undefined,
            secuencia: Array.isArray(e.secuencia) ? `[frames:${e.secuencia.length}]` : undefined,
          }
        : e
    ));
    const ok = status < 400 && result?.success && result?.tipo === 'video' && /^fal-i2v:/.test(String(result?.fuente || ''));
    if (!ok) {
      registrarBlockers([
        result?.motivo_fallback,
        result?.aviso,
        result?.error,
        JSON.stringify(events.map((e) => ({ type: e.type, msg: e.msg }))).slice(0, 1000),
      ].filter(Boolean).join(' | '));
    }
    return {
      ...entry,
      ok,
      status,
      tipo: result?.tipo || null,
      fuente: result?.fuente || null,
      actuacion: !!result?.actuacion,
      aviso: result?.aviso || null,
      error: result?.error || null,
      motivo_fallback: result?.motivo_fallback || null,
      events: safeEvents.slice(-12),
      ms: Date.now() - t0,
    };
  } catch (err) {
    registrarBlockers(err?.message || String(err));
    return {
      ...entry,
      ok: false,
      error: String(err?.message || err),
      ms: Date.now() - t0,
    };
  }
}

const { default: vozHandler } = await import('../netlify/functions/estudio-voz.mjs');
const { default: clipHandler } = await import('../netlify/functions/estudio-clip.mjs');

for (const seg of [30, 60, 120, 300]) {
  console.log(`LIVE local estudio-voz ${seg}s con solo_tts/chunking...`);
  const r = await probarVoz(vozHandler, seg);
  report.local_voz.push(r);
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok) break;
}

console.log('LIVE local estudio-clip I2V FAL...');
const clip = await probarClip(clipHandler);
report.local_clip.push(clip);
console.log(JSON.stringify(clip, null, 2));

report.provider_blockers = [...new Set(report.provider_blockers)];
report.finished_at = new Date().toISOString();

const reportPath = path.join(OUT, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

const md = [
  '# LIVE voz/clip',
  '',
  `- Started: ${report.started_at}`,
  `- Finished: ${report.finished_at}`,
  `- Keys lengths: GROQ=${report.keys.GROQ_API_KEY}, FAL=${report.keys.FAL_KEY}, GEMINI=${report.keys.GEMINI_API_KEY}`,
  '',
  '## Voz',
  ...report.local_voz.map((r) => `- ${r.seg}s: ${r.ok ? `OK (${r.chunks} chunks, ${r.fuentes?.join('/')})` : `FAIL chunk ${r.failed_chunk}: ${r.detalle_proveedor || r.error}`}`),
  '',
  '## Clip I2V FAL',
  ...report.local_clip.map((r) => `- ${r.ok ? 'OK' : 'FAIL'}: fuente=${r.fuente || 'n/a'} tipo=${r.tipo || 'n/a'} fallback=${r.motivo_fallback || 'n/a'} error=${r.error || 'n/a'}`),
  '',
  '## Blockers proveedor',
  ...(report.provider_blockers.length ? report.provider_blockers.map((b) => `- ${b}`) : ['- Ninguno detectado.']),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);

console.log('Report:', reportPath);
console.log(JSON.stringify(report, null, 2));

const vozOk = report.local_voz.length === 4 && report.local_voz.every((x) => x.ok);
const clipOk = report.local_clip.some((x) => x.ok);
if (!vozOk || !clipOk) {
  console.error('LIVE incompleto: voz 30/60/120/300 o clip FAL I2V no pasaron.');
  process.exitCode = 2;
}
