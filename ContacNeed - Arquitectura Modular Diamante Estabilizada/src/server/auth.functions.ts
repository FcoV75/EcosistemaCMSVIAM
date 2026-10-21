import { createServerFn } from '@tanstack/react-start'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../lib/supabase.server'
import { getSiteUrl } from '../lib/site-url'
import {
  isSoftRecoveryLookupError,
  mapRecoveryEmailError,
  sendRecoveryEmailViaResend,
} from '../lib/recovery-email'
import { getResendConfig, sendSignupConfirmEmailViaResend } from '../lib/privilege-email'
import {
  mapResendSendError,
  normalizeTipoMiembro,
  perfilCedulaPendiente,
  perfilNecesitaOnboarding,
  validateOnboardingInput,
  validateSignUpInput,
} from '../lib/signup-validation'
import { generarCodigoReferido } from '../lib/gamificacion'
import { registrarReferidoEnSignup } from './gamificacion.functions'
import {
  esCuentaDocenteEscuela,
  getServerProfile,
  getServerUser,
  requireActiveUser,
  requireAdminUser,
} from '../lib/auth'

function parseAuthLinkParams(search: string) {
  const raw = String(search || '')
  const normalized = raw
    .replace(/^\?/, '')
    .replace(/#/, '&')
    .replace(/^&/, '')
  return new URLSearchParams(normalized)
}

function mapAuthLinkError(message: string, fallback: string) {
  const msg = String(message || '').toLowerCase()
  if (
    msg.includes('otp_expired') ||
    msg.includes('email link is invalid or has expired') ||
    msg.includes('token has expired') ||
    msg.includes('invalid or has expired')
  ) {
    return 'Este enlace ya expiró o se usó. Escribe tu correo abajo para pedir uno nuevo, o inicia sesión si ya lo confirmaste.'
  }
  if (msg.includes('access_denied')) {
    return 'No se pudo validar el enlace. Pide uno nuevo con tu correo abajo.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Todavía falta confirmar el correo. Revisa tu bandeja o pide un enlace nuevo.'
  }
  return message || fallback
}

function isOtpExpiredMessage(message: string) {
  const msg = String(message || '').toLowerCase()
  return (
    msg.includes('otp_expired') ||
    msg.includes('email link is invalid or has expired') ||
    msg.includes('token has expired') ||
    msg.includes('invalid or has expired')
  )
}

/** Prefiere enlace directo a ContacNeed con token_hash (evita que un escáner de correo gaste el /verify de Supabase). */
function buildContacNeedAuthLink(
  path: '/auth/confirm' | '/auth/reset',
  properties: { hashed_token?: string | null; action_link?: string | null } | null | undefined,
  type: EmailOtpType,
  email?: string | null,
) {
  const hashed = String(properties?.hashed_token || '').trim()
  if (hashed) {
    const url = new URL(`${getSiteUrl()}${path}`)
    url.searchParams.set('token_hash', hashed)
    url.searchParams.set('type', type)
    const mail = String(email || '').trim().toLowerCase()
    if (mail) url.searchParams.set('email', mail)
    return url.toString()
  }
  return String(properties?.action_link || '').trim() || null
}

async function markPerfilVerificado(userId: string) {
  const admin = createSupabaseAdminClient()
  await admin.from('perfiles').update({ verificado: true }).eq('id', userId)
}

/** Si el OTP ya se gastó pero la sesión quedó confirmada (doble clic / red lenta), trata como éxito. */
async function sessionIfAlreadyConfirmed(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (user?.id && user.email_confirmed_at) {
    await markPerfilVerificado(user.id)
    return { user, session: null }
  }
  return null
}

async function establishSessionFromAuthParams(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: URLSearchParams,
  invalidMessage: string,
) {
  const linkError = params.get('error') || params.get('error_code')
  if (linkError) {
    const description =
      params.get('error_description')?.replace(/\+/g, ' ') ||
      params.get('error_code') ||
      linkError
    const already = await sessionIfAlreadyConfirmed(supabase)
    if (already && isOtpExpiredMessage(description)) return already
    throw new Error(mapAuthLinkError(description, invalidMessage))
  }

  const code = params.get('code')
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const already = await sessionIfAlreadyConfirmed(supabase)
      if (already && isOtpExpiredMessage(error.message)) return already
      throw new Error(mapAuthLinkError(error.message, invalidMessage))
    }
    return data
  }

  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  if (tokenHash && type) {
    // signup / magiclink / email: probar el type del link y respaldos (reenvíos mezclan tipos).
    const typesToTry = Array.from(
      new Set(
        [type, 'signup', 'magiclink', 'email'].filter(Boolean) as EmailOtpType[],
      ),
    )
    let lastError: { message: string } | null = null
    for (const otpType of typesToTry) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      })
      if (!error) return data
      lastError = error
      if (!isOtpExpiredMessage(error.message) && !/otp|token|type/i.test(error.message)) {
        break
      }
    }
    const already = await sessionIfAlreadyConfirmed(supabase)
    if (already) return already
    throw new Error(mapAuthLinkError(lastError?.message || '', invalidMessage))
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw new Error(mapAuthLinkError(error.message, invalidMessage))
    return data
  }

  throw new Error(invalidMessage)
}

