import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { expandirPromptVisual, promptImagenReforzado } from './lib/estudio-prompt-visual.mjs';
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
    const imagen = await generarImagenEstudio(promptImagenReforzado(expansion.promptEn, prompt), {
      width: 1920,
      height: 1080,
      seed: Date.now() % 99999,
    });
    if (!imagen) return jsonResponse({ error: 'Fallo al generar imagen.' }, 502);

    return jsonResponse({
      success: true,
      imagen_base64: imagen.imagen_base64,
      mime: imagen.mime,
      fuente: imagen.fuente,
      resumen: expansion.resumen || '',
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
};
