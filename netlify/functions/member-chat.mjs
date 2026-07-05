import { getStore } from '@netlify/blobs';
import {
  esCodigoPropietarioNexus,
  esMembresiaPermanente,
  estadoMembresia,
} from './lib/member-helpers.mjs';
import { obtenerMiembro, tieneAccesoNexus } from './lib/comprobante-helpers.mjs';
import { getUserFromBearer } from './lib/supabase-admin.mjs';
import {
  FRECUENCIAS_SOLFEGGIO,
  ONDAS_CEREBRALES,
  elegirPistaCatalogo,
  normalizarDiagnostico,
  parsearRespuestaIA,
} from './lib/nexus-frequencies.mjs';

const SYSTEM_PROMPT = `Eres Sincronía Nexus, el Santuario de acompañamiento emocional del Ecosistema CMS VIAM.

Tu voz es cálida, amorosa y serena. Filosofía: amor consciente + estoicismo aplicable (aceptar lo inevitable, actuar sobre lo posible) con suavidad que acaricia al consciente y abre puertas al inconsciente. Nunca menciones Groq, OpenAI ni proveedores técnicos.

Proceso:
1. Escucha con empatía profunda la situación del usuario.
2. Formula un diagnóstico emocional breve (raíz simbólica, no clínico).
3. Ofrece consejos meditados, aplicables y esperanzadores — con disciplina amable, no sermones fríos.
4. Elige la frecuencia Solfeggio más adecuada según su estado:
   - 174 Hz: dolor físico/emocional, tensión
   - 285 Hz: sanación, regeneración
   - 417 Hz: bloqueos, miedo al cambio, transformación
   - 528 Hz: estrés, necesidad de paz y amor propio
   - 639 Hz: relaciones, empatía, unión
   - 741 Hz: confusión mental, necesidad de claridad
   - 852 Hz: intuición, despertar interior
   - 963 Hz: conexión espiritual, propósito, unidad
5. Opcional: onda cerebral complementaria (delta=sueño reparador, theta=meditación, alpha=relajación profunda).
6. Decide fuente_audio ("catalogo" o "generada") según qué capa de frecuencia subconsciente conviene — en ambos casos el usuario escuchará una pieza instrumental del catálogo; la frecuencia va en segundo plano a bajo volumen.

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "respuesta": "Texto cálido para el usuario (3-5 párrafos, tú). Cierra invitando a escuchar la pista y practicar el consejo con paciencia.",
  "frecuencia_hz": 528,
  "frecuencia_etiqueta": "Amor y paz",
  "onda_cerebral": "theta",
  "fuente_audio": "catalogo",
  "diagnostico_breve": "Una línea del estado emocional detectado"
}`;

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

function claveUso(memberData, normalized, userId) {
  return memberData?.legacy_code || normalized || (userId ? `USER-${userId}` : null);
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, message } = await req.json();
    if (!message?.trim()) {
      return Response.json({ error: 'Falta tu mensaje para el Santuario.' }, { status: 400 });
    }

    const user = await getUserFromBearer(req);
    const normalized = code ? String(code).trim().toUpperCase() : null;

    if ((!normalized || normalized.length < 5) && !user) {
      return Response.json({ error: 'Ingresa tu código CMS-XXXXXX o inicia sesión en Mi Ecosistema.' }, { status: 400 });
    }

    if (normalized && esCodigoPropietarioNexus(normalized)) {
      const memberData = { producto: 'sincronia_nexus', plan: 'propietario', usage: {}, permanent: true };
      const estado = estadoMembresia(normalized, memberData);
      if (estado.status === 'expired') {
        return Response.json({ error: 'Tu membresía ha concluido. Renueva para continuar en el Santuario.' }, { status: 403 });
      }
      return await procesarChat(normalized, memberData, message, true);
    }

    const resuelto = await obtenerMiembro(normalized, user?.id);
    let memberData = resuelto.memberData;
    const clave = resuelto.normalized || normalized || claveUso(memberData, null, user?.id);

    if (!memberData || !clave) {
      return Response.json({ error: 'Membresía no encontrada. Usa tu código o inicia sesión.' }, { status: 404 });
    }

    if (!tieneAccesoNexus(clave, memberData)) {
      return Response.json({ error: 'Este acceso no tiene Sincronía Nexus activa.' }, { status: 403 });
    }

    const estado = estadoMembresia(clave, { ...memberData, producto: 'sincronia_nexus' });
    if (estado.status === 'expired') {
      return Response.json({ error: 'Tu membresía ha concluido. Renueva para continuar en el Santuario.' }, { status: 403 });
    }

    const esPermanente = esMembresiaPermanente(clave, memberData);
    return await procesarChat(clave, memberData, message, esPermanente);
  } catch (err) {
    console.error('member-chat:', err);
    return Response.json({ error: 'Ocurrió un error interno en el Santuario.' }, { status: 500 });
  }
};

