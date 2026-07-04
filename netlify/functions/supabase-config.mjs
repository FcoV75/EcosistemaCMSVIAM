import { supabaseEnv } from './lib/supabase-admin.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) {
    return jsonResponse({ error: 'Supabase no configurado (falta SUPABASE_ANON_KEY en Netlify CMS).' }, 503);
  }

  return jsonResponse({
    url,
    anonKey,
    registroUrl: 'https://contacneed.com/registro',
    loginUnificado: true,
  });
};
