import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { expandirPromptVisual, seedDesdePrompt } from './lib/estudio-prompt-visual.mjs';
import { generarImagenEstudio } from './lib/estudio-imagen-gen.mjs';

export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'estudio',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const { prompt } = await req.json();
    if (!prompt?.trim()) return jsonResponse({ error: 'Describe la imagen.' }, 400);

    const expansion = await expandirPromptVisual(prompt, { modo: 'imagen' });
    const promptEn = expansion.promptEn;
    const imagen = await generarImagenEstudio(promptEn, {
      width: 1920,
      height: 1080,
      seed: seedDesdePrompt(prompt),
      original: prompt,
    });
    if (!imagen) return jsonResponse({ error: 'Fallo al generar imagen.' }, 502);

    const dir = expansion.director;
    return jsonResponse({
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
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
};
