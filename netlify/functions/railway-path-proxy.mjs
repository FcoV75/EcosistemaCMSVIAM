import {
  guardRailwayRequest,
  proxyToRailway,
  relayRailwayResponse,
  jsonResponse,
} from './lib/railway-guard.mjs';

const ALLOWED_PREFIXES = ['/health', '/renderizar', '/transcribir', '/estudio', '/status', '/descargar'];

const ACTION_BY_PATH = [
  { match: (path) => path === '/transcribir', action: 'transcribe' },
  { match: (path) => path.startsWith('/estudio'), action: 'estudio' },
  {
    match: (path) => path === '/renderizar' || path === '/renderizar/iniciar',
    action: 'render',
  },
];

function actionForPath(path) {
  const item = ACTION_BY_PATH.find((entry) => entry.match(path));
  return item?.action || null;
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '';
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return jsonResponse({ error: 'Ruta no permitida en proxy.' }, 403);
  }

  const isPublicHealth = path === '/health' || path.startsWith('/health/');
  const action = actionForPath(path);

  try {
    const guard = await guardRailwayRequest(req, {
      product: 'video_diamante_premium',
      action: isPublicHealth ? null : action,
      requireAuth: !isPublicHealth,
    });
    if (guard.preflight) return guard.preflight;
    if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);

    const contentType = req.headers.get('content-type') || '';
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody ? await req.arrayBuffer() : undefined;
    if (body && body.byteLength > 5.5 * 1024 * 1024) {
      return jsonResponse(
        {
          error:
            'Archivo demasiado grande para el proxy de Netlify (~4.5 MB máx. por petición). Comprime el archivo e intenta de nuevo.',
        },
        413,
      );
    }
    const upstream = await proxyToRailway(path, {
      method: req.method,
      body,
      contentType,
    });
    return relayRailwayResponse(upstream);
  } catch (err) {
    console.error('railway-path-proxy:', err);
    return jsonResponse({ error: 'Proxy Railway falló', detalle: err.message || String(err) }, 502);
  }
};