async function procesarChat(clave, memberData, message, esPermanente) {
  const store = getStore('nexus-members');
  const today = new Date().toISOString().split('T')[0];

  let datosUso = memberData;
  if (!datosUso.usage) datosUso.usage = {};

  const blobExistente = await store.get(clave, { type: 'json' });
  if (blobExistente?.usage) {
    datosUso = { ...datosUso, usage: { ...blobExistente.usage } };
  }

  const usageToday = datosUso.usage[today] || 0;
  if (!esPermanente && usageToday >= 3) {
    return Response.json({
      error: 'Has alcanzado el límite de 3 conversaciones diarias. Date tiempo para integrar los consejos de hoy; mañana el Santuario te esperará de nuevo.',
    }, { status: 429 });
  }

  const apiKey = groqKey();
  if (!apiKey) {
    return Response.json({ error: 'El Santuario no está configurado (GROQ_API_KEY).' }, { status: 503 });
  }

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.65,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message.trim() },
      ],
    }),
  });

  const aiData = await groqResponse.json();
  if (!groqResponse.ok) {
    console.error('Groq Nexus:', aiData);
    return Response.json({ error: 'Sincronía Nexus no pudo sintonizar en este momento. Intenta de nuevo.' }, { status: 502 });
  }

  const rawText = aiData.choices[0].message.content;
  const parsed = parsearRespuestaIA(rawText);
  const diag = normalizarDiagnostico(parsed);
  const semilla = `${clave}:${today}:${message.trim().slice(0, 40)}`;

  const pista = elegirPistaCatalogo(diag.frecuenciaHz, semilla);
  const freqInfo = FRECUENCIAS_SOLFEGGIO[diag.frecuenciaHz];
  const ondaInfo = diag.ondaCerebral ? ONDAS_CEREBRALES[diag.ondaCerebral] : null;

  if (!esPermanente) {
    datosUso.usage[today] = usageToday + 1;
    await store.setJSON(clave, {
      ...datosUso,
      producto: memberData.producto || 'sincronia_nexus',
      startDate: memberData.startDate || Date.now(),
      durationDays: memberData.durationDays || 30,
    });
  }

  return Response.json({
    reply: parsed.respuesta || rawText,
    frecuenciaHz: diag.frecuenciaHz,
    frecuenciaEtiqueta: diag.frecuenciaEtiqueta,
    frecuenciaProposito: freqInfo?.proposito || '',
    ondaCerebral: diag.ondaCerebral,
    ondaEtiqueta: ondaInfo?.etiqueta || null,
    fuenteAudio: diag.fuenteAudio,
    diagnosticoBreve: diag.diagnosticoBreve,
    audioUrl: pista.url,
    tituloPista: pista.titulo,
    consultasRestantes: esPermanente ? null : Math.max(0, 3 - (usageToday + 1)),
  });
}
