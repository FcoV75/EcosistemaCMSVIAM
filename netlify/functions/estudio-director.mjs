import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';
import { dirigirEscena } from './lib/estudio-director-semantico.mjs';

/** Endpoint del Director Semántico para cualquier modalidad del Estudio VIAM. */
export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'estudio',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const body = await req.json();
    const orden = String(body.orden || body.prompt || body.tema || body.texto || '').trim();
    if (!orden) return jsonResponse({ error: 'Escribe la orden o escena a dirigir.' }, 400);
    const modalidad = String(body.modalidad || body.modo || 'imagen').toLowerCase();
    const permitidas = new Set(['imagen', 'clip', 'voz', 'discurso', 'musica']);
    const modo = permitidas.has(modalidad) ? modalidad : 'imagen';
    const brief = await dirigirEscena(orden, { modalidad: modo });
    return jsonResponse({ success: true, director: brief });
  } catch (e) {
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
};
