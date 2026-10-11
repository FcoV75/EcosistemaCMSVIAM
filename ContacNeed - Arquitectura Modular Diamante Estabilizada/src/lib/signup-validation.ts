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
