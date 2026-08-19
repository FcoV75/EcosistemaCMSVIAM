import { getStore } from '@netlify/blobs';
import {
  esCodigoPropietarioVideoDiamante,
  esMembresiaPermanente,
  estadoMembresia,
  miembroTieneProducto,
} from './lib/member-helpers.mjs';
import { obtenerMiembro } from './lib/comprobante-helpers.mjs';
import { getUserFromBearer } from './lib/supabase-admin.mjs';

const SYSTEM_PROMPT = `Eres el Asistente IA VIAM de Video Diamante, experto en producción de videoclips musicales y contenido multimedia del Ecosistema CMS VIAM.

Ayudas a miembros Premium a crear videos con:
- Audio MP3 (desde 10 segundos hasta 1 hora en plan Premium; gratuito hasta 4 min)
- Portada y cierre con leyendas personalizables
- Pizarra multimedia (imágenes y videos MP4 alternados)
- Subtítulos karaoke sincronizados con transcripción IA (Groq Whisper)
- Tipografía configurable (S a XXL)
- Estudio VIAM Creativo (imágenes y letras con IA)
- Render en la nube vía Railway

Instrucciones:
- Responde en español, claro, amable y profesional.
- Da pasos concretos y numerados cuando expliques un flujo.
- Si preguntan por límites Premium: 10 renders/día, 20 generaciones Estudio IA/día, videos 10 s–1 h, sin límite práctico de imágenes/videos en pizarra, pueden quitar marca de agua. Gratuito: 3 imgs, 2 videos, 4 min máx.
- Recomienda MP3 para audio, re-transcribir antes de render para karaoke sincronizado, y escala XXL para móvil/TV.
- No inventes funciones que no existen (lip sync aún no está disponible).
- Sé breve salvo que pidan detalle.`;

const GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];

function groqKey() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env?.get) {
      return Netlify.env.get('GROQ_API_KEY') || '';
    }
  } catch {
    /* ignore */
  }
  return process.env.GROQ_API_KEY || '';
}

async function consultarGroq(apiKey, message) {
  for (const model of GROQ_MODELS) {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() },
        ],
        temperature: 0.4,
      }),
    });

    let aiData = null;
    try {
      aiData = await groqResponse.json();
    } catch {
      continue;
    }

    if (!groqResponse.ok) {
      console.error('Groq Video Diamante:', model, aiData);
      continue;
    }

    const reply = aiData?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  }

  return null;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, message } = await req.json();
    if (!message?.trim()) {
      return Response.json({ error: 'Faltan datos (mensaje).' }, { status: 400 });
    }

    const user = await getUserFromBearer(req);
    const normalized = code ? String(code).trim().toUpperCase() : null;

    if ((!normalized || normalized.length < 5) && !user) {
      return Response.json(
        { error: 'Ingresa tu código CMS-XXXXXX o inicia sesión en Mi Ecosistema.' },
        { status: 400 },
      );
    }

    let memberData = null;
    let clave = normalized;

    if (normalized && esCodigoPropietarioVideoDiamante(normalized)) {
      memberData = { producto: 'video_diamante_premium', plan: 'propietario', usage: {} };
    } else {
      const resuelto = await obtenerMiembro(normalized, user?.id);
      memberData = resuelto.memberData;
      clave = resuelto.normalized || normalized || (user?.id ? `USER-${user.id}` : null);

      if (!memberData && normalized) {
        const membersStore = getStore('nexus-members');
        memberData = await membersStore.get(normalized, { type: 'json' });
      }
    }

    if (!memberData) {
      return Response.json({ error: 'Membresía no encontrada.' }, { status: 404 });
    }

    if (
      memberData.producto &&
      memberData.producto !== 'video_diamante_premium' &&
      !miembroTieneProducto(memberData, 'video_diamante_premium')
    ) {
      return Response.json({ error: 'Este código no es de Video Diamante Premium.' }, { status: 403 });
    }

    const estado = estadoMembresia(clave, { ...memberData, producto: 'video_diamante_premium' });
    if (estado.status === 'expired') {
      return Response.json({ error: 'Tu membresía Premium expiró. Renueva tu plan.' }, { status: 403 });
    }

    const esPermanente = esMembresiaPermanente(clave, memberData);
    const membersStore = getStore('nexus-members');
    const today = new Date().toISOString().split('T')[0];
    const usageKey = clave || normalized;

    let datosUso = { ...memberData };
    if (usageKey) {
      const blobExistente = await membersStore.get(usageKey, { type: 'json' });
      if (blobExistente?.usage) {
        datosUso = { ...datosUso, usage: { ...blobExistente.usage } };
      }
    }
    if (!datosUso.usage) datosUso.usage = {};

    const chatKey = `vd_chat_${today}`;
    const usageToday = datosUso.usage[chatKey] || 0;
    if (!esPermanente && usageToday >= 15) {
      return Response.json({
        error: 'Límite diario del asistente alcanzado (15 consultas). Vuelve mañana o revisa la guía instructiva.',
      }, { status: 429 });
    }

    const apiKey = groqKey();
    if (!apiKey) {
      return Response.json({ error: 'Asistente IA no configurado (GROQ_API_KEY).' }, { status: 503 });
    }

    const reply = await consultarGroq(apiKey, message);
    if (!reply) {
      return Response.json({ error: 'Error al contactar al asistente IA.' }, { status: 502 });
    }

    if (!esPermanente && usageKey) {
      datosUso.usage[chatKey] = usageToday + 1;
      await membersStore.setJSON(usageKey, {
        ...datosUso,
        producto: memberData.producto || 'video_diamante_premium',
        startDate: memberData.startDate || Date.now(),
        durationDays: memberData.durationDays || 30,
      });
    }

    return Response.json({
      reply,
      consultasRestantes: esPermanente ? null : Math.max(0, 15 - (usageToday + 1)),
    });
  } catch (err) {
    console.error('video-diamante-guia:', err);
    return Response.json({ error: 'Error interno del asistente.' }, { status: 500 });
  }
};
