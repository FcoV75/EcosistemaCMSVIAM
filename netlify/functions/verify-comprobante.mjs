import { libroPorSlug } from './lib/libros-catalog.mjs';
import {
  obtenerMiembro,
  tieneAccesoConsulta,
  tieneAccesoLibros,
  tieneAccesoNexus,
} from './lib/comprobante-helpers.mjs';
import { createDownloadToken, getSessionSecret } from './lib/ecosistema-auth.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, libro, tipo = 'libro' } = await req.json();
    const secret = getSessionSecret();
    if (!secret) {
      return jsonResponse({ valid: false, error: 'Servicio no configurado (falta ECOSISTEMA_SESSION_SECRET).' }, 503);
    }

    const { normalized, memberData } = await obtenerMiembro(code);
    if (!normalized) {
      return jsonResponse({ valid: false, error: 'Ingresa un código CMS-XXXXXX válido.' }, 400);
    }

    if (tipo === 'nexus') {
      if (!tieneAccesoNexus(normalized, memberData)) {
        return jsonResponse({ valid: false, error: 'Este código no tiene membresía activa de Sincronía Nexus.' }, 403);
      }
      return jsonResponse({ valid: true, producto: 'sincronia_nexus', code: normalized });
    }

    if (tipo === 'consulta') {
      if (!tieneAccesoConsulta(normalized, memberData)) {
        return jsonResponse({ valid: false, error: 'Este código no corresponde a una consulta o servicio pagado.' }, 403);
      }
      return jsonResponse({ valid: true, producto: 'consulta_cms', code: normalized });
    }

    const meta = libro ? libroPorSlug(libro) : null;
    if (libro && !meta) {
      return jsonResponse({ valid: false, error: 'Libro no reconocido.' }, 400);
    }

    if (!tieneAccesoLibros(normalized, memberData, libro || null)) {
      return jsonResponse({
        valid: false,
        error: 'Este código no autoriza la descarga de esta obra. Verifica tu comprobante CMS-XXXXXX.',
      }, 403);
    }

    const archivo = meta?.archivo;
    const downloadToken = createDownloadToken(
      {
        sub: normalized,
        libro: libro || null,
        archivo,
        modo: 'compra',
      },
      secret,
      1800,
    );

    const downloadUrl = `/.netlify/functions/download-libro?token=${encodeURIComponent(downloadToken)}${
      archivo ? `&archivo=${encodeURIComponent(archivo)}` : ''
    }`;

    return jsonResponse({
      valid: true,
      code: normalized,
      titulo: meta?.titulo || null,
      downloadUrl,
    });
  } catch (err) {
    console.error('verify-comprobante:', err);
    return jsonResponse({ valid: false, error: 'Error verificando el comprobante.' }, 500);
  }
};
