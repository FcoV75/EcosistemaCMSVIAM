import { getStore } from '@netlify/blobs';
import {
  esCodigoPropietarioNexus,
  esMembresiaPermanente,
  estadoMembresia,
} from './lib/member-helpers.mjs';
import { obtenerMiembro, tieneAccesoNexus } from './lib/comprobante-helpers.mjs';
import { getUserFromBearer } from './lib/supabase-admin.mjs';
import { getClientIp, hashIp } from './lib/rate-limit.mjs';
import {
  FRECUENCIAS_SOLFEGGIO,
  ONDAS_CEREBRALES,
  elegirPistaCatalogo,
  normalizarDiagnostico,
  parsearRespuestaIA,
} from './lib/nexus-frequencies.mjs';
import { PLAN_MIEMBRO, PLAN_PUBLICO, payloadMusica, restanteMsDe } from './lib/nexus-sesion.mjs';
import { abrirTurnoChat, confirmarTurnoChat } from './lib/nexus-sesion-store.mjs';
import { consultarGroqNexus, groqKey } from './lib/nexus-groq.mjs';
import { contratoPublico, modoValido } from './lib/organo-contratos.mjs';
import {
  aplicarTripleFiltro,
  detectarVetos,
  elegirSkills,
  podarMemoria,
  resumenEpisodio,
  systemPromptOrgano,
  validarPercepcion,
} from './lib/organo-kernel.mjs';

function claveUso(memberData, normalized, userId) {
  return memberData?.legacy_code || normalized || (userId ? `USER-${userId}` : null);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders() });
}

async function leerMemoria(clave) {
  if (!clave) return podarMemoria({});
  try {
    const store = getStore('nexus-organo-memoria');
    const data = (await store.get(clave, { type: 'json' })) || {};
    return podarMemoria(data);
  } catch (err) {
    console.warn('organo memoria leer:', err?.message || err);
    return podarMemoria({});
  }
}

async function escribirMemoria(clave, memoria, consentimientos) {
  if (!clave || !consentimientos?.memoria) return false;
  try {
    const store = getStore('nexus-organo-memoria');
    await store.setJSON(clave, podarMemoria({ ...memoria, consentimientos }));
    return true;
  } catch (err) {
    console.warn('organo memoria escribir:', err?.message || err);
    return false;
  }
}

async function resolverMiembro(req, body) {
  const user = await getUserFromBearer(req);
  const normalized = body.code ? String(body.code).trim().toUpperCase() : null;
  if ((!normalized || normalized.length < 5) && !user) {
    return { error: 'Ingresa tu código CMS-XXXXXX o inicia sesión en Mi Ecosistema.', status: 401 };
  }
  if (normalized && esCodigoPropietarioNexus(normalized)) {
    const memberData = { producto: 'sincronia_nexus', plan: 'propietario', usage: {}, permanent: true };
    return { clave: normalized, memberData, esPermanente: true, publico: false };
  }
  const resuelto = await obtenerMiembro(normalized, user?.id);
  const memberData = resuelto.memberData;
  const clave = resuelto.normalized || normalized || claveUso(memberData, null, user?.id);
  if (!memberData || !clave) {
    return { error: 'Membresía no encontrada. Usa tu código o inicia sesión.', status: 404 };
  }
  if (!tieneAccesoNexus(clave, memberData)) {
    return { error: 'Este acceso no tiene Sincronía Nexus activa.', status: 403 };
  }
  const estado = estadoMembresia(clave, { ...memberData, producto: 'sincronia_nexus' });
  if (estado.status === 'expired') {
    return { error: 'Tu membresía ha concluido. Renueva para continuar en el Santuario.', status: 403 };
  }
  return {
    clave,
    memberData,
    esPermanente: esMembresiaPermanente(clave, memberData),
    publico: false,
  };
}

function armarRespuesta({
  parsed,
  rawText,
  musica,
  nuevaMusica,
  modo,
  faro,
  filtro,
  skillsInvocados,
  vetosPendientes,
  silencio,
  memoriaGuardada,
  sesion,
  percepcionOk,
}) {
  return {
    contrato: contratoPublico(),
    modo,
    faro,
    percepcion: percepcionOk,
    filtro,
    skillsInvocados,
    vetosPendientes,
    silencio,
    reply: silencio && parsed.respuesta ? parsed.respuesta : parsed.respuesta || rawText,
    loQueNoHare: parsed.lo_que_no_hare || 'No diagnostico, no presento, no cobro y no grabo sin tu veto.',
    preguntaVeto: parsed.pregunta_veto || (vetosPendientes[0]?.resumen ?? null),
    esPrimera: Boolean(nuevaMusica || sesion?.esPrimera),
    nuevaMusica: Boolean(nuevaMusica),
    sesion,
    musicaDelDia: musica,
    memoriaGuardada,
    consultasRestantes: null,
    ...payloadMusica(musica),
    audioUrl: nuevaMusica ? musica?.audioUrl || null : null,
  };
}

