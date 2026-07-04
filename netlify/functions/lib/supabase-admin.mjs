import { createClient } from '@supabase/supabase-js';

let cached = null;

function stripEnv(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '');
}

export function normalizeSupabaseUrl(raw) {
  let value = stripEnv(raw);
  if (!value) return '';

  const embedded = value.match(/https?:\/\/[a-z0-9-]+\.supabase\.co/i);
  if (embedded) return embedded[0].replace(/\/+$/, '');

  if (/^[a-z0-9-]+\.supabase\.co$/i.test(value)) {
    return `https://${value}`.replace(/\/+$/, '');
  }

  if (/^[a-z0-9-]{10,}$/i.test(value) && !value.includes('.')) {
    return `https://${value}.supabase.co`;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin.replace(/\/+$/, '');
    }
  } catch {
    /* ignore */
  }

  return '';
}

function firstValidSupabaseUrl() {
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSupabaseUrl(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function stripKey(value) {
  return stripEnv(value);
}

export function supabaseEnv() {
  const url = firstValidSupabaseUrl();
  const serviceKey = stripKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = stripKey(
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return { url, serviceKey, anonKey };
}

export function getSupabaseAdmin() {
  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) return null;
  if (!cached) {
    try {
      cached = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } catch (err) {
      cached = null;
      throw new Error(
        `Supabase admin inválido. Revisa SUPABASE_URL en Netlify (debe ser https://xxxx.supabase.co). Detalle: ${err.message}`,
      );
    }
  }
  return cached;
}

export function getSupabaseAnon() {
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (err) {
    throw new Error(
      `Supabase anon inválido. Revisa SUPABASE_URL / SUPABASE_ANON_KEY en Netlify. Detalle: ${err.message}`,
    );
  }
}

export async function getUserFromBearer(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const supabase = getSupabaseAnon() || getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
