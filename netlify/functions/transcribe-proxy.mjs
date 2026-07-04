import {
  guardRailwayRequest,
  proxyToRailway,
  relayRailwayResponse,
  jsonResponse,
} from './lib/railway-guard.mjs';

export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'transcribe',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const body = await req.arrayBuffer();
    const upstream = await proxyToRailway('/transcribir', {
      method: 'POST',
      body,
      contentType,
    });
    return relayRailwayResponse(upstream);
  } catch (err) {
    return jsonResponse(
      { error: 'Proxy de transcripción falló', detalle: err.message },
      502,
    );
  }
};
