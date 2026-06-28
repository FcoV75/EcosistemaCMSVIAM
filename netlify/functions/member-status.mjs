import { getStore } from '@netlify/blobs';
import {
  esCodigoPropietarioNexus,
  esCodigoPropietarioVideoDiamante,
  estadoMembresia,
} from './lib/member-helpers.mjs';

const PRODUCTO_ETIQUETA = {
  sincronia_nexus: 'Sincronía Nexus',
  video_diamante_premium: 'Video Diamante Premium',
};

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

    if (productoRequerido === 'sincronia_nexus' && esCodigoPropietarioNexus(normalized)) {
      return Response.json(estadoMembresia(normalized, { producto: 'sincronia_nexus', plan: 'propietario' }));
    }

    if (productoRequerido === 'video_diamante_premium' && esCodigoPropietarioVideoDiamante(normalized)) {
      return Response.json(estadoMembresia(normalized, { producto: 'video_diamante_premium', plan: 'propietario' }));
    }

    const store = getStore('nexus-members');
    const memberData = await store.get(normalized, { type: 'json' });

    if (!memberData) {
      return Response.json({ error: 'Código de membresía no encontrado.' }, { status: 404 });
    }

    if (productoRequerido && memberData.producto && memberData.producto !== productoRequerido) {
      const esperado = PRODUCTO_ETIQUETA[productoRequerido] || productoRequerido;
      return Response.json({ error: `Este código no corresponde a ${esperado}.` }, { status: 403 });
    }

    return Response.json(estadoMembresia(normalized, memberData));
  } catch (err) {
    console.error('Status error:', err);
    return Response.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
};
