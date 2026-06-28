import {
  FRECUENCIAS_SOLFEGGIO,
  ONDAS_CEREBRALES,
  elegirPistaCatalogo,
  normalizarDiagnostico,
  parsearRespuestaIA,
} from './lib/nexus-frequencies.mjs';

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

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { message } = await req.json();
    if (!message?.trim()) {
      return Response.json({ error: 'Mensaje vacío.' }, { status: 400 });
    }

    const apiKey = groqKey();
    if (!apiKey) {
      return Response.json({ error: 'IA no configurada (GROQ_API_KEY).' }, { status: 503 });
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
      console.error('Groq public chat:', aiData);
      return Response.json({ error: 'Sincronía Nexus no pudo responder en este momento.' }, { status: 502 });
    }

    const rawText = aiData.choices[0].message.content;
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
      audioUrl: pista.url,
      tituloPista: pista.titulo,
      diagnosticoBreve: diag.diagnosticoBreve,
    });
  } catch (err) {
    console.error('chat:', err);
    return Response.json({ error: 'Error al procesar tu solicitud.' }, { status: 500 });
  }
};
