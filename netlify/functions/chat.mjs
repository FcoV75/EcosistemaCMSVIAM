import { getClientIp, hashIp } from './lib/rate-limit.mjs';
import {
  FRECUENCIAS_SOLFEGGIO,
  ONDAS_CEREBRALES,
  elegirPistaCatalogo,
  normalizarDiagnostico,
  parsearRespuestaIA,
} from './lib/nexus-frequencies.mjs';
import { PLAN_PUBLICO, payloadMusica, restanteMsDe } from './lib/nexus-sesion.mjs';
import { abrirTurnoChat, confirmarTurnoChat } from './lib/nexus-sesion-store.mjs';
import {
  PROMPT_PRIMERA_PUBLICA,
  PROMPT_SEGUIMIENTO_PUBLICA,
  consultarGroqNexus,
  groqKey,
} from './lib/nexus-groq.mjs';

function clavePublica(req) {
  return `public:${hashIp(getClientIp(req))}`;
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
    const { message } = await req.json();
    if (!message?.trim()) {
      return Response.json({ error: 'Mensaje vacío.' }, { status: 400 });
    }

    if (!groqKey()) {
      return Response.json({ error: 'IA no configurada (GROQ_API_KEY).' }, { status: 503 });
    }

    const clave = clavePublica(req);
    const turno = await abrirTurnoChat(clave, { plan: PLAN_PUBLICO, permanente: false });
    if (!turno.ok) {
      return Response.json({ error: turno.error, sesion: { restanteMs: 0, plan: 'publico' } }, { status: 429 });
    }

    const { raw } = await consultarGroqNexus({
      system: turno.esPrimera ? PROMPT_PRIMERA_PUBLICA : PROMPT_SEGUIMIENTO_PUBLICA,
      historia: turno.sesion.historia,
      message: message.trim(),
    });
    if (!raw) {
      return Response.json(
        { error: 'Sincronía Nexus no pudo responder en este momento. Intenta de nuevo en unos minutos.' },
        { status: 502 },
      );
    }

    const parsed = parsearRespuestaIA(raw);
    const reply = parsed.respuesta || raw;
    let musica = turno.sesion.musica;
    let nuevaMusica = false;
    if (turno.esPrimera) {
      const diag = normalizarDiagnostico(parsed);
      const pista = elegirPistaCatalogo(diag.frecuenciaHz, `public:${clave}:${turno.sesion.day}`);
      musica = empaquetarMusica(diag, pista);
      nuevaMusica = Boolean(musica.audioUrl);
    }

    const next = await confirmarTurnoChat(clave, turno.sesion, {
      mensaje: message.trim(),
      reply,
      musica,
    });

    return Response.json({
      reply,
      esPrimera: turno.esPrimera,
      nuevaMusica,
      sesion: {
        plan: 'publico',
        restanteMs: restanteMsDe(next, { plan: PLAN_PUBLICO }),
        etiqueta: '10 minutos',
        mensajes: next.mensajes,
      },
      musicaDelDia: musica,
      ...payloadMusica(nuevaMusica ? musica : null),
    });
  } catch (err) {
    console.error('chat:', err);
    return Response.json({ error: 'Error al procesar tu solicitud.' }, { status: 500 });
  }
};
