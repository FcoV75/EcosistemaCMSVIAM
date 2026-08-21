import { aplicarTripleFiltro, detectarVetos, elegirSkills, validarPercepcion } from '../netlify/functions/lib/organo-kernel.mjs';
import { contratoPublico, canalPermitidoEnModo } from '../netlify/functions/lib/organo-contratos.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const contrato = contratoPublico();
assert(contrato.id === 'sincronia-nexus-presencia', 'id del órgano');
assert(contrato.memoria.crudoSensorial === 'nunca_nube', 'crudo nunca a la nube');
assert(!canalPermitidoEnModo('terapia', 'ojo'), 'terapia no abre el ojo');
assert(canalPermitidoEnModo('calle', 'ojo'), 'calle puede abrir el ojo con opt-in');

const negado = validarPercepcion({
  modo: 'terapia',
  percepcion: { ojo: true },
  consentimientos: { ojo: true },
});
assert(!negado.ok, 'ojo en terapia debe fallar');

const sinConsent = validarPercepcion({
  modo: 'calle',
  percepcion: { voz: true },
  consentimientos: { voz: false },
});
assert(!sinConsent.ok, 'voz sin consentimiento');

const okVoz = validarPercepcion({
  modo: 'terapia',
  percepcion: { voz: true },
  consentimientos: { voz: true },
});
assert(okVoz.ok && okVoz.faro.voz, 'faro de voz');

const crudo = validarPercepcion({
  modo: 'calle',
  percepcion: { frameBase64: 'abc' },
  consentimientos: { ojo: true },
});
assert(!crudo.ok, 'fotograma crudo prohibido');

const filtroActuar = aplicarTripleFiltro('Hoy necesito pedir ayuda a un terapeuta y puedo llamar.');
assert(filtroActuar.veredicto === 'actuar' || filtroActuar.veredicto === 'pedir_ayuda', 'veredicto útil');

const filtroSoltar = aplicarTripleFiltro('Voy a humillar y arruinar a esa persona.');
assert(filtroSoltar.veredicto === 'soltar', 'daño se suelta');

const vetos = detectarVetos('preséntame con ese terapeuta y págale ahora');
assert(
  vetos.some((v) => v.tipo === 'presentar_contacto') && vetos.some((v) => v.tipo === 'mover_dinero'),
  'vetos de presentación y pago',
);

const skills = elegirSkills({
  modo: 'calle',
  mensaje: 'necesito un terapeuta de hombro en Aguascalientes',
  filtro: filtroActuar,
  vetosPendientes: vetos,
});
assert(skills.includes('encuentro'), 'skill encuentro en calle');

console.log('organo-piloto contratos: ok');