export const getServerUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? undefined }
})

/** Sincroniza la sesión de Supabase en el navegador (necesario para Realtime). */
export const getSupabaseBrowserSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }
})

export const getSessionContextFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const supabase = createSupabaseServerClient()
    const user = await getServerUser()
    if (!user) return { user: null, profile: null, isAdmin: false }

    try {
      const profile = await getServerProfile(user.id)
      if (profile?.bloqueado) {
        await supabase.auth.signOut()
        return { user: null, profile: null, isAdmin: false }
      }

      return {
        user: { id: user.id, email: user.email ?? undefined },
        profile: profile
          ? {
              nombre: profile.nombre,
              estado: profile.estado,
              municipio: profile.municipio,
              habilidad_empirica: profile.habilidad_empirica,
              descripcion_profesion: profile.descripcion_profesion,
              tipo_miembro: profile.tipo_miembro,
              cedula: profile.cedula,
              es_estudiante: Boolean(profile.es_estudiante),
              cedula_pendiente: Boolean(profile.cedula_pendiente),
              onboarding_pospuestos: Number(profile.onboarding_pospuestos || 0),
              onboarding_pospuesto_hasta: profile.onboarding_pospuesto_hasta || null,
              onboarding_completado_at: profile.onboarding_completado_at || null,
              needs_onboarding: perfilNecesitaOnboarding(profile),
              needs_cedula_reminder: perfilCedulaPendiente(profile),
              es_pro: Boolean(profile.es_pro),
              verificado: Boolean(profile.verificado),
              es_fundador: Boolean(profile.es_fundador),
              avatar_url: profile.avatar_url,
              bloqueado: Boolean(profile.bloqueado),
            }
          : null,
        isAdmin: esCuentaDocenteEscuela({
          email: user.email,
          is_admin: profile?.is_admin,
          es_fundador: profile?.es_fundador,
        }),
      }
    } catch {
      return {
        user: { id: user.id, email: user.email ?? undefined },
        profile: null,
        isAdmin: esCuentaDocenteEscuela({ email: user.email }),
      }
    }
  } catch (err) {
    console.warn('getSessionContextFn no pudo leer sesión', err)
    return { user: null, profile: null, isAdmin: false }
  }
})

export const requireAdminUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await requireAdminUser()
  if (!admin) return null
  return {
    user: { id: admin.user.id, email: admin.user.email ?? undefined },
    profile: admin.profile,
  }
})

export const getServerProfileFn = createServerFn({ method: 'GET' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => getServerProfile(userId))

type SignInInput = { email: string; password: string }

function mapSignInError(message: string) {
  const msg = message.toLowerCase()
  if (msg.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de entrar. Abre el enlace del correo o entra a /auth/confirm para pedir uno nuevo.'
  }
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('invalid_credentials')) {
    return 'Correo o contraseña incorrectos. Si te registraste con Google, usa «Entrar con Google».'
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Demasiados intentos. Espera un minuto y vuelve a entrar.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'No se pudo conectar con la cuenta. Intenta de nuevo en unos segundos.'
  }
  return message || 'No se pudo iniciar sesión.'
}

