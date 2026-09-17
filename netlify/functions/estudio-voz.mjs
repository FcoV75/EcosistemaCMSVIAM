import { createRequire } from 'module';
import {
  corsPreflight,
  enforceRateLimit,
  jsonResponse,
  requireToken,
} from './lib/railway-guard.mjs';
import {
  esPropietarioPayload,
  limitesVozPara,
  partirTexto,
  recortarTextoParaVoz,
} from './lib/estudio-limites.mjs';
import { briefAGuiaOral, dirigirEscena } from './lib/estudio-director-semantico.mjs';
import {
  CHUNK_CHARS_VOZ,
  MAX_CHARS_SOLO_TTS,
  debeSaltarCuotaVoz,
  envolverTextoTtsGemini,
  envolverTextoTtsGeminiAlt,
} from './lib/estudio-voz-helpers.mjs';

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
const TIMEOUT_GEMINI_OWNER_MS = 45000;
const TIMEOUT_GROQ_OWNER_MS = 55000;
const TIMEOUT_GEMINI_CHUNK_MS = 18000;
const TIMEOUT_GROQ_CHUNK_MS = 28000;
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
  try {
    if (typeof globalThis.MPEGMode === 'undefined') {
      globalThis.MPEGMode = {
        STEREO: 0,
        JOINT_STEREO: 1,
        DUAL_CHANNEL: 2,
        MONO: 3,
      };
    }
    if (typeof globalThis.Lame === 'undefined') {
      globalThis.Lame = {};
    }
    if (typeof globalThis.BitStream === 'undefined') {
      globalThis.BitStream = function BitStream() {};
    }
    const lamejs = require('lamejs');
    const Encoder = lamejs?.Mp3Encoder;
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
  } catch (err) {
    console.warn('encodeMp3/lamejs:', err?.message || err);
    return null;
  }
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

function resumenErrorProveedor(status, bodyText) {
  const raw = String(bodyText || '').replace(/\s+/g, ' ').trim();
  const corto = raw.slice(0, 280);
  if (!status && !corto) return 'sin detalle del proveedor';
  return `HTTP ${status || '?'}: ${corto || '(cuerpo vacío)'}`;
}

async function ttsGemini(apiKey, texto, voz, opts = {}) {
  const modelos = [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ];
  // En modo chunk el cliente ya partió; no re-partir agresivo.
  const maxPart = opts.soloTts ? MAX_CHARS_SOLO_TTS : 380;
  const chunks = partirTexto(texto, maxPart);
  let sampleRate = 24000;
  const pcmParts = [];
  let modeloUsado = '';
  const timeoutMs = opts.timeoutMs || TIMEOUT_GEMINI_MS;
  const completo = !!opts.completo;
  const errores = [];

  for (const chunk of chunks) {
    let okChunk = false;
    const prompts = [
      envolverTextoTtsGemini(chunk),
      envolverTextoTtsGeminiAlt(chunk),
    ];
    for (const modelo of modelos) {
      for (const prompt of prompts) {
        try {
          const r = await fetchConTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } },
                  },
                },
              }),
            },
            timeoutMs,
          );
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const det = resumenErrorProveedor(r.status, JSON.stringify(data));
            errores.push(`gemini/${modelo}: ${det}`);
            console.warn('Gemini TTS', modelo, r.status, JSON.stringify(data).slice(0, 200));
            continue;
          }
          const extraido = extraerPcmGemini(data);
          if (!extraido) {
            errores.push(`gemini/${modelo}: sin audio en respuesta`);
            continue;
          }
          sampleRate = extraido.sampleRate || sampleRate;
          pcmParts.push(extraido.buf);
          modeloUsado = modelo;
          okChunk = true;
          break;
        } catch (err) {
          const msg = err?.name || err?.message || String(err);
          errores.push(`gemini/${modelo}: ${msg}`);
          console.warn('Gemini TTS timeout/error', modelo, msg);
        }
      }
      if (okChunk) break;
    }
    if (!okChunk) {
      if (completo) {
        return { audio: null, detalle: errores.slice(-4).join(' | ') || 'Gemini TTS falló' };
      }
      if (pcmParts.length) break;
      return { audio: null, detalle: errores.slice(-4).join(' | ') || 'Gemini TTS falló' };
    }
  }

  if (!pcmParts.length) {
    return { audio: null, detalle: errores.slice(-4).join(' | ') || 'Gemini TTS sin PCM' };
  }
  const pcm = Buffer.concat(pcmParts);
  const mp3 = encodeMp3(pcm, sampleRate);
  if (mp3 && mp3.length > 800) {
    return {
      audio: { buffer: mp3, mime: 'audio/mpeg', modelo: modeloUsado, formato: 'mp3' },
      detalle: null,
    };
  }
  const wav = pcm16ToWav(pcm, sampleRate);
  if (wav.length > 3.6 * 1024 * 1024) {
    return { audio: null, detalle: 'Audio Gemini demasiado grande para respuesta Netlify' };
  }
  return {
    audio: { buffer: wav, mime: 'audio/wav', modelo: modeloUsado, formato: 'wav' },
    detalle: null,
  };
}

