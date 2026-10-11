import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { expandirPromptVisual, seedDesdePrompt } from './lib/estudio-prompt-visual.mjs';
import { generarImagenEstudio } from './lib/estudio-imagen-gen.mjs';
import { ndjsonEstudioResponse } from './lib/estudio-ndjson.mjs';

/** Presupuesto wall-clock dentro del timeout Netlify (90–120 s). */
const BUDGET_IMAGEN_MS = 78000;

export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'estudio',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400);
  }

  const inicio = Date.now();
  return ndjsonEstudioResponse(
    async (write) => {
      const prompt = String(body.prompt || '').trim();
      if (!prompt) return { success: false, error: 'Describe la imagen.' };

      write({ type: 'status', msg: 'Entendiendo tu escena…' });
      const expansion = await expandirPromptVisual(prompt, { modo: 'imagen' });
      const promptEn = expansion.promptEn;

      const left = () => Math.max(0, BUDGET_IMAGEN_MS - (Date.now() - inicio));
      if (left() < 8000) {
        return {
          success: false,
          error: 'Se agotó el tiempo antes de generar la imagen. Intenta de nuevo.',
        };
      }

      write({ type: 'status', msg: 'La IA está pintando tu escena…' });
      const imagen = await generarImagenEstudio(promptEn, {
        width: 1920,
        height: 1080,
        seed: seedDesdePrompt(prompt),
        original: prompt,
        softDeadlineMs: inicio + BUDGET_IMAGEN_MS,
        timeoutMs: Math.min(28000, Math.max(12000, left() - 10000)),
        onStatus: (msg) => write({ type: 'status', msg: String(msg || '') }),
      });

      if (!imagen?.imagen_base64) {
        return {
          success: false,
          error: 'No se pudo generar la imagen a tiempo. Vuelve a intentar en unos segundos.',
        };
      }

      const dir = expansion.director;
      return {
        success: true,
        tipo: 'imagen',
        imagen_base64: imagen.imagen_base64,
        mime: imagen.mime,
        fuente: imagen.fuente,
        marca_agua_pollinations: !!imagen.marca_agua_pollinations,
        resumen: expansion.resumen || '',
        prompt_en: promptEn.slice(0, 500),
        via_prompt: expansion.via || '',
        director: dir
          ? {
              intencion: dir.intencion,
              inferencias: dir.inferencias?.slice(0, 4) || [],
              resumen_es: dir.resumen_es,
              via: dir.via,
            }
          : null,
      };
    },
    { statusInicial: 'Conectando con el Estudio VIAM…', pingMs: 3000 },
  );
};
