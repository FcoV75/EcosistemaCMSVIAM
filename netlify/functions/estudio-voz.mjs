import { createRequire } from 'module';
import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import {
  LIMITES_VOZ,
  esPremiumPayload,
  partirTexto,
  recortarTextoParaVoz,
} from './lib/estudio-limites.mjs';
import { briefAGuiaOral, dirigirEscena } from './lib/estudio-director-semantico.mjs';

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

/** Tiempo máximo por intento a un proveedor (evita colgar Safari/Netlify). */
const TIMEOUT_GEMINI_MS = 12000;
const TIMEOUT_GROQ_MS = 20000;
const TIMEOUT_CONDENSAR_MS = 8000;

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

async function fetchConTimeout(url, opciones, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opciones, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ttsGemini(apiKey, texto, voz) {
  // Un solo modelo TTS estable: reintentar 3 modelos lentos colgaba Netlify/Safari.
  const modelos = [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ];
  const chunks = partirTexto(texto, 380);
  let sampleRate = 24000;
  const pcmParts = [];
  let modeloUsado = '';

  for (const chunk of chunks) {
    let okChunk = false;
    for (const modelo of modelos) {
      try {
        const r = await fetchConTimeout(
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
          TIMEOUT_GEMINI_MS,
        );
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          console.warn('Gemini TTS', modelo, r.status, JSON.stringify(data).slice(0, 160));
          continue;
        }
        const extraido = extraerPcmGemini(data);
        if (!extraido) continue;
        sampleRate = extraido.sampleRate || sampleRate;
        pcmParts.push(extraido.buf);
        modeloUsado = modelo;
        okChunk = true;
        break;
      } catch (err) {
        console.warn('Gemini TTS timeout/error', modelo, err?.name || err?.message || err);
      }
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

async function ttsGroqUnBloque(apiKey, texto, voz) {
  const r = await fetchConTimeout(
    'https://api.groq.com/openai/v1/audio/speech',
    {
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
    },
    TIMEOUT_GROQ_MS,
  );
  if (!r.ok) {
    const err = await r.text().catch(() => '');
    console.warn('Groq TTS:', r.status, err.slice(0, 240));
    return null;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 400) return null;
  return buf;
}

async function ttsGroq(apiKey, texto, voz) {
  // PlayAI acepta bloques cortos; partimos para no fallar en tomas largas.
  const chunks = partirTexto(texto, 900);
  const partes = [];
  for (const chunk of chunks) {
    try {
      const buf = await ttsGroqUnBloque(apiKey, chunk, voz);
      if (!buf) {
        if (partes.length) break;
        return null;
      }
      partes.push(buf);
    } catch (err) {
      console.warn('Groq TTS timeout/error:', err?.name || err?.message || err);
      if (partes.length) break;
      return null;
    }
  }
  if (!partes.length) return null;
  return {
    buffer: partes.length === 1 ? partes[0] : Buffer.concat(partes),
    mime: 'audio/mpeg',
    modelo: 'playai-tts',
    formato: 'mp3',
  };
}

async function condensarTextoParaToma(texto, maxSeg, groqKey) {
  const recorte = recortarTextoParaVoz(texto, maxSeg);
  if (!recorte.texto) return recorte;
  if (!recorte.recortado || !groqKey) {
    return { ...recorte, adaptado: false };
  }
  const maxPalabras = recorte.palabras;
  try {
    const r = await fetchConTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.3,
          max_tokens: 700,
          messages: [
            {
              role: 'system',
              content: 'Condensas locuciones en español mexicano. Conservas el mensaje, el tono y la llamada a la acción. No inventas datos. Solo devuelves el texto hablado, sin títulos.',
            },
            {
              role: 'user',
              content: `Reescribe este discurso en máximo ${maxPalabras} palabras (cabe en ~${maxSeg} segundos al hablar). Conserva nombres, beneficios y el cierre.\n\n${texto}`,
            },
          ],
        }),
      },
      TIMEOUT_CONDENSAR_MS,
    );
    const data = await r.json().catch(() => ({}));
    const limpio = String(data?.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim();
    if (limpio.length > 40) {
      const segundo = recortarTextoParaVoz(limpio, maxSeg);
      return { texto: segundo.texto, recortado: segundo.recortado, palabras: segundo.palabras, adaptado: true };
    }
  } catch (err) {
    console.warn('condensarTextoParaToma:', err?.name || err?.message || err);
  }
  return { ...recorte, adaptado: false };
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
    const maxSeg = limites.maxSeg;
    const textoEntrada = String(body.texto || body.text || '').trim();
    if (!textoEntrada) {
      return jsonResponse({ error: 'Escribe el texto que quieres convertir a voz.' }, 400);
    }

    // Director: entiende el sentido del texto (no solo recorta palabras).
    let director = null;
    try {
      director = await dirigirEscena(textoEntrada.slice(0, 900), { modalidad: 'voz' });
    } catch (err) {
      console.warn('director voz:', err?.message || err);
    }
    const guia = briefAGuiaOral(director);
    const textoParaVoz = guia && guia.length > 40 && textoEntrada.length < 120
      ? `${textoEntrada}\n\n(Contexto semántico: ${director?.resumen_es || ''})`.trim()
      : textoEntrada;

    const adaptado = await condensarTextoParaToma(textoParaVoz, maxSeg, process.env.GROQ_API_KEY || '');
    if (!adaptado.texto) {
      return jsonResponse({ error: 'Escribe el texto que quieres convertir a voz.' }, 400);
    }
    const recorte = adaptado;

    const estilo = String(body.voz || body.estilo || 'femenina').toLowerCase();
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';
    const vozGemini = VOCES_GEMINI[estilo] || VOCES_GEMINI.femenina;
    const vozGroq = VOCES_GROQ[estilo] || VOCES_GROQ.femenina;

    // Groq primero (rápido): evita el "Inactivity Timeout" de Safari cuando Gemini se cuelga.
    // Gemini después para español más natural si Groq falla.
    let audio = null;
    if (groqKey) {
      audio = await ttsGroq(groqKey, recorte.texto, vozGroq);
    }
    if (!audio && geminiKey) {
      audio = await ttsGemini(geminiKey, recorte.texto, vozGemini);
    }
    if (!audio) {
      return jsonResponse({
        error: 'No se pudo generar la voz a tiempo. Intenta de nuevo en unos segundos (texto un poco más corto ayuda).',
      }, 502);
    }

    return jsonResponse({
      success: true,
      audio_base64: audio.buffer.toString('base64'),
      mime: audio.mime,
      modelo: audio.modelo,
      formato: audio.formato,
      recortado: recorte.recortado,
      adaptado: !!recorte.adaptado,
      maxSeg,
      palabras: recorte.palabras,
      fuente: String(audio.modelo || '').includes('gemini') ? 'gemini' : 'groq',
      director: director
        ? {
            intencion: director.intencion,
            inferencias: director.inferencias?.slice(0, 3) || [],
            resumen_es: director.resumen_es,
            via: director.via,
          }
        : null,
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/abort|timeout/i.test(msg)) {
      return jsonResponse({
        error: 'La generación de voz tardó demasiado. Intenta de nuevo; si el texto es largo, acórtalo un poco.',
      }, 504);
    }
    return jsonResponse({ error: msg }, 500);
  }
};
