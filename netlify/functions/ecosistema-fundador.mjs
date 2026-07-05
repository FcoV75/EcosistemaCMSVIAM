import { fetchEntitlementsByUser } from './lib/entitlements-db.mjs';
import { getUserFromBearer, getSupabaseAdmin } from './lib/supabase-admin.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

function ownerCodesFromEnv() {
  const raw = process.env.ECOSISTEMA_OWNER_CODES || 'CMS-8INFW3';
  return new Set(raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));
}

async function esUsuarioFundador(user) {
  if (!user?.id) return false;
  const rows = await fetchEntitlementsByUser(user.id);
  const owners = ownerCodesFromEnv();
  return rows.some(
    (r) =>
      r.plan === 'propietario' ||
      r.metadata?.rol === 'fundador' ||
      (r.legacy_code && owners.has(String(r.legacy_code).toUpperCase())),
  );
}

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const user = await getUserFromBearer(req);
  if (!user) {
    return jsonResponse({ error: 'Inicia sesión para acceder al Panel Fundador.' }, 401);
  }

  const fundador = await esUsuarioFundador(user);
  if (!fundador) {
    return jsonResponse({ error: 'Acceso reservado al propietario del ecosistema.' }, 403);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonResponse({ error: 'Supabase no configurado.' }, 503);
  }

  if (req.method === 'GET') {
    const { data: entitlements, error } = await supabase
      .from('ecosistema_entitlements')
      .select('id, user_id, legacy_code, producto, plan, status, starts_at, expires_at, stripe_session_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return jsonResponse({ error: error.message }, 500);

    const productos = {};
    for (const row of entitlements || []) {
      productos[row.producto] = (productos[row.producto] || 0) + 1;
    }

    const activos = (entitlements || []).filter((r) => r.status === 'active').length;
    const conCuenta = new Set((entitlements || []).filter((r) => r.user_id).map((r) => r.user_id)).size;
    const soloCodigo = (entitlements || []).filter((r) => r.legacy_code && !r.user_id).length;

    return jsonResponse({
      fundador: { id: user.id, email: user.email },
      resumen: {
        total: entitlements?.length || 0,
        activos,
        usuariosConCuenta: conCuenta,
        soloCodigoLegacy: soloCodigo,
        porProducto: productos,
      },
      entitlements: entitlements || [],
      enlaces: {
        miEcosistema: '/mi-ecosistema',
        contacneed: 'https://contacneed.com',
        adminContacneed: 'https://contacneed.com/admin',
      },
      nota: 'Fuente primaria: ecosistema_entitlements. Blobs legacy solo respaldo (ECOSISTEMA_LEGACY_BLOB_FALLBACK).',
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