function mapGoogleOAuthError(message: string) {
  const msg = message.toLowerCase()
  if (
    msg.includes('manual linking') ||
    msg.includes('identity is already linked') ||
    msg.includes('already linked') ||
    msg.includes('multiple accounts') ||
    msg.includes('email address is already')
  ) {
    return 'Este correo ya tiene cuenta en ContacNeed. Entra con tu contraseña o activa «Automatic linking» en Supabase Auth para unir Google con esa cuenta.'
  }
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return 'Google no está activo en Supabase Auth. Activa el proveedor Google e intenta de nuevo.'
  }
  if (msg.includes('redirect') && msg.includes('uri')) {
    return 'Hay un problema con la URI de redirección de Google. Revisa el Client OAuth en Google Cloud y Supabase.'
  }
  return (
    message ||
    'No se pudo iniciar con Google. Revisa que el proveedor Google esté activo en Supabase Auth.'
  )
}

export const signInFn = createServerFn({ method: 'POST' })
  .inputValidator((d: SignInInput) => d)
  .handler(async ({ data }) => {
    const email = String(data.email || '').trim().toLowerCase()
    const password = String(data.password || '')
    if (!email || !password) {
      throw new Error('Escribe tu correo y contraseña.')
    }

    const supabase = createSupabaseServerClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      throw new Error(mapSignInError(error.message))
    }

    try {
      const profile = authData.user ? await getServerProfile(authData.user.id) : null
      if (profile?.bloqueado) {
        await supabase.auth.signOut()
        throw new Error('Tu cuenta está suspendida. Contacta soporte.')
      }
    } catch (profileError) {
      if (profileError instanceof Error && profileError.message.includes('suspendida')) {
        throw profileError
      }
      console.warn('signIn: perfil no bloqueó el ingreso', profileError)
    }

    return { success: true }
  })

type SignUpInput = {
  email: string
  password: string
  nombre: string
  tipo_miembro: 'Observador' | 'Oficio' | 'Profesion' | 'Especialidad'
  codigo_referido?: string
  direccion?: string
  cp?: string
  celular?: string
  telefono?: string
  estado?: string
  municipio?: string
  comunidad?: string
  sexo?: string
  fecha_nacimiento?: string
  habilidad_empirica?: string
  descripcion_profesion?: string
  cedula?: string
}

function mapSignUpError(message: string, email: string) {
  const msg = message.toLowerCase()
  if (msg.includes('already been registered') || msg.includes('already exists') || msg.includes('already registered')) {
    return 'Este correo ya está registrado. Inicia sesión o usa «Entrar con Google» si así lo creaste.'
  }
  if (msg.includes('database error updating user') || msg.includes('database error saving new user')) {
    return `No se pudo completar el registro para ${email}. Suele pasar si ya intentaste registrarte antes con este correo, o si falta actualizar Supabase (script 007). Prueba iniciar sesión o usa otro correo; si persiste, contacta soporte.`
  }
  if (msg.includes('password')) {
    return 'La contraseña no cumple los requisitos mínimos de seguridad (mínimo 6 caracteres).'
  }
  return message
}

