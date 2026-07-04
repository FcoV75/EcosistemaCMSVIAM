import { getStore } from '@netlify/blobs';
import {
  esCodigoPropietarioNexus,
  esCodigoPropietarioVideoDiamante,
  estadoMembresia,
  miembroTieneProducto,
} from './lib/member-helpers.mjs';
import { tieneAccesoNexus } from './lib/comprobante-helpers.mjs';
import { createAccessToken, getSessionSecret } from './lib/ecosistema-auth.mjs';

const PRODUCTO_ETIQUETA = {
  sincronia_nexus: 'Sincronía Nexus',
  video_diamante_premium: 'Video Diamante Premium',
};

function tokenPremium(normalized, producto) {
  const secret = getSessionSecret();
  if (!secret) return null;
  return createAccessToken({ sub: normalized, tier: 'premium', product: producto }, secret);
}

function respuestaMembresia(estado, normalized, producto) {
  const accessToken = tokenPremium(normalized, producto);
  return Response.json({
    ...estado,
    ...(accessToken ? { accessToken } : {}),
  });
}

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
      return respuestaMembresia(
        estadoMembresia(normalized, { producto: 'sincronia_nexus', plan: 'propietario', startDate: Date.now(), durationDays: 99999 }),
        normalized,
        'sincronia_nexus',
      );
    }

    if (productoRequerido === 'video_diamante_premium' && esCodigoPropietarioVideoDiamante(normalized)) {
      return respuestaMembresia(
        estadoMembresia(normalized, { producto: 'video_diamante_premium', plan: 'propietario', startDate: Date.now(), durationDays: 99999 }),
        normalized,
        'video_diamante_premium',
      );
    }

    const store = getStore('nexus-members');
    const memberData = await store.get(normalized, { type: 'json' });

    if (!memberData) {
      return Response.json({ error: 'Código de membresía no encontrado.' }, { status: 404 });
    }

    if (productoRequerido === 'sincronia_nexus') {
      if (!tieneAccesoNexus(normalized, memberData)) {
        return Response.json({ error: 'Este código no tiene membresía activa de Sincronía Nexus.' }, { status: 403 });
      }
      const estado = estadoMembresia(normalized, {
        ...memberData,
        producto: 'sincronia_nexus',
      });
      if (estado.status === 'expired') {
        return Response.json({ error: 'Tu membresía de Sincronía Nexus expiró. Renueva tu plan.' }, { status: 403 });
      }
      return respuestaMembresia(estado, normalized, 'sincronia_nexus');
    }

    if (
      productoRequerido &&
      memberData.producto &&
      memberData.producto !== productoRequerido &&
      !miembroTieneProducto(memberData, productoRequerido)
    ) {
      const esperado = PRODUCTO_ETIQUETA[productoRequerido] || productoRequerido;
      return Response.json({ error: `Este código no corresponde a ${esperado}.` }, { status: 403 });
    }

    const producto = memberData.producto || productoRequerido || 'video_diamante_premium';
    return respuestaMembresia(estadoMembresia(normalized, memberData), normalized, producto);
  } catch (err) {
    console.error('Status error:', err);
    return Response.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
};
