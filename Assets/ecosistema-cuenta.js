/**
 * Cuenta unificada CMS ↔ ContacNeed (mismo Supabase Auth)
 */
(function () {
  let supabase = null;
  let config = null;

  async function cargarConfig() {
    if (config) return config;
    const r = await fetch('/.netlify/functions/supabase-config');
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Supabase no configurado en CMS.');
    config = d;
    return d;
  }

  async function initSupabase() {
    if (supabase) return supabase;
    const cfg = await cargarConfig();
    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('No se pudo cargar Supabase JS.'));
        document.head.appendChild(s);
      });
    }
    supabase = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return supabase;
  }

  async function getSession() {
    const client = await initSupabase();
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function authHeaders(extra = {}) {
    const session = await getSession();
    const headers = { ...extra };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  async function signIn(email, password) {
    const client = await initSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: String(email).trim(),
      password,
    });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Confirma tu correo antes de entrar (revisa bandeja y spam).');
      }
      throw new Error(error.message);
    }
    return data.session;
  }

  async function signOut() {
    const client = await initSupabase();
    await client.auth.signOut();
  }

  async function fetchMisProductos() {
    const headers = await authHeaders({ Accept: 'application/json' });
    const r = await fetch('/.netlify/functions/ecosistema-mis-productos', { headers });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'No se pudieron cargar tus productos.');
    return d;
  }

  async function vincularCodigo(code) {
    const headers = await authHeaders({ 'Content-Type': 'application/json' });
    const r = await fetch('/.netlify/functions/ecosistema-mis-productos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: String(code).trim().toUpperCase() }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'No se pudo vincular el código.');
    return d;
  }

  async function registroUrl() {
    const cfg = await cargarConfig();
    return cfg.registroUrl || 'https://contacneed.com/registro';
  }

  window.EcosistemaCuenta = {
    initSupabase,
    getSession,
    authHeaders,
    signIn,
    signOut,
    fetchMisProductos,
    vincularCodigo,
    registroUrl,
  };
})();
