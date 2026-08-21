import { getStore } from '@netlify/blobs';
import { autorizarTurno, hidratarSesion, registrarTurno } from './nexus-sesion.mjs';

function openStore() {
  return getStore('nexus-chat-sesion');
}

export async function leerSesionChat(clave) {
  if (!clave) return hidratarSesion(null);
  try {
    const store = openStore();
    const data = await store.get(clave, { type: 'json' });
    return hidratarSesion(data);
  } catch (err) {
    console.warn('nexus-sesion leer:', err?.message || err);
    return hidratarSesion(null);
  }
}

export async function escribirSesionChat(clave, sesion) {
  if (!clave) return false;
  try {
    const store = openStore();
    await store.setJSON(clave, sesion);
    return true;
  } catch (err) {
    console.warn('nexus-sesion escribir:', err?.message || err);
    return false;
  }
}

export async function abrirTurnoChat(clave, opts) {
  const previa = await leerSesionChat(clave);
  return autorizarTurno(previa, opts);
}

export async function confirmarTurnoChat(clave, sesion, turno) {
  const next = registrarTurno(sesion, turno);
  await escribirSesionChat(clave, next);
  return next;
}
