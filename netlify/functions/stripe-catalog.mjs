import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';
import { catalogoPublico } from './lib/stripe-catalog.mjs';

/**
 * Endpoint de consulta del catálogo Stripe (público, sin secretos).
 * El módulo de datos vive en lib/stripe-catalog.mjs para que create-checkout-session lo importe.
 */
export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  return jsonResponse({
    success: true,
    productos: catalogoPublico(),
  });
};
