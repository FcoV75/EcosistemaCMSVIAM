import { getSupabaseAdmin } from './supabase-admin.mjs';

const PRODUCTOS_ECOSISTEMA = [
  'sincronia_nexus',
  'video_diamante_premium',
  'contacneed_pro',
  'ecosistema_cms_compra',
  'consulta_cms',
];

const OWNER_CODE_DEFAULT = 'CMS-8INFW3';

function normalizarCodigo(code) {
  return String(code || '').trim().toUpperCase();
}

function calcularExpiresAt(startDate, durationDays) {
  if (!durationDays || durationDays >= 9000) return null;
  const ms = Number(startDate) + Number(durationDays) * 86400000;
  return new Date(ms).toISOString();
}

function entitlementVigente(row) {
  if (!row || row.status !== 'active') return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function upsertEntitlement({
  userId = null,
  legacyCode = null,
  producto,
  plan = null,
  status = 'active',
  startsAt = null,
  expiresAt = null,
  stripeSessionId = null,
  metadata = {},
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: 'Supabase no configurado en Netlify CMS.' };

  const row = {
    user_id: userId || null,
    legacy_code: legacyCode ? normalizarCodigo(legacyCode) : null,
    producto,
    plan,
    status,
    starts_at: startsAt || new Date().toISOString(),
    expires_at: expiresAt,
    stripe_session_id: stripeSessionId || null,
    metadata,
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from('ecosistema_entitlements').select('id');
  if (userId) {
    query = query.eq('user_id', userId).eq('producto', producto).eq('status', 'active');
  } else if (legacyCode) {
    query = query.eq('legacy_code', normalizarCodigo(legacyCode)).eq('producto', producto).eq('status', 'active');
  } else {
    return { ok: false, error: 'Falta user_id o legacy_code.' };
  }

  const { data: existente } = await query.maybeSingle();

  if (existente?.id) {
    const { error } = await supabase.from('ecosistema_entitlements').update(row).eq('id', existente.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: existente.id, updated: true };
  }

  const { data, error } = await supabase.from('ecosistema_entitlements').insert(row).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id, created: true };
}

export async function syncEntitlementsFromMember(memberCode, memberData, { userId = null, stripeSessionId = null } = {}) {
  const code = normalizarCodigo(memberCode);
  if (!code || !memberData) return { ok: false, error: 'Datos incompletos.' };

  const productos = new Set(memberData.entitlements || []);
  if (memberData.producto) productos.add(memberData.producto);
  if (memberData.detalle === 'obra_literaria') productos.add('ecosistema_cms_compra');
  if (memberData.detalle === 'consulta_cms') productos.add('consulta_cms');
  if (memberData.detalle === 'sincronia_nexus_mixto') {
    productos.add('sincronia_nexus');
    productos.add('ecosistema_cms_compra');
  }

  const expiresAt = calcularExpiresAt(memberData.startDate, memberData.durationDays);
  const metadata = {
    librosComprados: memberData.librosComprados || null,
    detalle: memberData.detalle || null,
    transactionId: memberData.transactionId || null,
  };

  const resultados = [];
  for (const producto of productos) {
    if (!producto) continue;
    const r = await upsertEntitlement({
      userId,
      legacyCode: code,
      producto,
      plan: memberData.plan || null,
      expiresAt,
      stripeSessionId: stripeSessionId || memberData.transactionId || null,
      metadata,
    });
    resultados.push({ producto, ...r });
  }

  return { ok: true, resultados };
}

export async function fetchEntitlementsByCode(code) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const normalized = normalizarCodigo(code);
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('*')
    .eq('legacy_code', normalized)
    .eq('status', 'active');
  if (error) {
    console.error('fetchEntitlementsByCode:', error.message);
    return [];
  }
  return (data || []).filter(entitlementVigente);
}

export async function fetchEntitlementsByUser(userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) {
    console.error('fetchEntitlementsByUser:', error.message);
    return [];
  }
  return (data || []).filter(entitlementVigente);
}

export function memberDataDesdeEntitlements(rows, code = null) {
  if (!rows?.length) return null;
  const productos = rows.map((r) => r.producto);
  const principal =
    productos.includes('sincronia_nexus') ? 'sincronia_nexus' :
    productos.includes('video_diamante_premium') ? 'video_diamante_premium' :
    productos.includes('ecosistema_cms_compra') ? 'ecosistema_cms_compra' :
    productos[0];

  const ref = rows[0];
  const starts = rows.map((r) => new Date(r.starts_at).getTime());
  const startDate = Math.min(...starts);
  let durationDays = 3650;
  if (ref.expires_at) {
    const exp = Math.min(...rows.filter((r) => r.expires_at).map((r) => new Date(r.expires_at).getTime()));
    durationDays = Math.max(1, Math.ceil((exp - startDate) / 86400000));
  }

  const meta = ref.metadata || {};
  const esPermanente = rows.some(
    (r) => r.metadata?.permanent === true || (r.plan === 'propietario' && !r.expires_at),
  );
  return {
    startDate,
    durationDays: esPermanente ? 99999 : durationDays,
    producto: principal,
    plan: ref.plan || null,
    entitlements: [...new Set(productos)],
    librosComprados: meta.librosComprados || null,
    detalle: meta.detalle || null,
    transactionId: ref.stripe_session_id || meta.transactionId || null,
    usage: {},
    permanent: esPermanente,
    fuente: 'supabase',
    legacy_code: code || ref.legacy_code || rows.find((r) => r.legacy_code)?.legacy_code || null,
  };
}

export async function resolverMiembroDual(code, userId = null) {
  const normalized = normalizarCodigo(code);

  if (userId) {
    const porUsuario = await fetchEntitlementsByUser(userId);
    const member = memberDataDesdeEntitlements(porUsuario, normalized || null);
    if (member) return { normalized: normalized || member.legacy_code, memberData: member };
  }

  if (normalized) {
    const porCodigo = await fetchEntitlementsByCode(normalized);
    const member = memberDataDesdeEntitlements(porCodigo, normalized);
    if (member) return { normalized, memberData: member };
  }

  return { normalized: normalized || null, memberData: null };
}

export async function vincularCodigoAUsuario(code, userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  const normalized = normalizarCodigo(code);
  const { data, error } = await supabase
    .from('ecosistema_entitlements')
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq('legacy_code', normalized)
    .is('user_id', null)
    .select('id');
  if (error) return { ok: false, error: error.message };
  return { ok: true, vinculados: data?.length || 0 };
}

export async function seedOwnerEntitlements(code = OWNER_CODE_DEFAULT) {
  const normalized = normalizarCodigo(code);
  const resultados = [];
  for (const producto of PRODUCTOS_ECOSISTEMA) {
    const r = await upsertEntitlement({
      legacyCode: normalized,
      producto,
      plan: 'propietario',
      expiresAt: null,
      metadata: { permanent: true, rol: 'fundador' },
    });
    resultados.push({ producto, ...r });
  }
  return { ok: true, code: normalized, resultados };
}