async function turno({ req, body, publico }) {
  const modo = modoValido(body.modo);
  const percepcion = body.percepcion || {};
  const consentimientos = {
    voz: Boolean(body.consentimientos?.voz),
    ojo: Boolean(body.consentimientos?.ojo),
    memoria: body.consentimientos?.memoria !== false,
    clinica: Boolean(body.consentimientos?.clinica),
  };
  const percepcionOk = validarPercepcion({ modo, percepcion, consentimientos });
  if (!percepcionOk.ok) {
    return json(
      {
        error: 'La percepción pedida rompe el contrato.',
        detalle: percepcionOk.errores,
        contrato: contratoPublico(),
        faro: { voz: false, ojo: false },
      },
      400,
    );
  }

  const mensaje = String(body.mensaje || percepcion.transcripcion || '').trim();
  const loQueVeo = String(percepcion.loQueVeo || '').trim().slice(0, 400);
  if (!mensaje) {
    return json({ error: 'No hay nada que escuchar todavía. Habla, escribe, o apaga el faro.' }, 400);
  }
  if (loQueVeo && !percepcionOk.faro.ojo) {
    return json({ error: '“Lo que veo” solo viaja si el ojo está consentido y el faro encendido.' }, 400);
  }

  const filtro = aplicarTripleFiltro(`${mensaje} ${loQueVeo}`);
  const vetosPendientes = detectarVetos(mensaje, percepcion);
  const skillsInvocados = elegirSkills({ modo, mensaje, filtro, vetosPendientes });
  const silencioSkill = skillsInvocados.includes('silencio') && filtro.veredicto === 'esperar';

  let clave = null;
  let esPermanente = false;
  if (!publico) {
    const miembro = await resolverMiembro(req, body);
    if (miembro.error) return json({ error: miembro.error }, miembro.status);
    clave = miembro.clave;
    esPermanente = miembro.esPermanente;
  }

  const claveSesion = publico ? `public:${hashIp(getClientIp(req))}` : `member:${clave}`;
  const turnoChat = await abrirTurnoChat(claveSesion, {
    plan: publico ? PLAN_PUBLICO : PLAN_MIEMBRO,
    permanente: esPermanente,
  });
  if (!turnoChat.ok) {
    return json({ error: turnoChat.error, sesion: { restanteMs: 0, plan: publico ? 'publico' : 'miembro' } }, 429);
  }

  const memoria = publico || !consentimientos.memoria ? podarMemoria({}) : await leerMemoria(clave);
  if (!groqKey()) return json({ error: 'IA no configurada (GROQ_API_KEY).' }, 503);

  const userBlock = [
    `Modo: ${modo}`,
    `Canales: voz=${percepcionOk.faro.voz ? 'faro' : 'off'} oido=${percepcionOk.oido ? 'on' : 'off'} ojo=${percepcionOk.faro.ojo ? 'faro' : 'off'}`,
    loQueVeo ? `Lo que veo (texto, sin fotograma): ${loQueVeo}` : 'Ojo: sin descripción.',
    `Mensaje: ${mensaje}`,
    vetosPendientes.length
      ? `Vetos detectados (NO ejecutar): ${vetosPendientes.map((v) => v.tipo).join(', ')}`
      : 'Sin veto pendiente.',
  ].join('\n');

  const { raw: rawText } = await consultarGroqNexus({
    system: systemPromptOrgano({
      modo,
      skills: skillsInvocados,
      filtro,
      memoria,
      publico,
      esPrimera: turnoChat.esPrimera,
    }),
    historia: turnoChat.sesion.historia,
    message: userBlock,
    temperature: 0.55,
  });
  if (!rawText) {
    return json(
      { error: 'Sincronía Nexus no pudo sintonizar en este momento. Intenta de nuevo en unos minutos.' },
      502,
    );
  }

  const parsed = parsearRespuestaIA(rawText);
  if (typeof parsed.silencio !== 'boolean') parsed.silencio = silencioSkill;
  if (parsed.respuesta && parsed.silencio !== true) parsed.silencio = Boolean(parsed.silencio);
  const silencio = Boolean(parsed.silencio) && filtro.veredicto !== 'actuar';

  let musica = turnoChat.sesion.musica;
  let nuevaMusica = false;
  let diag = musica
    ? {
        frecuenciaHz: musica.frecuenciaHz,
        frecuenciaEtiqueta: musica.frecuenciaEtiqueta,
        ondaCerebral: musica.ondaCerebral,
        fuenteAudio: musica.fuenteAudio,
        diagnosticoBreve: musica.diagnosticoBreve,
      }
    : normalizarDiagnostico(parsed);
  if (turnoChat.esPrimera) {
    diag = normalizarDiagnostico(parsed);
    const pista = elegirPistaCatalogo(diag.frecuenciaHz, `${claveSesion}:${turnoChat.sesion.day}`);
    const freqInfo = FRECUENCIAS_SOLFEGGIO[diag.frecuenciaHz];
    const ondaInfo = diag.ondaCerebral ? ONDAS_CEREBRALES[diag.ondaCerebral] : null;
    musica = {
      frecuenciaHz: diag.frecuenciaHz,
      frecuenciaEtiqueta: diag.frecuenciaEtiqueta,
      frecuenciaProposito: freqInfo?.proposito || '',
      ondaCerebral: diag.ondaCerebral,
      ondaEtiqueta: ondaInfo?.etiqueta || null,
      fuenteAudio: diag.fuenteAudio,
      diagnosticoBreve: diag.diagnosticoBreve,
      audioUrl: pista?.url || null,
      tituloPista: pista?.titulo || '',
    };
    nuevaMusica = Boolean(musica.audioUrl);
  }

  const nextChat = await confirmarTurnoChat(claveSesion, turnoChat.sesion, {
    mensaje,
    reply: parsed.respuesta || rawText,
    musica,
  });

  let memoriaGuardada = false;
  if (!publico && clave && consentimientos.memoria && !consentimientos.clinica) {
    const next = podarMemoria({
      ...memoria,
      modo,
      consentimientos,
      semantica: {
        ...(memoria.semantica || {}),
        ultimaFrecuencia: diag.frecuenciaHz,
      },
    });
    next.episodios.push(resumenEpisodio({ modo, mensaje, reply: parsed.respuesta, skills: skillsInvocados, filtro, silencio }));
    memoriaGuardada = await escribirMemoria(clave, next, consentimientos);
  }

  return json(
    armarRespuesta({
      parsed,
      rawText,
      musica,
      nuevaMusica,
      modo,
      faro: percepcionOk.faro,
      filtro,
      skillsInvocados,
      vetosPendientes,
      silencio,
      memoriaGuardada,
      sesion: {
        plan: publico ? 'publico' : 'miembro',
        restanteMs: restanteMsDe(nextChat, {
          plan: publico ? PLAN_PUBLICO : PLAN_MIEMBRO,
          permanente: esPermanente,
        }),
        etiqueta: publico ? '10 minutos' : '30 minutos',
        permanente: Boolean(esPermanente),
        esPrimera: turnoChat.esPrimera,
      },
      percepcionOk,
    }),
  );
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders() });

  if (req.method === 'GET') {
    return json({ contrato: contratoPublico() });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
  }

  try {
    const body = await req.json();
    const accion = String(body.accion || 'turno').toLowerCase();

    if (accion === 'contrato') {
      return json({ contrato: contratoPublico() });
    }

    if (accion === 'veto') {
      const decision = body.vetoDecision === 'aprobar' ? 'aprobar' : 'rechazar';
      if (decision === 'aprobar') {
        return json({
          ok: false,
          ejecutado: false,
          mensaje:
            'El órgano piloto aún no ejecuta vetos irreversibles (presentar, pagar, grabar, diagnosticar). Tu sí queda registrado como intención; la acción sigue siendo humana.',
          vetoId: body.vetoId || null,
        });
      }
      return json({
        ok: true,
        ejecutado: false,
        mensaje: 'Veto rechazado. El faro puede apagarse. Nada salió del Santuario.',
        vetoId: body.vetoId || null,
      });
    }

    if (accion === 'memoria') {
      const miembro = await resolverMiembro(req, body);
      if (miembro.error) return json({ error: miembro.error }, miembro.status);
      if (body.borrar) {
        await escribirMemoria(miembro.clave, podarMemoria({ episodios: [] }), { memoria: true });
        return json({ ok: true, memoria: podarMemoria({}), borrada: true });
      }
      const memoria = await leerMemoria(miembro.clave);
      return json({ ok: true, memoria });
    }

    if (accion === 'turno') {
      return turno({ req, body, publico: Boolean(body.publico) });
    }

    return json({ error: 'Acción no reconocida. Usa contrato, turno, memoria o veto.' }, 400);
  } catch (err) {
    console.error('organo-piloto:', err);
    return json({ error: 'Error al procesar el órgano de presencia.' }, 500);
  }
};
