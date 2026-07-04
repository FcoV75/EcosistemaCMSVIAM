import { getStore } from '@netlify/blobs';
import {
  esCodigoPropietario,
  esCodigoPropietarioNexus,
  estadoMembresia,
} from './member-helpers.mjs';
import { resolverMiembroDual } from './entitlements-db.mjs';

function openBlobStore(name) {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  if (siteID && token) return getStore(name, { siteID, token });
  return getStore(name);
}

export async function obtenerMiembro(code, userId = null) {
  const normalized = String(code || '').trim().toUpperCase();
  if ((!normalized || normalized.length < 5) && !userId) {
    return { normalized: normalized || null, memberData: null };
  }

  const dual = await resolverMiembroDual(normalized, userId);
  if (dual.memberData) return dual;

  if (!normalized || normalized.length < 5) return { normalized: null, memberData: null };
  const store = openBlobStore('nexus-members');
  const memberData = await store.get(normalized, { type: 'json' });
  return { normalized, memberData };
}
export function entitlementsDe(memberData) {
  const list = Array.isArray(memberData?.entitlements) ? [...memberData.entitlements] : [];
  if (memberData?.producto && !list.includes(memberData.producto)) {
    list.push(memberData.producto);
  }
  return [...new Set(list)];
}

export function tieneAccesoNexus(code, memberData) {
  if (esCodigoPropietarioNexus(code)) return true;
  if (!memberData) return false;
  const ents = entitlementsDe(memberData);
  if (!ents.includes('sincronia_nexus') && memberData.producto !== 'sincronia_nexus') {
    return false;
  }
  return estadoMembresia(code, memberData).status !== 'expired';
}

export function tieneAccesoLibros(code, memberData, libroSlug = null) {
  if (esCodigoPropietario(code)) return true;
  if (!memberData) return false;
  const ents = entitlementsDe(memberData);
  const compraCms =
    ents.includes('ecosistema_cms_compra') ||
    memberData.producto === 'ecosistema_cms_compra' ||
    memberData.detalle === 'obra_literaria' ||
    memberData.detalle === 'cms_general' ||
    memberData.detalle === 'sincronia_nexus_mixto';

  if (!compraCms) return false;
  if (estadoMembresia(code, memberData).status === 'expired') return false;

  if (!libroSlug) return true;
  const comprados = memberData.librosComprados;
  if (!Array.isArray(comprados) || comprados.length === 0) return true;
  return comprados.includes(libroSlug);
}

export function tieneAccesoConsulta(code, memberData) {
  if (esCodigoPropietario(code)) return true;
  if (!memberData) return false;
  const ents = entitlementsDe(memberData);
  return (
    ents.includes('consulta_cms') ||
    memberData.detalle === 'consulta_cms' ||
    memberData.detalle === 'cms_general' ||
    memberData.detalle === 'sincronia_nexus_mixto'
  );
}
