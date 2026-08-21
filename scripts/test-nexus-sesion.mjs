import {
  PLAN_MIEMBRO,
  PLAN_PUBLICO,
  PLANES,
  autorizarTurno,
  hidratarSesion,
  registrarTurno,
  restanteMsDe,
  sesionVacia,
} from '../netlify/functions/lib/nexus-sesion.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const t0 = Date.parse('2026-08-19T18:00:00.000Z');

const vacia = sesionVacia(t0);
assert(vacia.mensajes === 0 && !vacia.musica, 'sesión vacía');

const primera = autorizarTurno(null, { now: t0, plan: PLAN_PUBLICO });
assert(primera.ok && primera.esPrimera && primera.restanteMs === PLANES.publico.ventanaMs, 'primera pública');

let s = registrarTurno(primera.sesion, {
  mensaje: 'hola',
  reply: 'consejo',
  musica: { frecuenciaHz: 528, audioUrl: 'x' },
  now: t0,
});
assert(s.mensajes === 1 && s.musica.frecuenciaHz === 528, 'registra música una vez');

const follow = autorizarTurno(s, { now: t0 + 60_000, plan: PLAN_PUBLICO });
assert(follow.ok && follow.esPrimera === false, 'seguimiento sin música nueva');

s = registrarTurno(follow.sesion, { mensaje: 'más', reply: 'sigue', now: t0 + 60_000 });
assert(s.musica.frecuenciaHz === 528, 'no pisa la música del día');

const tarde = autorizarTurno(s, { now: t0 + PLANES.publico.ventanaMs + 1000, plan: PLAN_PUBLICO });
assert(!tarde.ok && /10 minutos/.test(tarde.error), 'cierra a los 10 min públicos');

const miembro = autorizarTurno(
  registrarTurno(sesionVacia(t0), { mensaje: 'a', reply: 'b', musica: { frecuenciaHz: 417 }, now: t0 }),
  { now: t0 + 20 * 60 * 1000, plan: PLAN_MIEMBRO },
);
assert(miembro.ok && miembro.esPrimera === false, 'miembro sigue a los 20 min');

const miembroTarde = autorizarTurno(miembro.sesion, {
  now: t0 + PLANES.miembro.ventanaMs + 1,
  plan: PLAN_MIEMBRO,
});
assert(!miembroTarde.ok && /30 minutos/.test(miembroTarde.error), 'cierra a los 30 min miembro');

const owner = autorizarTurno(s, { now: t0 + 3 * 60 * 60 * 1000, plan: PLAN_MIEMBRO, permanente: true });
assert(owner.ok && owner.restanteMs === null, 'propietario sin reloj');

const restanteA1min = restanteMsDe(
  registrarTurno(sesionVacia(t0), { mensaje: 'a', reply: 'b', musica: { frecuenciaHz: 528 }, now: t0 }),
  { now: t0 + 60_000, plan: PLAN_PUBLICO },
);
assert(restanteA1min === PLANES.publico.ventanaMs - 60_000, 'reloj público descuenta el minuto real');

const restanteOwner = restanteMsDe(s, { plan: PLAN_MIEMBRO, permanente: true });
assert(restanteOwner === null, 'reloj del propietario no cuenta');

const otroDia = hidratarSesion(s, t0 + 26 * 60 * 60 * 1000);
assert(otroDia.mensajes === 0 && !otroDia.musica, 'nuevo día reinicia');

console.log('nexus-sesion: ok');
