import { getUserFromBearer } from './lib/supabase-admin.mjs';
import { corsPreflight, jsonResponse } from './lib/railway-guard.mjs';
import {
  darBajaPromotor,
  esUsuarioFundador,
  listarPromotores,
  matricularPromotor,
} from './lib/promotores.mjs';

/** Admin de matrículas de promotores (solo fundador). */
export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const user = await getUserFromBearer(req);
  if (!user) {
    return jsonResponse({ error: 'Inicia sesión para administrar promotores.' }, 401);
  }

  const fundador = await esUsuarioFundador(user);
  if (!fundador) {
    return jsonResponse({ error: 'Solo el fundador puede matricular o dar de baja promotores.' }, 403);
  }

  if (req.method === 'GET') {
    const lista = await listarPromotores();
    if (!lista.ok) return jsonResponse({ error: lista.error }, 500);
    return jsonResponse({
      fundador: { id: user.id, email: user.email },
      promotores: lista.promotores,
      envBootstrap: lista.envBootstrap,
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'matricular').toLowerCase();

    if (action === 'baja' || action === 'revoke') {
      const out = await darBajaPromotor(body.id);
      if (!out.ok) return jsonResponse({ error: out.error }, 400);
      return jsonResponse({ success: true, ...out });
    }

    const out = await matricularPromotor({
      email: body.email,
      nombre: body.nombre,
      matriculadoPor: user.email || user.id,
    });
    if (!out.ok) return jsonResponse({ error: out.error }, 400);
    return jsonResponse({
      success: true,
      ...out,
      nota: out.userLinked
        ? 'Promotor matriculado y vinculado a su cuenta existente.'
        : 'Promotor matriculado por correo. Se vinculará automáticamente cuando inicie sesión.',
    });
  }

  return jsonResponse({ error: 'Method Not Allowed' }, 405);
};
