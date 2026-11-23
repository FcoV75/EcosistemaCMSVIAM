export const MEMBER_TYPES = ['Observador', 'Oficio', 'Profesion', 'Especialidad'] as const
export type MemberType = (typeof MEMBER_TYPES)[number]

export type SignUpFields = {
  email?: string
  password?: string
  nombre?: string
  tipo_miembro?: string | null
  habilidad_empirica?: string
  descripcion_profesion?: string
  cedula?: string
  celular?: string
  telefono?: string
  direccion?: string
  cp?: string
  estado?: string
  municipio?: string
  comunidad?: string
  sexo?: string
  fecha_nacimiento?: string
  codigo_referido?: string
}

export function normalizeTipoMiembro(value: string | undefined | null): MemberType {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (key === 'observador') return 'Observador'
  if (key === 'oficio') return 'Oficio'
  if (key === 'profesion') return 'Profesion'
  if (key === 'especialidad') return 'Especialidad'
  return 'Observador'
}

export function mapResendSendError(message: string) {
  const msg = String(message || '').toLowerCase()
  if (msg.includes('domain') && (msg.includes('not verified') || msg.includes('not found'))) {
    return 'El dominio de correo no está verificado en Resend. Revisa RESEND_FROM.'
  }
  if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('invalid api')) {
    return 'La API key de Resend no es válida. Revisa RESEND_API_KEY.'
  }
  if (msg.includes('rate') || msg.includes('too many')) {
    return 'Demasiados correos enviados. Espera un minuto e intenta de nuevo.'
  }
  return message || 'No se pudo enviar el correo de confirmación.'
}

/** Validación única client/server para que ningún tipo de registro falle por campos a medias. */
export type OnboardingFields = {
  tipo_miembro?: string | null
  habilidad_empirica?: string
  descripcion_profesion?: string
  cedula?: string
  es_estudiante?: boolean
  estado?: string
  municipio?: string
}

/** Onboarding post-Google (o perfil incompleto): sin email/contraseña. */
export function validateOnboardingInput(data: OnboardingFields) {
  let tipo = normalizeTipoMiembro(data.tipo_miembro)
  const habilidad = String(data.habilidad_empirica || '').trim()
  const cedula = String(data.cedula || '').trim()
  const descripcion = String(data.descripcion_profesion || '').trim()
  const esEstudiante = Boolean(data.es_estudiante)

  // Estudiantes/pasantes sin cédula → Oficio (como indica el producto).
  if (esEstudiante && (tipo === 'Profesion' || tipo === 'Especialidad') && !cedula) {
    tipo = 'Oficio'
  }

  if (!MEMBER_TYPES.includes(tipo)) {
    return { ok: false as const, error: 'Elige cómo quieres participar en ContacNeed.' }
  }

  if (tipo !== 'Observador' && !habilidad) {
    return {
      ok: false as const,
      error:
        tipo === 'Oficio'
          ? 'Indica el nombre de tu oficio, habilidad o que eres estudiante de…'
          : 'Indica tu profesión, licenciatura o especialidad.',
    }
  }

  if ((tipo === 'Profesion' || tipo === 'Especialidad') && !cedula) {
    return {
      ok: false as const,
      error:
        'La cédula profesional es obligatoria para Profesión o Especialidad. Si eres estudiante o pasante y aún no la tienes, elige Oficio y márcalo abajo.',
    }
  }

  return {
    ok: true as const,
    value: {
      tipo_miembro: tipo,
      habilidad_empirica: tipo === 'Observador' ? '' : habilidad,
      descripcion_profesion: tipo === 'Observador' ? '' : descripcion,
      cedula: tipo === 'Profesion' || tipo === 'Especialidad' ? cedula : '',
      es_estudiante: esEstudiante || (tipo === 'Oficio' && /estudiante|pasante/i.test(habilidad)),
      cedula_pendiente:
        esEstudiante ||
        (tipo === 'Oficio' && /estudiante|pasante/i.test(habilidad)),
      estado: String(data.estado || '').trim(),
      municipio: String(data.municipio || '').trim(),
    },
  }
}

/**
 * Momento en que se pidió oficio/profesión al entrar (#87, 2026-10-20 20:34 -0600).
 * Las cuentas anteriores no tienen `onboarding_completado_at` ni, a veces, `tipo_miembro`
 * (columna añadida después, nullable). Eso no las convierte en registros nuevos.
 */
export const ONBOARDING_OFICIO_DESDE_MS = Date.parse('2026-10-21T02:34:02.000Z')

/** Tras esto, solo recordatorio suave: no volver a exigir el formulario al entrar. */
export const ONBOARDING_VENTANA_MS = 48 * 60 * 60 * 1000

type PerfilOnboarding = {
  tipo_miembro?: string | null
  habilidad_empirica?: string | null
  descripcion_profesion?: string | null
  cedula?: string | null
  onboarding_completado_at?: string | null
  onboarding_pospuesto_hasta?: string | null
  onboarding_pospuestos?: number | null
  fecha_registro?: string | null
} | null

function textoPerfil(value: unknown) {
  return String(value || '').trim()
}

