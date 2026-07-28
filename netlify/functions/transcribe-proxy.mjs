import {
  guardRailwayRequest,
  proxyToRailway,
  relayRailwayResponse,
  jsonResponse,
} from './lib/railway-guard.mjs';

export default async (req) => {
  try {
    const guard = await guardRailwayRequest(req, {
      product: 'video_diamante_premium',
      action: 'transcribe',
    });
    if (guard.preflight) return guard.preflight;
    if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    const contentType = req.headers.get('content-type') || '';
    const body = await req.arrayBuffer();
    if (body.byteLength > 5.5 * 1024 * 1024) {
      return jsonResponse(
        {
          error:
            'Audio demasiado grande para el proxy (~4.5 MB máx.). Comprime a MP3 más ligero e intenta de nuevo.',
        },
        413,
      );
    }
    const upstream = await proxyToRailway('/transcribir', {
      method: 'POST',
      body,
      contentType,
    });
    return relayRailwayResponse(upstream);
  } catch (err) {
    console.error('transcribe-proxy:', err);
    return jsonResponse(
      { error: 'Proxy de transcripción falló', detalle: err.message || String(err) },
      502,
    );
  }
};
