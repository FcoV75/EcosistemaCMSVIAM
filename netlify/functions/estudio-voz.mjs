import { createRequire } from 'module';
import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import {
  LIMITES_VOZ,
  clamp,
  esPremiumPayload,
  partirTexto,
  recortarTextoParaVoz,
} from './lib/estudio-limites.mjs';

const require = createRequire(import.meta.url);

const VOCES_GEMINI = {
  femenina: 'Kore',
  masculina: 'Charon',
  calida: 'Aoede',
  firme: 'Fenrir',
};

const VOCES_GROQ = {
  femenina: 'Celeste-PlayAI',
  masculina: 'Fritz-PlayAI',
  calida: 'Deedee-PlayAI',
  firme: 'Thunder-PlayAI',
};

function pcm16ToWav(pcmBuf, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuf.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuf.length, 40);
  return Buffer.concat([header, pcmBuf]);
}

function encodeMp3(pcmBuf, sampleRate) {
  let lamejs;
  try {
    lamejs = require('lamejs');
  } catch {
    return null;
  }
  const Encoder = lamejs.Mp3Encoder;
  if (!Encoder) return null;
  const samples = new Int16Array(
    pcmBuf.buffer,
    pcmBuf.byteOffset,
    Math.floor(pcmBuf.length / 2),
  );
  const encoder = new Encoder(1, sampleRate, 64);
  const bloque = 1152;
  const partes = [];
  for (let i = 0; i < samples.length; i += bloque) {
    const slice = samples.subarray(i, Math.min(i + bloque, samples.length));
    const buf = encoder.encodeBuffer(slice);
    if (buf?.length) partes.push(Buffer.from(buf));
  }
  const fin = encoder.flush();
  if (fin?.length) partes.push(Buffer.from(fin));
  return partes.length ? Buffer.concat(partes) : null;
}

function extraerPcmGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      const mime = String(inline.mimeType || inline.mime_type || '');
      const buf = Buffer.from(inline.data, 'base64');
      const rateMatch = mime.match(/rate=(\d+)/i);
      const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
      return { buf, mime, sampleRate };
    }
  }
  return null;
}

async function ttsGemini(apiKey, texto, voz) {
  const modelos = [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.0-flash-exp',
  ];
  const chunks = partirTexto(texto);
  let sampleRate = 24000;
  const pcmParts = [];
  let modeloUsado = '';

  for (const chunk of chunks) {
    let okChunk = false;
    for (const modelo of modelos) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: chunk }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } },
              },
            },
          }),
        },
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) continue;
      const extraido = extraerPcmGemini(data);
      if (!extraido) continue;
      sampleRate = extraido.sampleRate || sampleRate;
      pcmParts.push(extraido.buf);
      modeloUsado = modelo;
      okChunk = true;
      break;
    }
    if (!okChunk) {
      if (pcmParts.length) break;
      return null;
    }
  }

  if (!pcmParts.length) return null;
  const pcm = Buffer.concat(pcmParts);
  const mp3 = encodeMp3(pcm, sampleRate);
  if (mp3 && mp3.length > 800) {
    return { buffer: mp3, mime: 'audio/mpeg', modelo: modeloUsado, formato: 'mp3' };
  }
  const wav = pcm16ToWav(pcm, sampleRate);
  if (wav.length > 3.6 * 1024 * 1024) return null;
  return { buffer: wav, mime: 'audio/wav', modelo: modeloUsado, formato: 'wav' };
}

async function ttsGroq(apiKey, texto, voz) {
  const r = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'playai-tts',
      voice: voz,
      input: texto,
      response_format: 'mp3',
    }),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => '');
    console.warn('Groq TTS:', r.status, err.slice(0, 240));
    return null;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 400) return null;
  return { buffer: buf, mime: 'audio/mpeg', modelo: 'playai-tts', formato: 'mp3' };
}

export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'estudio_voz',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const body = await req.json();
    const premium = esPremiumPayload(guard.payload);
    const limites = premium ? LIMITES_VOZ.premium : LIMITES_VOZ.free;
    const maxSeg = clamp(body.maxSeg ?? limites.maxSeg, 8, limites.maxSeg);
    const recorte = recortarTextoParaVoz(body.texto || body.text || '', maxSeg);
    if (!recorte.texto) {
      return jsonResponse({ error: 'Escribe el texto que quieres convertir a voz.' }, 400);
    }

    const estilo = String(body.voz || body.estilo || 'femenina').toLowerCase();
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';

    let audio = null;
    if (geminiKey) {
      audio = await ttsGemini(geminiKey, recorte.texto, VOCES_GEMINI[estilo] || VOCES_GEMINI.femenina);
    }
    if (!audio && groqKey) {
      audio = await ttsGroq(groqKey, recorte.texto, VOCES_GROQ[estilo] || VOCES_GROQ.femenina);
    }
    if (!audio) {
      return jsonResponse({
        error: 'No se pudo generar la voz. Configura GEMINI_API_KEY (español) o GROQ_API_KEY.',
      }, 502);
    }

    return jsonResponse({
      success: true,
      audio_base64: audio.buffer.toString('base64'),
      mime: audio.mime,
      modelo: audio.modelo,
      formato: audio.formato,
      recortado: recorte.recortado,
      maxSeg,
      palabras: recorte.palabras,
      fuente: audio.modelo?.includes('gemini') ? 'gemini' : 'groq',
    });
  } catch (e) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
};
