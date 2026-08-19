import {
  esCodigoPropietarioNexus,
  esMembresiaPermanente,
  estadoMembresia,
} from './lib/member-helpers.mjs';
import { obtenerMiembro, tieneAccesoNexus } from './lib/comprobante-helpers.mjs';
import { getUserFromBearer } from './lib/supabase-admin.mjs';
import {
  FRECUENCIAS_SOLFEGGIO,
  ONDAS_CEREBRALES,
  elegirPistaCatalogo,
  normalizarDiagnostico,
  parsearRespuestaIA,
} from './lib/nexus-frequencies.mjs';
import { PLAN_MIEMBRO, payloadMusica } from './lib/nexus-sesion.mjs';
import { abrirTurnoChat, confirmarTurnoChat } from './lib/nexus-sesion-store.mjs';
import {
  PROMPT_PRIMERA_MIEMBRO,
  PROMPT_SEGUIMIENTO_MIEMBRO,
  consultarGroqNexus,
  groqKey,
} from './lib/nexus-groq.mjs';

function claveUso(memberData, normalized, userId) {
  return memberData?.legacy_code || normalized || (userId ? `USER-${userId}` : null);
}

function empaquetarMusica(diag, pista) {
  const freqInfo = FRECUENCIAS_SOLFEGGIO[diag.frecuenciaHz];
  const ondaInfo = diag.ondaCerebral ? ONDAS_CEREBRALES[diag.ondaCerebral] : null;
  return {
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
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, message } = await req.json();
    if (!message?.trim()) {
      return Response.json({ error: 'Falta tu mensaje para el Santuario.' }, { status: 400 });
    }

    const user = await getUserFromBearer(req);
    const normalized = code ? String(code).trim().toUpperCase() : null;

    if ((!normalized || normalized.length < 5) && !user) {
      return Response.json({ error: 'Ingresa tu código CMS-XXXXXX o inicia sesión en Mi Ecosistema.' }, { status: 400 });
    }

    if (normalized && esCodigoPropietarioNexus(normalized)) {
      const memberData = { producto: 'sincronia_nexus', plan: 'propietario', usage: {}, permanent: true };
      const estado = estadoMembresia(normalized, memberData);
      if (estado.status === 'expired') {
        return Response.json({ error: 'Tu membresía ha concluido. Renueva para continuar en el Santuario.' }, { status: 403 });
      }
      return await procesarChat(`member:${normalized}`, message, true);
    }

    const resuelto = await obtenerMiembro(normalized, user?.id);
    const memberData = resuelto.memberData;
    const clave = resuelto.normalized || normalized || claveUso(memberData, null, user?.id);

    if (!memberData || !clave) {
      return Response.json({ error: 'Membresía no encontrada. Usa tu código o inicia sesión.' }, { status: 404 });
    }

    if (!tieneAccesoNexus(clave, memberData)) {
      return Response.json({ error: 'Este acceso no tiene Sincronía Nexus activa.' }, { status: 403 });
    }

    const estado = estadoMembresia(clave, { ...memberData, producto: 'sincronia_nexus' });
    if (estado.status === 'expired') {
      return Response.json({ error: 'Tu membresía ha concluido. Renueva para continuar en el Santuario.' }, { status: 403 });
    }

    const esPermanente = esMembresiaPermanente(clave, memberData);
    return await procesarChat(`member:${clave}`, message, esPermanente);
  } catch (err) {
    console.error('member-chat:', err);
    return Response.json({ error: 'Ocurrió un error interno en el Santuario.' }, { status: 500 });
  }
};

async function procesarChat(claveSesion, message, esPermanente) {
  if (!groqKey()) {
    return Response.json({ error: 'El Santuario no está configurado (GROQ_API_KEY).' }, { status: 503 });
  }

  const turno = await abrirTurnoChat(claveSesion, { plan: PLAN_MIEMBRO, permanente: esPermanente });
  if (!turno.ok) {
    return Response.json({ error: turno.error, sesion: { restanteMs: 0, plan: 'miembro' } }, { status: 429 });
  }

  const { raw } = await consultarGroqNexus({
    system: turno.esPrimera ? PROMPT_PRIMERA_MIEMBRO : PROMPT_SEGUIMIENTO_MIEMBRO,
    historia: turno.sesion.historia,
    message: message.trim(),
  });
  if (!raw) {
    return Response.json({ error: 'Sincronía Nexus no pudo sintonizar en este momento. Intenta de nuevo.' }, { status: 502 });
  }

  const parsed = parsearRespuestaIA(raw);
  const reply = parsed.respuesta || raw;
  let musica = turno.sesion.musica;
  let nuevaMusica = false;
  if (turno.esPrimera) {
    const diag = normalizarDiagnostico(parsed);
    const pista = elegirPistaCatalogo(diag.frecuenciaHz, `${claveSesion}:${turno.sesion.day}`);
    musica = empaquetarMusica(diag, pista);
    nuevaMusica = Boolean(musica.audioUrl);
  }

  const next = await confirmarTurnoChat(claveSesion, turno.sesion, {
    mensaje: message.trim(),
    reply,
    musica,
  });

  return Response.json({
    reply,
    esPrimera: turno.esPrimera,
    nuevaMusica,
    sesion: {
      plan: 'miembro',
      restanteMs: esPermanente ? null : turno.restanteMs,
      etiqueta: '30 minutos',
      permanente: Boolean(esPermanente),
      mensajes: next.mensajes,
    },
    musicaDelDia: musica,
    consultasRestantes: null,
    ...payloadMusica(musica),
  });
}
