import { getStore } from '@netlify/blobs';
import { esCodigoPropietario, esMembresiaPermanente, estadoMembresia } from './lib/member-helpers.mjs';

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

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, message } = await req.json();
    if (!code || !message?.trim()) {
      return Response.json({ error: 'Faltan datos (código o mensaje).' }, { status: 400 });
    }

    const normalized = String(code).trim().toUpperCase();
    const membersStore = getStore('nexus-members');
    let memberData = await membersStore.get(normalized, { type: 'json' });

    if (!memberData && !esCodigoPropietario(normalized)) {
      return Response.json({ error: 'Membresía no encontrada.' }, { status: 404 });
    }

    if (!memberData && esCodigoPropietario(normalized)) {
      memberData = { producto: 'video_diamante_premium', plan: 'propietario', usage: {} };
    }

    if (memberData.producto && memberData.producto !== 'video_diamante_premium') {
      return Response.json({ error: 'Este código no es de Video Diamante Premium.' }, { status: 403 });
    }

    const estado = estadoMembresia(normalized, memberData);
    if (estado.status === 'expired') {
      return Response.json({ error: 'Tu membresía Premium expiró. Renueva tu plan.' }, { status: 403 });
    }

    const esPermanente = esMembresiaPermanente(normalized, memberData);

    const today = new Date().toISOString().split('T')[0];
    if (!memberData.usage) memberData.usage = {};
    const chatKey = `vd_chat_${today}`;
    const usageToday = memberData.usage[chatKey] || 0;
    if (!esPermanente && usageToday >= 15) {
      return Response.json({
        error: 'Límite diario del asistente alcanzado (15 consultas). Vuelve mañana o revisa la guía instructiva.',
      }, { status: 429 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return Response.json({ error: 'Asistente IA no configurado (GROQ_API_KEY).' }, { status: 503 });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() },
        ],
        temperature: 0.4,
      }),
    });

    const aiData = await groqResponse.json();
    if (!groqResponse.ok) {
      console.error('Groq Video Diamante:', aiData);
      return Response.json({ error: 'Error al contactar al asistente IA.' }, { status: 502 });
    }

    if (!esPermanente) {
      memberData.usage[chatKey] = usageToday + 1;
      await membersStore.setJSON(normalized, memberData);
    }

    return Response.json({
      reply: aiData.choices[0].message.content,
      consultasRestantes: esPermanente ? null : Math.max(0, 15 - (usageToday + 1)),
    });
  } catch (err) {
    console.error('video-diamante-guia:', err);
    return Response.json({ error: 'Error interno del asistente.' }, { status: 500 });
  }
};
