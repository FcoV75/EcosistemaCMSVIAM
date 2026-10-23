import assert from 'node:assert/strict'
import {
  mapResendSendError,
  normalizeTipoMiembro,
  perfilCedulaPendiente,
  ONBOARDING_OFICIO_DESDE_MS,
  perfilNecesitaOnboarding,
  validateOnboardingInput,
  validateSignUpInput,
} from '../ContacNeed - Arquitectura Modular Diamante Estabilizada/src/lib/signup-validation.ts'

assert.equal(normalizeTipoMiembro('observador'), 'Observador')
assert.equal(normalizeTipoMiembro('OFICIO'), 'Oficio')
assert.equal(normalizeTipoMiembro('Profesión'), 'Profesion')
assert.equal(normalizeTipoMiembro('especialidad'), 'Especialidad')
assert.equal(normalizeTipoMiembro('raro'), 'Observador')

const base = {
  nombre: 'Ana Prueba',
  email: 'ana.prueba@example.com',
  password: 'secreto1',
}

const observador = validateSignUpInput({ ...base, tipo_miembro: 'Observador' })
assert.equal(observador.ok, true)
assert.equal(observador.value.habilidad_empirica, '')
assert.equal(observador.value.cedula, '')

const oficioSin = validateSignUpInput({ ...base, tipo_miembro: 'Oficio' })
assert.equal(oficioSin.ok, false)
assert.match(oficioSin.error, /oficio/i)

const oficioOk = validateSignUpInput({
  ...base,
  tipo_miembro: 'Oficio',
  habilidad_empirica: 'Carpintería',
  descripcion_profesion: 'Muebles a medida',
})
assert.equal(oficioOk.ok, true)
assert.equal(oficioOk.value.habilidad_empirica, 'Carpintería')

const profesionSinCedula = validateSignUpInput({
  ...base,
  tipo_miembro: 'Profesion',
  habilidad_empirica: 'Médico',
})
assert.equal(profesionSinCedula.ok, false)
assert.match(profesionSinCedula.error, /cédula/i)

const profesionOk = validateSignUpInput({
  ...base,
  tipo_miembro: 'Profesion',
  habilidad_empirica: 'Médico general',
  cedula: '1234567',
})
assert.equal(profesionOk.ok, true)
assert.equal(profesionOk.value.cedula, '1234567')

const especialidadOk = validateSignUpInput({
  ...base,
  tipo_miembro: 'Especialidad',
  habilidad_empirica: 'Cardiología',
  cedula: '7654321',
  descripcion_profesion: 'Consulta y seguimiento',
})
assert.equal(especialidadOk.ok, true)

const emailBad = validateSignUpInput({ ...base, email: 'no-es-correo', tipo_miembro: 'Observador' })
assert.equal(emailBad.ok, false)

const passBad = validateSignUpInput({ ...base, password: '123', tipo_miembro: 'Observador' })
assert.equal(passBad.ok, false)

assert.match(mapResendSendError('Domain not verified'), /dominio/i)
assert.match(mapResendSendError('Invalid API key'), /API key/i)

// Onboarding post-Google
const onbObs = validateOnboardingInput({ tipo_miembro: 'Observador' })
assert.equal(onbObs.ok, true)

const onbEstudiante = validateOnboardingInput({
  tipo_miembro: 'Profesion',
  habilidad_empirica: 'Estudiante de Medicina',
  es_estudiante: true,
})
assert.equal(onbEstudiante.ok, true)
assert.equal(onbEstudiante.value.tipo_miembro, 'Oficio')
assert.equal(onbEstudiante.value.es_estudiante, true)
assert.equal(onbEstudiante.value.cedula_pendiente, true)

const onbProfSin = validateOnboardingInput({
  tipo_miembro: 'Profesion',
  habilidad_empirica: 'Médico',
})
assert.equal(onbProfSin.ok, false)
assert.match(onbProfSin.error, /cédula|Oficio/i)

const antes = new Date(ONBOARDING_OFICIO_DESDE_MS - 86_400_000).toISOString()
const despues = new Date(ONBOARDING_OFICIO_DESDE_MS + 86_400_000).toISOString()

// Sin fecha o anterior a #87: la cuenta ya existía. No se reabre el formulario.
assert.equal(perfilNecesitaOnboarding({ tipo_miembro: null }), false)
assert.equal(perfilNecesitaOnboarding({ tipo_miembro: null, fecha_registro: antes }), false)
assert.equal(perfilNecesitaOnboarding({ tipo_miembro: '', fecha_registro: null }), false)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: antes,
    habilidad_empirica: 'Carpintería',
    descripcion_profesion: 'Muebles',
  }),
  false,
)

// Alta nueva (correo o Google) sin oficio: sí se pide, una sola vez.
assert.equal(
  perfilNecesitaOnboarding({ tipo_miembro: null, fecha_registro: despues }),
  true,
)
assert.equal(perfilNecesitaOnboarding({ tipo_miembro: 'Oficio', fecha_registro: despues }), false)
assert.equal(perfilNecesitaOnboarding({ tipo_miembro: 'Observador', fecha_registro: despues }), false)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    habilidad_empirica: 'Médico',
  }),
  false,
)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    descripcion_profesion: 'Consulta',
  }),
  false,
)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    cedula: '1234567',
  }),
  false,
)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    onboarding_completado_at: despues,
  }),
  false,
)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    onboarding_pospuesto_hasta: new Date(Date.now() + 60_000).toISOString(),
  }),
  false,
)
// Ya pospuso una vez (o el plazo venció): no volver a exigir el formulario al entrar.
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    onboarding_pospuestos: 1,
  }),
  false,
)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    fecha_registro: despues,
    onboarding_pospuesto_hasta: new Date(Date.now() - 60_000).toISOString(),
  }),
  false,
)
// Alta con más de 48 h: ya está dentro.
const haceTresDias = new Date(Date.now() - 3 * 86_400_000).toISOString()
assert.equal(
  perfilNecesitaOnboarding({ tipo_miembro: null, fecha_registro: haceTresDias }),
  false,
)
// Google abrió otro id, pero el correo ya tenía perfil. No se pide otra vez ni se toca la fila vieja.
assert.equal(
  perfilNecesitaOnboarding(
    { tipo_miembro: null, fecha_registro: despues, correo: 'dueno@example.com' },
    { otrasCuentasMismoCorreo: [{ tipo_miembro: 'Oficio', fecha_registro: antes }] },
  ),
  false,
)
assert.equal(
  perfilNecesitaOnboarding(
    { tipo_miembro: null, fecha_registro: despues },
    { otrasCuentasMismoCorreo: [{ tipo_miembro: null, fecha_registro: antes, habilidad_empirica: 'Albañil' }] },
  ),
  false,
)
assert.equal(
  perfilCedulaPendiente({ es_estudiante: true, cedula: null }),
  true,
)
assert.equal(
  perfilCedulaPendiente({ es_estudiante: true, cedula: '123' }),
  false,
)

console.log('signup-validation ok — Observador/Oficio/Profesion/Especialidad + onboarding Google')
