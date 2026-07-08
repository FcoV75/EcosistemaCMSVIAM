import {
  FRECUENCIAS_SOLFEGGIO,
  ONDAS_CEREBRALES,
  elegirPistaCatalogo,
  normalizarDiagnostico,
  parsearRespuestaIA,
} from './lib/nexus-frequencies.mjs';
import { consumeRateLimit, getClientIp, hashIp } from './lib/rate-limit.mjs';

const SYSTEM_PROMPT = `Eres Sincronía Nexus, acompañante emocional del Ecosistema CMS VIAM (versión pública de muestra).

Tu voz es cálida, amorosa y serena. Filosofía: amor consciente + estoicismo suave. Nunca menciones Groq ni proveedores técnicos. Firma conceptual: "Sincronía Nexus te sugiere".

Analiza las respuestas del formulario del usuario. Ofrece consejo profundo, aplicable y esperanzador (2-4 párrafos).

Elige frecuencia Solfeggio: 174, 285, 417, 528, 639, 741, 852, 963 Hz según su estado.
Opcional: onda cerebral delta, theta o alpha.

Responde ÚNICAMENTE JSON válido (sin markdown):
{
  "respuesta": "Texto cálido para el usuario",
  "frecuencia_hz": 528,
  "frecuencia_etiqueta": "Amor y paz",
  "onda_cerebral": null,
  "fuente_audio": "catalogo",
  "diagnostico_breve": "Estado emocional en una línea"
}`;

const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const PUBLIC_CHAT_LIMIT = 10;

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
        temperature: 0.65,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() },
        ],
      }),
    });

    let aiData = null;
    try {
      aiData = await groqResponse.json();
    } catch (parseErr) {
      console.error('Groq public chat parse:', model, parseErr);
      continue;
    }

    if (!groqResponse.ok) {
      console.error('Groq public chat:', model, aiData);
      continue;
    }

    const rawText = aiData?.choices?.[0]?.message?.content?.trim();
    if (rawText) return rawText;
  }

  return null;
}

async function enforcePublicRateLimit(req) {
  try {
    const ip = hashIp(getClientIp(req));
    const limit = await consumeRateLimit(`nexus-public-chat:${ip}`, PUBLIC_CHAT_LIMIT, 86400000);
    if (!limit.allowed) {
      return Response.json(
        {
          error:
            'Has alcanzado el límite de consultas gratuitas de hoy. Vuelve mañana o conviértete en miembro de Sincronía Nexus.',
        },
        { status: 429 },
      );
    }
  } catch (rateErr) {
    console.warn('chat rate-limit skip:', rateErr);
  }
  return null;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const rateResponse = await enforcePublicRateLimit(req);
    if (rateResponse) return rateResponse;

    const { message } = await req.json();
    if (!message?.trim()) {
      return Response.json({ error: 'Mensaje vacío.' }, { status: 400 });
    }

    const apiKey = groqKey();
    if (!apiKey) {
      return Response.json({ error: 'IA no configurada (GROQ_API_KEY).' }, { status: 503 });
    }

    const rawText = await consultarGroq(apiKey, message);
    if (!rawText) {
      return Response.json(
        { error: 'Sincronía Nexus no pudo responder en este momento. Intenta de nuevo en unos minutos.' },
        { status: 502 },
      );
    }

    const parsed = parsearRespuestaIA(rawText);
    const diag = normalizarDiagnostico(parsed);
    const semilla = `public:${Date.now()}:${message.trim().slice(0, 30)}`;
    const pista = elegirPistaCatalogo(diag.frecuenciaHz, semilla);
    const freqInfo = FRECUENCIAS_SOLFEGGIO[diag.frecuenciaHz];
    const ondaInfo = diag.ondaCerebral ? ONDAS_CEREBRALES[diag.ondaCerebral] : null;

    return Response.json({
      reply: parsed.respuesta || rawText,
      frecuenciaHz: diag.frecuenciaHz,
      frecuenciaEtiqueta: diag.frecuenciaEtiqueta,
      frecuenciaProposito: freqInfo?.proposito || '',
      ondaCerebral: diag.ondaCerebral,
      ondaEtiqueta: ondaInfo?.etiqueta || null,
      audioUrl: pista?.url || null,
      tituloPista: pista?.titulo || '',
      diagnosticoBreve: diag.diagnosticoBreve,
    });
  } catch (err) {
    console.error('chat:', err);
    return Response.json({ error: 'Error al procesar tu solicitud.' }, { status: 500 });
  }
};
