import { getUserFromBearer } from './lib/supabase-admin.mjs';
import { esCodigoPropietarioNexus, estadoMembresia } from './lib/member-helpers.mjs';
import { obtenerMiembro, tieneAccesoNexus } from './lib/comprobante-helpers.mjs';
import { consumeRateLimit, getClientIp, hashIp } from './lib/rate-limit.mjs';

function json(body, status = 200) {
  return Response.json(body, { status });
}

async function puedeUsarVoz(req, code) {
  const user = await getUserFromBearer(req);
  const normalized = code ? String(code).trim().toUpperCase() : null;
  if (normalized && esCodigoPropietarioNexus(normalized)) return { ok: true };
  const resuelto = await obtenerMiembro(normalized, user?.id);
  const clave = resuelto.normalized || normalized || (user?.id ? `USER-${user.id}` : null);
  if (!resuelto.memberData || !clave) return { ok: false, error: 'Santuario no encontrado.', status: 404 };
  if (!tieneAccesoNexus(clave, resuelto.memberData)) {
    return { ok: false, error: 'Este acceso no tiene Sincronía Nexus.', status: 403 };
  }
  if (estadoMembresia(clave, { ...resuelto.memberData, producto: 'sincronia_nexus' }).status === 'expired') {
    return { ok: false, error: 'Membresía concluida.', status: 403 };
  }
  return { ok: true, clave };
}

async function transcribirGroq(audio, groqKey) {
  const modelos = ['whisper-large-v3-turbo', 'whisper-large-v3'];
  let ultimo = 'Sin respuesta';
  for (const modelo of modelos) {
    const upstream = new FormData();
    upstream.append('file', audio, audio.name || 'organo.webm');
    upstream.append('model', modelo);
    upstream.append('language', 'es');
    upstream.append('response_format', 'json');
    upstream.append('temperature', '0');
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: upstream,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: { message: await response.text() } };
    }
    if (response.ok && data.text) {
      return { texto: String(data.text).trim(), fuente: modelo };
    }
    ultimo = data.error?.message || JSON.stringify(data);
    if (response.status < 500) break;
  }
  return { error: ultimo };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return json({ error: 'GROQ_API_KEY no configurada.' }, 503);

    const contentType = req.headers.get('content-type') || '';
    let audio = null;
    let code = null;
    let publico = false;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      audio = form.get('audio');
      code = form.get('code');
      publico = String(form.get('publico') || '') === '1';
    } else {
      return json({ error: 'Usa multipart con el campo audio. El crudo no se persiste.' }, 400);
    }

    if (!audio || typeof audio === 'string') return json({ error: 'No llegó audio.' }, 400);
    if (typeof audio.size === 'number' && audio.size > 1.6 * 1024 * 1024) {
      return json({ error: 'Audio demasiado largo para el órgano (máx. ~60 s).' }, 413);
    }

    if (!publico) {
      const acceso = await puedeUsarVoz(req, code);
      if (!acceso.ok) return json({ error: acceso.error }, acceso.status);
    } else {
      const limit = await consumeRateLimit(`nexus-organo-stt:${hashIp(getClientIp(req))}`, 3, 86400000);
      if (!limit.allowed) {
        return json({ error: 'Límite de voz pública por hoy. Entra al Santuario para seguir hablando.' }, 429);
      }
    }

    const result = await transcribirGroq(audio, groqKey);
    if (result.error) return json({ error: `No pude oírte: ${result.error}` }, 502);

    return json({
      success: true,
      texto: result.texto,
      fuente: result.fuente,
      persistido: false,
      aviso: 'La transcripción se usa en este turno y no se guarda el audio.',
    });
  } catch (err) {
    console.error('organo-transcribe:', err);
    return json({ error: 'Error al escuchar.' }, 500);
  }
};
