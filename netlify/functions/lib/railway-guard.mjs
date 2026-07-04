import { verifyAccessToken, getSessionSecret } from './ecosistema-auth.mjs';
import { consumeRateLimit } from './rate-limit.mjs';

const RAILWAY_API =
  process.env.RAILWAY_API_URL ||
  'https://ecosistemacmsviam-production.up.railway.app';

export const RATE_LIMITS = {
  render: { free: 3, premium: 10, windowMs: 86400000 },
  transcribe: { free: 15, premium: 50, windowMs: 86400000 },
  estudio: { free: 3, premium: 20, windowMs: 86400000 },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ecosistema-Token',
};

export function corsPreflight(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export function extractToken(req) {
  const auth = req.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return (req.headers.get('x-ecosistema-token') || '').trim();
}

export function requireToken(req, { product } = {}) {
  const secret = getSessionSecret();
  if (!secret) {
    return {
      ok: true,
      payload: {
        sub: 'legacy-open',
        tier: 'free',
        product: product || 'video_diamante_premium',
      },
      legacy: true,
    };
  }

  const token = extractToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Se requiere token de acceso. Recarga la página.' };
  }
  const payload = verifyAccessToken(token, secret);
  if (!payload) {
    return { ok: false, status: 401, error: 'Token inválido o expirado. Recarga la página.' };
  }
  if (product && payload.product && payload.product !== product) {
    return { ok: false, status: 403, error: 'Token no válido para este producto.' };
  }
  return { ok: true, payload, token };
}

export async function enforceRateLimit(payload, action) {
  const limits = RATE_LIMITS[action];
  if (!limits || payload?.sub === 'legacy-open') return { ok: true };
  const tier = payload.tier === 'premium' ? 'premium' : 'free';
  const max = limits[tier];
  const key = `${action}:${tier}:${payload.sub}`;
  const result = await consumeRateLimit(key, max, limits.windowMs);
  if (!result.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Límite diario de ${action} alcanzado (${max}/día). Vuelve mañana o activa Premium.`,
    };
  }
  return { ok: true, remaining: result.remaining };
}

export async function guardRailwayRequest(req, { product, action, requireAuth = true }) {
  const preflight = corsPreflight(req);
  if (preflight) return { preflight };

  if (!requireAuth) {
    return { ok: true, payload: null };
  }

  const auth = requireToken(req, { product });
  if (!auth.ok) return auth;

  if (action) {
    const rate = await enforceRateLimit(auth.payload, action);
    if (!rate.ok) return rate;
    return { ok: true, payload: auth.payload, remaining: rate.remaining };
  }

  return { ok: true, payload: auth.payload };
}

export async function proxyToRailway(path, { method = 'GET', body, contentType }) {
  const secret = (process.env.RAILWAY_INTERNAL_SECRET || '').trim();
  const headers = { Accept: 'application/json, application/octet-stream, */*' };
  if (contentType) headers['Content-Type'] = contentType;
  if (secret) headers['X-Ecosistema-Internal'] = secret;

  return fetch(`${RAILWAY_API}${path}`, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });
}

export async function relayRailwayResponse(upstream) {
  const contentType = upstream.headers.get('content-type') || 'application/json';
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: { ...CORS_HEADERS, 'Content-Type': contentType },
  });
}
