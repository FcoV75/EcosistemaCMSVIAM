import { libroPorSlug } from './lib/libros-catalog.mjs';
import { createDownloadToken, getSessionSecret } from './lib/ecosistema-auth.mjs';
import { getClientIp, hashIp, consumeRateLimit } from './lib/rate-limit.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { libro } = await req.json();
    const meta = libroPorSlug(libro);
    if (!meta) {
      return jsonResponse({ error: 'Obra no disponible para muestra.' }, 400);
    }

    const ip = getClientIp(req);
    const limite = await consumeRateLimit(`muestra:${hashIp(ip)}`, 12, 86400000);
    if (!limite.allowed) {
      return jsonResponse({ error: 'Has alcanzado el límite de muestras gratuitas por hoy.' }, 429);
    }

    const secret = getSessionSecret();
    if (!secret) {
      return jsonResponse({ error: 'Servicio no configurado.' }, 503);
    }

    const token = createDownloadToken(
      {
        sub: `muestra:${hashIp(ip)}`,
        libro,
        archivo: meta.archivo,
        modo: 'muestra',
      },
      secret,
      300,
    );

    const previewUrl = `/.netlify/functions/download-libro?token=${encodeURIComponent(token)}&archivo=${encodeURIComponent(meta.archivo)}&inline=1`;

    return jsonResponse({
      previewUrl,
      titulo: meta.titulo,
      expiresIn: 300,
    });
  } catch (err) {
    console.error('libro-muestra:', err);
    return jsonResponse({ error: 'No se pudo preparar la muestra.' }, 500);
  }
};
