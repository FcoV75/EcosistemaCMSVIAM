import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SEC = 86400;

export function getSessionSecret() {
  return (
    process.env.ECOSISTEMA_SESSION_SECRET ||
    process.env.RAILWAY_INTERNAL_SECRET ||
    ''
  ).trim();
}

export function createAccessToken(payload, secret, ttlSec = DEFAULT_TTL_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSec,
  };
  const bodyB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(bodyB64).digest('base64url');
  return `${bodyB64}.${sig}`;
}

export function verifyAccessToken(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [bodyB64, sig] = parts;
  const expected = createHmac('sha256', secret).update(bodyB64).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!body?.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
  if (!body.sub || !body.tier || !body.product) return null;
  return body;
}
