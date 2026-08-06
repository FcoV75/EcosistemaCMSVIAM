import { fetchEntitlementsByUser, upsertEntitlement } from './entitlements-db.mjs';
import { getSupabaseAdmin } from './supabase-admin.mjs';

export const PRODUCTO_PROMOTOR = 'promotor_viam';

function ownerCodesFromEnv() {
  const raw = process.env.ECOSISTEMA_OWNER_CODES || 'CMS-8INFW3';
  return new Set(
    raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );
}

function emailsPromotorEnv() {
  const raw = process.env.ECOSISTEMA_PROMOTOR_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function esUsuarioFundador(user) {
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

function filaPromotorVigente(row) {
  if (!row || row.producto !== PRODUCTO_PROMOTOR) return false;
  if (row.status !== 'active') return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return true;
}

async function buscarFilaPromotorPorUsuario(user) {
  if (!user?.id && !user?.email) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  if (user.id) {
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('*')
      .eq('producto', PRODUCTO_PROMOTOR)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (filaPromotorVigente(data)) return data;
  }

  const email = normalizarEmail(user.email);
  if (!email) return null;

  const { data: rows } = await supabase
    .from('ecosistema_entitlements')
    .select('*')
    .eq('producto', PRODUCTO_PROMOTOR)
    .eq('status', 'active')
    .limit(200);

  const match = (rows || []).find(
    (r) => filaPromotorVigente(r) && normalizarEmail(r.metadata?.email) === email,
  );
  return match || null;
}

export async function resolverAccesoCurso(user) {
  if (!user) {
    return { ok: false, status: 401, error: 'Inicia sesión para acceder al curso.' };
  }

  if (await esUsuarioFundador(user)) {
    return {
      ok: true,
      rol: 'fundador',
      email: user.email,
      mensaje: 'Acceso de fundador al curso de promotores.',
    };
  }

  const email = normalizarEmail(user.email);
  if (email && emailsPromotorEnv().has(email)) {
    return {
      ok: true,
      rol: 'promotor',
      email: user.email,
      fuente: 'env',
      mensaje: 'Promotor autorizado (lista administrativa).',
    };
  }

  const fila = await buscarFilaPromotorPorUsuario(user);
  if (fila) {
    // Si estaba matriculado solo por email, vincula user_id al entrar.
    if (!fila.user_id && user.id) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase
          .from('ecosistema_entitlements')
          .update({
            user_id: user.id,
            updated_at: new Date().toISOString(),
            metadata: {
              ...(fila.metadata || {}),
              email,
              vinculado_en_login: new Date().toISOString(),
            },
          })
          .eq('id', fila.id);
      }
    }
    return {
      ok: true,
      rol: 'promotor',
      email: user.email,
      nombre: fila.metadata?.nombre || null,
      matriculaId: fila.id,
      mensaje: 'Promotor matriculado. Bienvenido al curso.',
    };
  }

  return {
    ok: false,
    status: 403,
    error:
      'Tu cuenta aún no está matriculada como promotor. Pide al fundador que te autorice en el Panel Fundador.',
  };
}

async function buscarAuthUserIdPorEmail(email) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const target = normalizarEmail(email);
  // Recorre primeras páginas de usuarios (suficiente para roster interno).
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const hit = (data?.users || []).find((u) => normalizarEmail(u.email) === target);
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

export async function listarPromotores() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };

  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('id, user_id, producto, plan, status, starts_at, expires_at, metadata, created_at, updated_at')
    .eq('producto', PRODUCTO_PROMOTOR)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return { ok: false, error: error.message };

  const envEmails = [...emailsPromotorEnv()];
  return {
    ok: true,
    promotores: data || [],
    envBootstrap: envEmails,
  };
}

export async function matricularPromotor({ email, nombre = '', matriculadoPor = null }) {
  const mail = normalizarEmail(email);
  if (!mail || !mail.includes('@')) {
    return { ok: false, error: 'Correo inválido.' };
  }

  const userId = await buscarAuthUserIdPorEmail(mail);
  const result = await upsertEntitlement({
    userId,
    producto: PRODUCTO_PROMOTOR,
    plan: 'promotor',
    status: 'active',
    expiresAt: null,
    metadata: {
      rol: 'promotor',
      email: mail,
      nombre: String(nombre || '').trim() || null,
      matriculado_at: new Date().toISOString(),
      matriculado_por: matriculadoPor || null,
    },
  });

  if (!result.ok) return result;
  return {
    ok: true,
    id: result.id,
    created: !!result.created,
    updated: !!result.updated,
    userLinked: !!userId,
    email: mail,
  };
}

export async function darBajaPromotor(id) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  if (!id) return { ok: false, error: 'Falta id de matrícula.' };

  const { data: row, error: errFind } = await supabase
    .from('ecosistema_entitlements')
    .select('id, producto, metadata')
    .eq('id', id)
    .maybeSingle();
  if (errFind) return { ok: false, error: errFind.message };
  if (!row || row.producto !== PRODUCTO_PROMOTOR) {
    return { ok: false, error: 'Matrícula no encontrada.' };
  }

  const { error } = await supabase
    .from('ecosistema_entitlements')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
      metadata: {
        ...(row.metadata || {}),
        baja_at: new Date().toISOString(),
      },
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, id };
}