async function ttsGroqUnBloque(apiKey, texto, voz, timeoutMs = TIMEOUT_GROQ_MS) {
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
    timeoutMs,
  );
  if (!r.ok) {
    const err = await r.text().catch(() => '');
    console.warn('Groq TTS:', r.status, err.slice(0, 240));
    return { buffer: null, detalle: resumenErrorProveedor(r.status, err) };
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 400) {
    return { buffer: null, detalle: 'Groq devolvió audio vacío o demasiado corto' };
  }
  return { buffer: buf, detalle: null };
}

async function ttsGroq(apiKey, texto, voz, opts = {}) {
  const maxPart = opts.soloTts ? MAX_CHARS_SOLO_TTS : 900;
  const chunks = partirTexto(texto, maxPart);
  const partes = [];
  const timeoutMs = opts.timeoutMs || TIMEOUT_GROQ_MS;
  const completo = !!opts.completo;
  const errores = [];
  for (const chunk of chunks) {
    try {
      const res = await ttsGroqUnBloque(apiKey, chunk, voz, timeoutMs);
      if (!res.buffer) {
        if (res.detalle) errores.push(res.detalle);
        if (completo) return { audio: null, detalle: errores.slice(-3).join(' | ') };
        if (partes.length) break;
        return { audio: null, detalle: errores.slice(-3).join(' | ') || 'Groq TTS falló' };
      }
      partes.push(res.buffer);
    } catch (err) {
      const msg = err?.name || err?.message || String(err);
      errores.push(`groq: ${msg}`);
      console.warn('Groq TTS timeout/error:', msg);
      if (completo) return { audio: null, detalle: errores.slice(-3).join(' | ') };
      if (partes.length) break;
      return { audio: null, detalle: errores.slice(-3).join(' | ') };
    }
  }
  if (!partes.length) {
    return { audio: null, detalle: errores.slice(-3).join(' | ') || 'Groq TTS sin audio' };
  }
  return {
    audio: {
      buffer: partes.length === 1 ? partes[0] : Buffer.concat(partes),
      mime: 'audio/mpeg',
      modelo: 'playai-tts',
      formato: 'mp3',
    },
    detalle: null,
  };
}

