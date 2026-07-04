import { createClient } from '@supabase/supabase-js';

let cached = null;

export function supabaseEnv() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();
  return { url, serviceKey, anonKey };
}

export function getSupabaseAdmin() {
  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) return null;
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}

export function getSupabaseAnon() {
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
