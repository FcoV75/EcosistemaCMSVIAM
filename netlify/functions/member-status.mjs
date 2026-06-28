import { getStore } from '@netlify/blobs';
import { esCodigoPropietario, estadoMembresia } from './lib/member-helpers.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, productoRequerido } = await req.json();
    if (!code || code.length < 5) {
      return Response.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const normalized = String(code).trim().toUpperCase();

    if (esCodigoPropietario(normalized)) {
      const estado = estadoMembresia(normalized, { producto: 'video_diamante_premium', plan: 'propietario' });
      return Response.json(estado);
    }

    const store = getStore('nexus-members');
    const memberData = await store.get(normalized, { type: 'json' });

    if (!memberData) {
      return Response.json({ error: 'Código de membresía no encontrado.' }, { status: 404 });
    }

    if (productoRequerido && memberData.producto && memberData.producto !== productoRequerido) {
      return Response.json({ error: 'Este código no corresponde a Video Diamante Premium.' }, { status: 403 });
    }

    return Response.json(estadoMembresia(normalized, memberData));
  } catch (err) {
    console.error('Status error:', err);
    return Response.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
};