async function saveSignupProfile(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  email: string,
  data: SignUpInput,
  emailConfirmed: boolean,
) {
  const tipoMiembro = normalizeTipoMiembro(data.tipo_miembro)
  const needsCedula = tipoMiembro === 'Profesion' || tipoMiembro === 'Especialidad'

  const payload: Record<string, unknown> = {
    id: userId,
    nombre: data.nombre.trim(),
    correo: email,
    tipo_miembro: tipoMiembro,
    direccion: data.direccion?.trim() || null,
    cp: data.cp?.trim() || null,
    celular: data.celular?.trim() || data.telefono?.trim() || null,
    estado: data.estado?.trim() || null,
    municipio: data.municipio?.trim() || null,
    comunidad: data.comunidad?.trim() || null,
    sexo: data.sexo?.trim() || null,
    fecha_nacimiento: data.fecha_nacimiento?.trim() || null,
    habilidad_empirica:
      tipoMiembro === 'Observador' ? null : data.habilidad_empirica?.trim() || null,
    descripcion_profesion:
      tipoMiembro === 'Observador' ? null : data.descripcion_profesion?.trim() || null,
    cedula: needsCedula ? data.cedula?.trim() || null : null,
    verificado: emailConfirmed,
    es_pro: false,
    is_admin: false,
    bloqueado: false,
  }

  // Producción aún puede tener un CHECK viejo (sin Observador / con "Profesión" acentuada).
  // Probamos variantes hasta que una pase; SQL 014 deja el constraint definitivo.
  const tipoCandidates: Array<string | null> = [tipoMiembro, tipoMiembro.toLowerCase()]
  if (tipoMiembro === 'Profesion') {
    tipoCandidates.push('Profesión', 'profesión')
  }
  if (tipoMiembro === 'Observador') {
    // Observador no existía en el check antiguo: NULL permite completar el alta.
    tipoCandidates.push(null)
  }

  let lastError: string | null = null
  for (const tipoTry of tipoCandidates) {
    const attempt = { ...payload, tipo_miembro: tipoTry }
    const { error } = await admin.from('perfiles').upsert(attempt, { onConflict: 'id' })
    if (!error) return
    lastError = error.message
    if (!String(error.message).includes('perfiles_tipo_miembro_check')) break
  }

  throw new Error(
    `No se pudo guardar el perfil: ${lastError || 'error desconocido'}. ` +
      'Ejecuta en Supabase el SQL 014_fix_tipo_miembro_observador.sql',
  )
}

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator((d: SignUpInput) => d)
  .handler(async ({ data }) => {
    const parsed = validateSignUpInput(data)
    if (!parsed.ok) throw new Error(parsed.error)

    const supabase = createSupabaseServerClient()
    const admin = createSupabaseAdminClient()
    const email = parsed.value.email
    const redirectTo = `${getSiteUrl()}/auth/confirm`
    const resend = getResendConfig()
    const signupData: SignUpInput = {
      ...data,
      ...parsed.value,
    }

    let userId: string
    let emailConfirmed = false
    let needsEmailConfirmation = true
    let confirmationSentViaResend = false

    if (resend.enabled) {
      // Crea usuario + enlace sin que Supabase mande su propio correo (evita doble envío).
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'signup',
        email,
        password: parsed.value.password,
        options: {
          redirectTo,
          data: { nombre: parsed.value.nombre },
        },
      })
      if (linkError) {
        throw new Error(mapSignUpError(linkError.message, email))
      }

      userId = linkData.user?.id || ''
      if (!userId) throw new Error('No se pudo crear la cuenta')
      emailConfirmed = Boolean(linkData.user?.email_confirmed_at)

      const actionLink = buildContacNeedAuthLink(
        '/auth/confirm',
        linkData.properties,
        'signup',
        email,
      )
      if (!actionLink) {
        throw new Error('No se pudo generar el enlace de confirmación.')
      }

      const sent = await sendSignupConfirmEmailViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to: email,
        actionLink,
        nombre: parsed.value.nombre,
      })
      if (!sent.ok) {
        throw new Error(
          `Cuenta creada, pero no se pudo enviar el correo de confirmación. ${mapResendSendError(sent.error)}`,
        )
      }
      confirmationSentViaResend = true
      needsEmailConfirmation = !emailConfirmed
    } else {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: parsed.value.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { nombre: parsed.value.nombre },
        },
      })

      if (signUpError) {
        throw new Error(mapSignUpError(signUpError.message, email))
      }

      userId = signUpData.user?.id || ''
      if (!userId) throw new Error('No se pudo crear la cuenta')
      emailConfirmed = Boolean(signUpData.user?.email_confirmed_at)
      needsEmailConfirmation = !signUpData.session
    }

    await saveSignupProfile(admin, userId, email, signupData, emailConfirmed)

    await admin.from('perfiles').update({
      codigo_referido: generarCodigoReferido(userId),
    }).eq('id', userId)

    try {
      await registrarReferidoEnSignup(admin, userId, parsed.value.codigo_referido)
    } catch (refErr) {
      console.warn('registrarReferidoEnSignup:', refErr instanceof Error ? refErr.message : refErr)
    }

    if (!needsEmailConfirmation) {
      return {
        success: true,
        needsEmailConfirmation: false,
        message: 'Cuenta creada correctamente.',
      }
    }

    return {
      success: true,
      needsEmailConfirmation: true,
      message: confirmationSentViaResend
        ? 'Te enviamos un correo de confirmación desde ContacNeed. Abre el enlace para activar tu cuenta y luego inicia sesión.'
        : 'Te enviamos un correo de confirmación. Abre el enlace para activar tu cuenta y luego inicia sesión.',
    }
  })