async function condensarTextoParaToma(texto, maxSeg, groqKey) {
  const recorte = recortarTextoParaVoz(texto, maxSeg);
  if (!recorte.texto) return recorte;
  if (!Number.isFinite(Number(maxSeg)) || Number(maxSeg) <= 0) {
    return { ...recorte, adaptado: false };
  }
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
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const auth = requireToken(req, { product: 'video_diamante_premium' });
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  try {
    const body = await req.json();
    const soloTts = body.solo_tts === true || body.soloTts === true;
    const chunkIndex = Math.max(0, Number(body.chunkIndex) || 0);
    const chunkTotal = Math.max(0, Number(body.chunkTotal) || 0);

    // Chunks secundarios de la misma sesión no queman cuota free/premium.
    if (!debeSaltarCuotaVoz({ soloTts, chunkIndex })) {
      const rate = await enforceRateLimit(auth.payload, 'estudio_voz');
      if (!rate.ok) return jsonResponse({ error: rate.error }, rate.status);
    }

    const esOwner = esPropietarioPayload(auth.payload);
    const limites = limitesVozPara(auth.payload);
    const maxSeg = limites.maxSeg;
    let textoEntrada = String(body.texto || body.text || '').trim();
    if (!textoEntrada) {
      return jsonResponse({ error: 'Escribe el texto que quieres convertir a voz.' }, 400);
    }

    if (soloTts && textoEntrada.length > MAX_CHARS_SOLO_TTS) {
      textoEntrada = textoEntrada.slice(0, MAX_CHARS_SOLO_TTS);
    }

    let director = null;
    let recorte;

    if (soloTts) {
      // Path rápido: el cliente ya partió el speech; no director ni condensar.
      recorte = {
        texto: textoEntrada,
        recortado: false,
        palabras: textoEntrada.split(/\s+/).filter(Boolean).length,
        adaptado: false,
      };
    } else {
      if (!esOwner || textoEntrada.length < 400) {
        try {
          director = await dirigirEscena(textoEntrada.slice(0, 900), { modalidad: 'voz' });
        } catch (err) {
          console.warn('director voz:', err?.message || err);
        }
      }
      const guia = briefAGuiaOral(director);
      const textoParaVoz = !esOwner && guia && guia.length > 40 && textoEntrada.length < 120
        ? `${textoEntrada}\n\n(Contexto semántico: ${director?.resumen_es || ''})`.trim()
        : textoEntrada;

      recorte = esOwner
        ? {
            texto: textoParaVoz,
            recortado: false,
            palabras: textoParaVoz.split(/\s+/).filter(Boolean).length,
            adaptado: false,
          }
        : await condensarTextoParaToma(textoParaVoz, maxSeg, process.env.GROQ_API_KEY || '');
    }

    if (!recorte.texto) {
      return jsonResponse({ error: 'Escribe el texto que quieres convertir a voz.' }, 400);
    }

    const estilo = String(body.voz || body.estilo || 'femenina').toLowerCase();
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';
    const vozGemini = VOCES_GEMINI[estilo] || VOCES_GEMINI.femenina;
    const vozGroq = VOCES_GROQ[estilo] || VOCES_GROQ.femenina;

    let ttsOpts;
    let geminiOpts;
    if (soloTts) {
      ttsOpts = { completo: true, soloTts: true, timeoutMs: TIMEOUT_GROQ_CHUNK_MS };
      geminiOpts = { completo: true, soloTts: true, timeoutMs: TIMEOUT_GEMINI_CHUNK_MS };
    } else if (esOwner) {
      ttsOpts = { completo: true, timeoutMs: TIMEOUT_GROQ_OWNER_MS };
      geminiOpts = { completo: true, timeoutMs: TIMEOUT_GEMINI_OWNER_MS };
    } else {
      ttsOpts = {};
      geminiOpts = {};
    }

    const detalles = [];
    let audio = null;
    if (groqKey) {
      const groqRes = await ttsGroq(groqKey, recorte.texto, vozGroq, ttsOpts);
      if (groqRes.audio) audio = groqRes.audio;
      else if (groqRes.detalle) detalles.push(`groq: ${groqRes.detalle}`);
    } else {
      detalles.push('groq: GROQ_API_KEY ausente en este runtime');
    }
    if (!audio && geminiKey) {
      const gemRes = await ttsGemini(geminiKey, recorte.texto, vozGemini, geminiOpts);
      if (gemRes.audio) audio = gemRes.audio;
      else if (gemRes.detalle) detalles.push(`gemini: ${gemRes.detalle}`);
    } else if (!audio && !geminiKey) {
      detalles.push('gemini: GEMINI_API_KEY ausente en este runtime');
    }

    if (!audio) {
      const detalleProveedor = detalles.filter(Boolean).join(' · ') || 'sin detalle';
      return jsonResponse({
        error: esOwner
          ? 'No se pudo generar la voz completa. Revisa el detalle del proveedor o reintenta el chunk.'
          : 'No se pudo generar la voz. Revisa el detalle del proveedor o intenta de nuevo.',
        detalle_proveedor: detalleProveedor.slice(0, 600),
        solo_tts: soloTts,
        chunkIndex,
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
      maxSeg: Number.isFinite(maxSeg) ? maxSeg : null,
      sin_limite_duracion: esOwner,
      palabras: recorte.palabras,
      fuente: String(audio.modelo || '').includes('gemini') ? 'gemini' : 'groq',
      solo_tts: soloTts,
      chunkIndex,
      chunkTotal: chunkTotal || undefined,
      chunk_chars: CHUNK_CHARS_VOZ,
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
        error: 'La generación de voz tardó demasiado en este bloque. Reintenta; con chunks cortos suele completar.',
        detalle_proveedor: msg.slice(0, 200),
      }, 504);
    }
    return jsonResponse({ error: msg }, 500);
  }
};
