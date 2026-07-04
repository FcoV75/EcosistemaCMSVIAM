import { fetchEntitlementsByUser, vincularCodigoAUsuario } from './lib/entitlements-db.mjs';
import { getUserFromBearer } from './lib/supabase-admin.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

const ETIQUETAS = {
  sincronia_nexus: 'Sincronía Nexus',
  video_diamante_premium: 'Video Diamante Premium',
  contacneed_pro: 'ContacNeed PRO',
  ecosistema_cms_compra: 'Obras y servicios CMS',
  consulta_cms: 'Consulta CMS',
};

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const user = await getUserFromBearer(req);
  if (!user) {
    return jsonResponse({ error: 'Inicia sesión para ver tus productos.' }, 401);
  }

  if (req.method === 'GET') {
    const rows = await fetchEntitlementsByUser(user.id);
    const productos = rows.map((r) => ({
      producto: r.producto,
      etiqueta: ETIQUETAS[r.producto] || r.producto,
      plan: r.plan,
      expires_at: r.expires_at,
      legacy_code: r.legacy_code,
      metadata: r.metadata,
    }));
    return jsonResponse({
      user: { id: user.id, email: user.email },
      productos,
      enlaces: {
        nexus: '/miembro/',
        videoDiamante: '/video_diamante',
        contacneed: 'https://contacneed.com',
        descargas: '/#descargas-libros',
        pagos: '/#pago-general',
      },
    });
  }

  if (req.method === 'POST') {
    const { code } = await req.json();
    if (!code || String(code).trim().length < 5) {
      return jsonResponse({ error: 'Ingresa un código CMS-XXXXXX válido.' }, 400);
    }
    const vinculo = await vincularCodigoAUsuario(code, user.id);
    if (!vinculo.ok) return jsonResponse({ error: vinculo.error }, 500);
    const rows = await fetchEntitlementsByUser(user.id);
    return jsonResponse({
      success: true,
      vinculados: vinculo.vinculados,
      productos: rows.map((r) => r.producto),
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