/** POST: evita que un prefetch GET consuma el OTP. */
export const confirmEmailFromLinkFn = createServerFn({ method: 'POST' })
  .inputValidator((search: string) => search)
  .handler(async ({ data: search }) => {
    const supabase = createSupabaseServerClient()
    const params = parseAuthLinkParams(search)
    const sessionData = await establishSessionFromAuthParams(
      supabase,
      params,
      'Enlace de confirmación inválido o expirado. Pide uno nuevo con tu correo.',
    )

    if (sessionData.user?.id) {
      await markPerfilVerificado(sessionData.user.id)
    }

    return {
      success: true,
      email: sessionData.user?.email || null,
      alreadyConfirmed: Boolean(sessionData.user?.email_confirmed_at),
    }
  })

/** ¿La sesión actual ya tiene correo confirmado? (útil si el link viejo ya se usó). */
export const getEmailConfirmStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  if (!user) return { loggedIn: false, confirmed: false, email: null as string | null }
  return {
    loggedIn: true,
    confirmed: Boolean(user.email_confirmed_at),
    email: user.email || null,
  }
})

/** Reenvía confirmación cuando el enlace anterior expiró o lo gastó un escáner de correo. */
export const resendSignupConfirmFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const email = String(data.email || '').trim().toLowerCase()
    if (!email) throw new Error('Escribe tu correo electrónico.')

    const softSuccess = {
      success: true as const,
      message:
        'Si el correo está registrado y pendiente, te enviamos un enlace nuevo. Revisa bandeja y spam. Abre el correo nuevo y pulsa «Confirmar mi correo».',
    }

    const redirectTo = `${getSiteUrl()}/auth/confirm`
    const resend = getResendConfig()

    if (resend.enabled) {
      const admin = createSupabaseAdminClient()
      // magiclink funciona con cuentas ya creadas pendientes de confirmar.
      const { data: linkData, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      })
      if (error) {
        if (isSoftRecoveryLookupError(error.message)) return softSuccess
        throw new Error(mapAuthLinkError(error.message, mapResendSendError(error.message)))
      }

      if (linkData.user?.email_confirmed_at) {
        if (linkData.user.id) await markPerfilVerificado(linkData.user.id)
        return {
          success: true as const,
          message: 'Ese correo ya está confirmado. Puedes iniciar sesión normalmente.',
          alreadyConfirmed: true,
        }
      }

      const actionLink = buildContacNeedAuthLink(
        '/auth/confirm',
        linkData.properties,
        'magiclink',
        email,
      )
      if (!actionLink) return softSuccess

      const sent = await sendSignupConfirmEmailViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to: email,
        actionLink,
        nombre: (linkData.user?.user_metadata as { nombre?: string } | undefined)?.nombre,
      })
      if (!sent.ok) throw new Error(mapResendSendError(sent.error))
      return softSuccess
    }

    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (error && !isSoftRecoveryLookupError(error.message)) {
      throw new Error(mapAuthLinkError(error.message, error.message))
    }
    return softSuccess
  })

export const establishRecoverySessionFromLinkFn = createServerFn({ method: 'GET' })
  .inputValidator((search: string) => search)
  .handler(async ({ data: search }) => {
    const supabase = createSupabaseServerClient()
    const params = parseAuthLinkParams(search)
    await establishSessionFromAuthParams(
      supabase,
      params,
      'Enlace de recuperación inválido o expirado.',
    )
    return { success: true }
  })

export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase()
    if (!email) throw new Error('Ingresa tu correo electrónico.')

    const redirectTo = `${getSiteUrl()}/auth/reset`
    const softSuccess = {
      success: true as const,
      message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    }
    const resend = getResendConfig()

    if (resend.enabled) {
      const admin = createSupabaseAdminClient()
      const { data: linkData, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })
      if (error) {
        if (isSoftRecoveryLookupError(error.message)) return softSuccess
        throw new Error(mapRecoveryEmailError(error.message))
      }

      const actionLink = buildContacNeedAuthLink(
        '/auth/reset',
        linkData?.properties,
        'recovery',
        email,
      )
      if (!actionLink) {
        throw new Error('No se pudo generar el enlace de recuperación.')
      }

      const sent = await sendRecoveryEmailViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to: email,
        actionLink,
      })
      if (!sent.ok) {
        throw new Error(
          `No se pudo enviar el correo con Resend. Verifica dominio y RESEND_FROM. ${sent.error}`,
        )
      }
    } else {
      const supabase = createSupabaseServerClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        if (isSoftRecoveryLookupError(error.message)) return softSuccess
        throw new Error(mapRecoveryEmailError(error.message))
      }
    }

    return softSuccess
  })

