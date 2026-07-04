import { seedOwnerEntitlements } from './lib/entitlements-db.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const secret = (process.env.ECOSISTEMA_SEED_SECRET || process.env.ECOSISTEMA_SESSION_SECRET || '').trim();
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!secret || auth !== secret) {
    return jsonResponse({ error: 'No autorizado.' }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = body.code || process.env.ECOSISTEMA_OWNER_CODES?.split(',')[0]?.trim() || 'CMS-8INFW3';
    const resultado = await seedOwnerEntitlements(code);
    return jsonResponse(resultado);
  } catch (err) {
    console.error('ecosistema-seed:', err);
    return jsonResponse({ error: err.message }, 500);
  }
};
