import assert from 'node:assert/strict'
import {
  mapResendSendError,
  normalizeTipoMiembro,
  perfilCedulaPendiente,
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

assert.equal(perfilNecesitaOnboarding({ tipo_miembro: null }), true)
assert.equal(perfilNecesitaOnboarding({ tipo_miembro: 'Oficio' }), false)
assert.equal(
  perfilNecesitaOnboarding({
    tipo_miembro: null,
    onboarding_pospuesto_hasta: new Date(Date.now() + 60_000).toISOString(),
  }),
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
