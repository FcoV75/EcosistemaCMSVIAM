import { createAccessToken, getSessionSecret } from './lib/ecosistema-auth.mjs';
import { getClientIp, hashIp } from './lib/rate-limit.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const product = body.product || 'video_diamante_premium';
    const secret = getSessionSecret();
    if (!secret) {
      return jsonResponse({
        accessToken: '',
        tier: 'free',
        product,
        legacy: true,
        message: 'Configura ECOSISTEMA_SESSION_SECRET en Netlify para activar tokens.',
      });
    }

    const ip = getClientIp(req);
    const sub = `guest:${hashIp(ip)}`;
    const accessToken = createAccessToken({ sub, tier: 'free', product }, secret);

    return jsonResponse({
      accessToken,
      tier: 'free',
      product,
      expiresIn: 86400,
    });
  } catch (err) {
    console.error('access-token:', err);
    return jsonResponse({ error: 'No se pudo emitir el token de acceso.' }, 500);
  }
};
