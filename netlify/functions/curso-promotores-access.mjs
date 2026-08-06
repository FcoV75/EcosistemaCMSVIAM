import { getUserFromBearer } from './lib/supabase-admin.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';
import { resolverAccesoCurso } from './lib/promotores.mjs';

/** GET: ¿puede esta sesión entrar al curso de promotores? */
export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const user = await getUserFromBearer(req);
  const acceso = await resolverAccesoCurso(user);
  if (!acceso.ok) {
    return jsonResponse({ ok: false, error: acceso.error }, acceso.status || 403);
  }

  return jsonResponse({
    ok: true,
    rol: acceso.rol,
    email: acceso.email,
    nombre: acceso.nombre || null,
    mensaje: acceso.mensaje,
  });
};