export const updatePasswordFromResetFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    if (!data.password || data.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.')
    }
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) throw new Error(error.message)
    return { success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' }
  })

export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  return { success: true }
})

/** Inicia OAuth Google; el cliente redirige a data.url. */
export const getGoogleOAuthUrlFn = createServerFn({ method: 'POST' })
  .inputValidator((d?: { next?: string }) => d || {})
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const next = String(data?.next || '/').startsWith('/') ? String(data?.next || '/') : '/'
    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`
    const { data: oauth, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })
    if (error || !oauth?.url) {
      throw new Error(mapGoogleOAuthError(error?.message || ''))
    }
    return { url: oauth.url }
  })

async function ensureOAuthProfileRow(user: {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  user_metadata?: Record<string, unknown> | null
}) {
  const admin = createSupabaseAdminClient()
  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const nombre = String(
    meta.nombre || meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Miembro',
  ).trim()
  const avatar = String(meta.avatar_url || meta.picture || '').trim() || null
  const email = String(user.email || '').trim().toLowerCase()

  const { data: existing } = await admin
    .from('perfiles')
    .select('id, nombre, avatar_url, codigo_referido, tipo_miembro')
    .eq('id', user.id)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    id: user.id,
    correo: email || null,
    nombre: existing?.nombre && String(existing.nombre).trim().length >= 2 ? existing.nombre : nombre,
    avatar_url: existing?.avatar_url || avatar,
    verificado: Boolean(user.email_confirmed_at) || true,
    es_pro: false,
    is_admin: false,
    bloqueado: false,
  }

  const { error } = await admin.from('perfiles').upsert(payload, { onConflict: 'id' })
  if (error) {
    console.warn('ensureOAuthProfileRow:', error.message)
  }

  if (!existing?.codigo_referido) {
    await admin.from('perfiles').update({
      codigo_referido: generarCodigoReferido(user.id),
    }).eq('id', user.id)
  }

  return {
    needs_onboarding: !String(existing?.tipo_miembro || payload.tipo_miembro || '').trim(),
  }
}

/** Callback OAuth: intercambia code y asegura perfil mínimo. */
export const completeOAuthCallbackFn = createServerFn({ method: 'POST' })
  .inputValidator((search: string) => search)
  .handler(async ({ data: search }) => {
    try {
      const supabase = createSupabaseServerClient()
      const params = parseAuthLinkParams(search)
      const sessionData = await establishSessionFromAuthParams(
        supabase,
        params,
        'No se pudo completar el acceso con Google. Intenta de nuevo.',
      )
      const user = sessionData.user
      if (!user?.id) throw new Error('Google no devolvió una sesión válida.')

      if (user.id) await markPerfilVerificado(user.id)
      const ensured = await ensureOAuthProfileRow(user)

      return {
        success: true,
        email: user.email || null,
        needs_onboarding: ensured.needs_onboarding,
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err || '')
      throw new Error(mapGoogleOAuthError(raw))
    }
  })

export const completeMemberOnboardingFn = createServerFn({ method: 'POST' })
  .inputValidator((d: {
    tipo_miembro: string
    habilidad_empirica?: string
    descripcion_profesion?: string
    cedula?: string
    es_estudiante?: boolean
    estado?: string
    municipio?: string
  }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const parsed = validateOnboardingInput(data)
    if (!parsed.ok) throw new Error(parsed.error)

    const admin = createSupabaseAdminClient()
    const payload: Record<string, unknown> = {
      id: user.id,
      tipo_miembro: parsed.value.tipo_miembro,
      habilidad_empirica: parsed.value.habilidad_empirica || null,
      descripcion_profesion: parsed.value.descripcion_profesion || null,
      cedula: parsed.value.cedula || null,
      es_estudiante: parsed.value.es_estudiante,
      cedula_pendiente: parsed.value.cedula_pendiente,
      estado: parsed.value.estado || null,
      municipio: parsed.value.municipio || null,
      onboarding_completado_at: new Date().toISOString(),
      onboarding_pospuesto_hasta: null,
    }

    const { error } = await admin.from('perfiles').upsert(payload, { onConflict: 'id' })
    if (error) {
      if (String(error.message).includes('perfiles_tipo_miembro_check')) {
        throw new Error(
          'No se pudo guardar el tipo de miembro. Ejecuta en Supabase el SQL 014_fix_tipo_miembro_observador.sql',
        )
      }
      if (String(error.message).includes('es_estudiante') || String(error.message).includes('cedula_pendiente')) {
        throw new Error(
          'Falta actualizar la base: ejecuta en Supabase el SQL 015_google_onboarding.sql',
        )
      }
      throw new Error(`No se pudo completar tu registro: ${error.message}`)
    }

    return {
      success: true,
      message: parsed.value.cedula_pendiente
        ? 'Listo. Cuando tengas tu cédula profesional, regístrala en Mi Perfil; te lo recordaremos de vez en cuando.'
        : 'Perfil completado. ¡Bienvenido a ContacNeed!',
      tipo_miembro: parsed.value.tipo_miembro,
    }
  })

export const postponeMemberOnboardingFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user, profile } = await requireActiveUser()
  const admin = createSupabaseAdminClient()
  const prev = Number(profile?.onboarding_pospuestos || 0)
  if (prev >= 2) {
    return {
      success: true,
      postponed: false,
      message: 'Completa cómo quieres participar para publicar ofertas y destacar tu oficio.',
    }
  }

  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { error } = await admin
    .from('perfiles')
    .update({
      onboarding_pospuestos: prev + 1,
      onboarding_pospuesto_hasta: until,
    })
    .eq('id', user.id)

  if (error) {
    // Columnas aún no migradas: posponer solo en cliente.
    console.warn('postponeMemberOnboardingFn:', error.message)
    return { success: true, postponed: true, until, clientOnly: true }
  }

  return {
    success: true,
    postponed: true,
    until,
    remaining: Math.max(0, 1 - prev),
    message: 'Puedes completar tu oficio o profesión más tarde. Te lo pediremos de nuevo pronto.',
  }
})

type UpdateProfileInput = {
  nombre?: string
  habilidad_empirica?: string
  descripcion_profesion?: string
  estado?: string
  municipio?: string
  avatar_url?: string
  cedula?: string
  tipo_miembro?: string
  es_estudiante?: boolean
  cedula_pendiente?: boolean
}

export const updateProfileFn = createServerFn({ method: 'POST' })
  .inputValidator((d: UpdateProfileInput) => d)
  .handler(async ({ data }) => {
    const { user, profile } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()

    const patch: Record<string, unknown> = { id: user.id }
    if (data.nombre !== undefined) patch.nombre = data.nombre
    if (data.habilidad_empirica !== undefined) patch.habilidad_empirica = data.habilidad_empirica
    if (data.descripcion_profesion !== undefined) {
      patch.descripcion_profesion = data.descripcion_profesion
    }
    if (data.estado !== undefined) patch.estado = data.estado
    if (data.municipio !== undefined) patch.municipio = data.municipio
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url
    if (data.cedula !== undefined) {
      patch.cedula = String(data.cedula || '').trim() || null
      if (patch.cedula) {
        patch.cedula_pendiente = false
        patch.es_estudiante = false
      }
    }
    if (data.tipo_miembro !== undefined) {
      patch.tipo_miembro = normalizeTipoMiembro(data.tipo_miembro)
    }
    if (data.es_estudiante !== undefined) patch.es_estudiante = data.es_estudiante
    if (data.cedula_pendiente !== undefined) patch.cedula_pendiente = data.cedula_pendiente

    // Si sube cédula y era Oficio estudiante, puede pasar a Profesion opcionalmente vía tipo_miembro.
    if (patch.cedula && !patch.tipo_miembro && profile?.tipo_miembro === 'Oficio') {
      // se queda Oficio hasta que elija Profesion/Especialidad en onboarding/perfil
    }

    const { error } = await supabase.from('perfiles').upsert(patch, { onConflict: 'id' })

    if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`)
    return { success: true }
  })

export const requestPayPalProFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { plan: 'monthly' | 'annual' }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()
    const monto = data.plan === 'annual' ? 3000 : 300

    const { error } = await supabase.from('solicitudes_pro').insert({
      usuario_id: user.id,
      metodo: 'paypal',
      monto,
      estatus: 'pendiente',
      notas: `Plan ${data.plan === 'annual' ? 'anual' : 'mensual'} vía PayPal`,
    })

    if (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Sistema de solicitudes PRO en configuración. Contacta admin.')
      }
      throw error
    }

    return {
      success: true,
      message: 'Solicitud registrada. Tras pagar en PayPal, el admin activará tu PRO en minutos.',
    }
  })
