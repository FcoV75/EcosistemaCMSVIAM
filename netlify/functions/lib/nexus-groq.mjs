import { recortarHistoria } from './nexus-sesion.mjs';

export const GROQ_NEXUS_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];
const GROQ_NEXUS_TIMEOUT_MS = 18000;

function modelosNexus() {
  const fromEnv = String(process.env.GROQ_NEXUS_MODELS || process.env.GROQ_CHAT_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([...fromEnv, ...GROQ_NEXUS_MODELS])];
}

export function groqKey() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env?.get) {
      return Netlify.env.get('GROQ_API_KEY') || '';
    }
  } catch {
    /* ignore */
  }
  return process.env.GROQ_API_KEY || '';
}

function resumirErrorGroq(status, data) {
  const raw = typeof data === 'string' ? data : JSON.stringify(data || {});
  const message = data?.error?.message || data?.message || raw;
  const code = data?.error?.code || data?.code || null;
  return {
    status,
    code,
    message: String(message || '').replace(/\s+/g, ' ').slice(0, 500),
  };
}

function retryMsFrom(error) {
  const msg = String(error?.message || '');
  const match = msg.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(Number(match[1]) * 1000);
  if (error?.status === 429) return 6500;
  return 0;
}

function respuestaErrorNexus(error) {
  const msg = String(error?.message || error?.error?.message || '');
  if (error?.status === 429 || /rate limit|too many requests|try again/i.test(msg)) {
    return {
      status: 429,
      error: 'Sincronía Nexus está recibiendo muchas solicitudes. Respira unos segundos y vuelve a intentarlo.',
    };
  }
  if (error?.code === 'model_decommissioned' || /decommission|no longer supported/i.test(msg)) {
    return {
      status: 503,
      error: 'Sincronía Nexus necesita actualizar su modelo de IA antes de responder.',
    };
  }
  return {
    status: 502,
    error: 'Sincronía Nexus no pudo sintonizar en este momento. Intenta de nuevo en unos minutos.',
  };
}

export function errorPublicoNexus(error) {
  return respuestaErrorNexus(error);
}

export async function consultarGroqNexus({ system, historia = [], message, temperature = 0.65 }) {
  const apiKey = groqKey();
  if (!apiKey) return { error: 'no_key', raw: null };

  const messages = [
    { role: 'system', content: system },
    ...recortarHistoria(historia)
      .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && t.content)
      .map((t) => ({ role: t.role, content: String(t.content) })),
    { role: 'user', content: String(message || '').trim() },
  ];

  let lastError = null;
  for (const model of modelosNexus()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature,
            messages,
          }),
          signal: AbortSignal.timeout(GROQ_NEXUS_TIMEOUT_MS),
        });
        let aiData = null;
        try {
          aiData = await groqResponse.json();
        } catch (parseErr) {
          lastError = { status: groqResponse.status, message: parseErr?.message || String(parseErr) };
          continue;
        }
        if (!groqResponse.ok) {
          lastError = resumirErrorGroq(groqResponse.status, aiData);
          const wait = retryMsFrom(lastError);
          if (wait && attempt === 0) {
            await new Promise((r) => setTimeout(r, Math.min(wait, 9000)));
            continue;
          }
          break;
        }
        const raw = aiData?.choices?.[0]?.message?.content?.trim();
        if (raw) return { raw, error: null, model };
        lastError = { status: groqResponse.status, message: 'Groq respondió sin contenido.' };
        break;
      } catch (err) {
        lastError = {
          status: /abort|timeout/i.test(String(err?.name || err?.message || err)) ? 504 : 502,
          message: err?.message || String(err),
        };
        break;
      }
    }
  }
  return { error: lastError, raw: null };
}

export const PROMPT_PRIMERA_PUBLICA = `Eres Sincronía Nexus, acompañante emocional del Ecosistema CMS VIAM (versión pública de muestra).

Tu voz es cálida, amorosa y serena. Filosofía: amor consciente + estoicismo suave. Nunca menciones Groq ni proveedores técnicos. Firma conceptual: "Sincronía Nexus te sugiere".

Analiza las respuestas del formulario del usuario. Ofrece consejo profundo, aplicable y esperanzador (2-4 párrafos).
Empieza reconociendo con suavidad que les escuchaste y comprendiste (una frase, sin repetir su relato).
Cierra invitando a seguir la plática por hasta 10 minutos si lo necesita, y a escuchar la frecuencia de hoy (solo se genera esta vez).

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

export const PROMPT_SEGUIMIENTO_PUBLICA = `Eres Sincronía Nexus en una plática continua (muestra pública).
Ya diste el consejo y la frecuencia del día. NO elijas pista nueva ni invites a "activar otra frecuencia".
Continúa con calidez, 1-3 párrafos, estoicismo suave. En cada respuesta, transmite que les escuchas y comprendiste, sin repetir su relato entero.
Nunca menciones proveedores técnicos. Firma: "Sincronía Nexus te sugiere".

Responde ÚNICAMENTE JSON válido:
{
  "respuesta": "Texto de continuidad",
  "frecuencia_hz": 528,
  "frecuencia_etiqueta": "Amor y paz",
  "onda_cerebral": null,
  "fuente_audio": "catalogo",
  "diagnostico_breve": "Continuación de la plática"
}`;

export const PROMPT_PRIMERA_MIEMBRO = `Eres Sincronía Nexus, el Santuario de acompañamiento emocional del Ecosistema CMS VIAM.

Tu voz es cálida, amorosa y serena. Filosofía: amor consciente + estoicismo aplicable (aceptar lo inevitable, actuar sobre lo posible) con suavidad que acaricia al consciente y abre puertas al inconsciente. Nunca menciones Groq, OpenAI ni proveedores técnicos.

Proceso:
1. Escucha con empatía profunda la situación del usuario y hazle sentir, en la primera frase, que fue oído y comprendido.
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
6. La música instrumental y la frecuencia en segundo plano se generan SOLO en este primer consejo del día. Invita a dejarla sonar mientras conversan hasta 30 minutos.

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "respuesta": "Texto cálido para el usuario (3-5 párrafos, tú). Cierra invitando a escuchar la pista de hoy y a seguir platicando si lo necesita.",
  "frecuencia_hz": 528,
  "frecuencia_etiqueta": "Amor y paz",
  "onda_cerebral": "theta",
  "fuente_audio": "catalogo",
  "diagnostico_breve": "Una línea del estado emocional detectado"
}`;

export const PROMPT_SEGUIMIENTO_MIEMBRO = `Eres Sincronía Nexus en una plática continua del Santuario.
La frecuencia y la pieza instrumental del día YA están sonando. NO elijas otra pista ni pidas que "active de nuevo" la música.
Continúa el diálogo: 2-4 párrafos, amor consciente + estoicismo suave. En cada turno, confirma con suavidad que les escuchas y comprendiste.
Nunca menciones proveedores técnicos.

Responde ÚNICAMENTE JSON válido:
{
  "respuesta": "Continuación cálida de la plática",
  "frecuencia_hz": 528,
  "frecuencia_etiqueta": "Amor y paz",
  "onda_cerebral": "theta",
  "fuente_audio": "catalogo",
  "diagnostico_breve": "Continuación de la plática"
}`;