/** Ya contestó oficio/profesión, o el perfil guarda esos datos aunque falte el tipo. */
function perfilYaTieneOficio(profile: NonNullable<PerfilOnboarding>) {
  if (textoPerfil(profile.tipo_miembro)) return true
  if (textoPerfil(profile.onboarding_completado_at)) return true
  if (textoPerfil(profile.habilidad_empirica)) return true
  if (textoPerfil(profile.descripcion_profesion)) return true
  if (textoPerfil(profile.cedula)) return true
  return false
}

/**
 * Sin fecha, o fecha anterior al alta de Google: la cuenta ya existía.
 * No se rellena ninguna columna; solo se lee.
 */
function perfilAnteriorAlOnboarding(profile: NonNullable<PerfilOnboarding>) {
  const raw = textoPerfil(profile.fecha_registro)
  if (!raw) return true
  const registrado = Date.parse(raw)
  if (!Number.isFinite(registrado)) return true
  return registrado < ONBOARDING_OFICIO_DESDE_MS
}

/** Alta con más de 48 h: ya está «dentro»; no reabrir el formulario. */
function perfilFueraDeVentanaNueva(profile: NonNullable<PerfilOnboarding>) {
  const raw = textoPerfil(profile.fecha_registro)
  if (!raw) return true
  const registrado = Date.parse(raw)
  if (!Number.isFinite(registrado)) return true
  return Date.now() - registrado > ONBOARDING_VENTANA_MS
}

/**
 * El formulario de oficio/profesión es solo para un alta nueva reciente que aún no lo contestó.
 * Nunca se reabre para quienes ya pospusieron, llevan >48 h dentro, son anteriores a #87,
 * o ya tienen oficio/tipo/cédula. `otrasCuentasMismoCorreo` cubre Google con otro id.
 */
export function perfilNecesitaOnboarding(
  profile: PerfilOnboarding,
  ctx: { otrasCuentasMismoCorreo?: PerfilOnboarding[] } = {},
) {
  if (!profile) return false
  if (perfilYaTieneOficio(profile)) return false
  if (Number(profile.onboarding_pospuestos || 0) >= 1) return false
  const until = profile.onboarding_pospuesto_hasta
    ? Date.parse(profile.onboarding_pospuesto_hasta)
    : 0
  if (Number.isFinite(until) && until > 0) return false
  if (perfilAnteriorAlOnboarding(profile)) return false
  if (perfilFueraDeVentanaNueva(profile)) return false
  const otras = ctx.otrasCuentasMismoCorreo || []
  if (otras.some((row) => row && !perfilNecesitaOnboarding(row))) return false
  return true
}

export function perfilCedulaPendiente(profile: {
  es_estudiante?: boolean | null
  cedula_pendiente?: boolean | null
  cedula?: string | null
  tipo_miembro?: string | null
} | null) {
  if (!profile) return false
  if (profile.cedula && String(profile.cedula).trim()) return false
  return Boolean(profile.es_estudiante || profile.cedula_pendiente)
}

export function validateSignUpInput(data: SignUpFields) {
  const email = String(data.email || '').trim().toLowerCase()
  const password = String(data.password || '')
  const nombre = String(data.nombre || '').trim()
  const tipo = normalizeTipoMiembro(data.tipo_miembro)
  const habilidad = String(data.habilidad_empirica || '').trim()
  const cedula = String(data.cedula || '').trim()
  const descripcion = String(data.descripcion_profesion || '').trim()

  if (!nombre || nombre.length < 2) {
    return { ok: false as const, error: 'Escribe tu nombre completo.' }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: 'Escribe un correo electrónico válido.' }
  }
  if (!password || password.length < 6) {
    return {
      ok: false as const,
      error: 'La contraseña debe tener al menos 6 caracteres.',
    }
  }

  if (tipo !== 'Observador' && !habilidad) {
    return {
      ok: false as const,
      error:
        tipo === 'Oficio'
          ? 'Indica el nombre de tu oficio o habilidad.'
          : 'Indica tu profesión, licenciatura o especialidad.',
    }
  }

  if ((tipo === 'Profesion' || tipo === 'Especialidad') && !cedula) {
    return { ok: false as const, error: 'La cédula profesional es obligatoria para este tipo de registro.' }
  }

  return {
    ok: true as const,
    value: {
      email,
      password,
      nombre,
      tipo_miembro: tipo,
      habilidad_empirica: tipo === 'Observador' ? '' : habilidad,
      descripcion_profesion: tipo === 'Observador' ? '' : descripcion,
      cedula: tipo === 'Profesion' || tipo === 'Especialidad' ? cedula : '',
      celular: String(data.celular || data.telefono || '').trim(),
      direccion: String(data.direccion || '').trim(),
      cp: String(data.cp || '').trim(),
      estado: String(data.estado || '').trim(),
      municipio: String(data.municipio || '').trim(),
      comunidad: String(data.comunidad || '').trim(),
      sexo: String(data.sexo || '').trim(),
      fecha_nacimiento: String(data.fecha_nacimiento || '').trim(),
      codigo_referido: String(data.codigo_referido || '').trim().toUpperCase() || undefined,
    },
  }
}
