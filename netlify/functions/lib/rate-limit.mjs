import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export function getClientIp(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function hashIp(ip) {
  return createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

export async function consumeRateLimit(key, max, windowMs = 86400000) {
  const store = getStore('ecosistema-rate-limit');
  const bucket = Math.floor(Date.now() / windowMs);
  const storeKey = `${key}:${bucket}`;
  const current = (await store.get(storeKey, { type: 'json' })) || { count: 0 };
  if (current.count >= max) {
    return { allowed: false, remaining: 0 };
  }
  const next = { count: current.count + 1, at: Date.now() };
  await store.setJSON(storeKey, next);
  return { allowed: true, remaining: Math.max(0, max - next.count) };
}
