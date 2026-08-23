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
import { generarCodigoReferido } from '../lib/gamificacion'
import { registrarReferidoEnSignup } from './gamificacion.functions'
import {
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

async function establishSessionFromAuthParams(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: URLSearchParams,
  invalidMessage: string,
) {
  const code = params.get('code')
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw new Error(error.message)
    return data
  }

  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (error) throw new Error(error.message)
    return data
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw new Error(error.message)
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
              es_pro: Boolean(profile.es_pro),
              verificado: Boolean(profile.verificado),
              es_fundador: Boolean(profile.es_fundador),
              avatar_url: profile.avatar_url,
              bloqueado: Boolean(profile.bloqueado),
            }
          : null,
        isAdmin: Boolean(profile?.is_admin),
      }
    } catch {
      return {
        user: { id: user.id, email: user.email ?? undefined },
        profile: null,
        isAdmin: false,
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
    return 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada y la carpeta de spam.'
  }
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('invalid_credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Demasiados intentos. Espera un minuto y vuelve a entrar.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'No se pudo conectar con la cuenta. Intenta de nuevo en unos segundos.'
  }
  return message || 'No se pudo iniciar sesión.'
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
    return 'Este correo ya está registrado. Revisa tu bandeja de confirmación o inicia sesión.'
  }
  if (msg.includes('database error updating user') || msg.includes('database error saving new user')) {
    return `No se pudo completar el registro para ${email}. Suele pasar si ya intentaste registrarte antes con este correo, o si falta actualizar Supabase (script 007). Prueba iniciar sesión o usa otro correo; si persiste, contacta soporte.`
  }
  if (msg.includes('password')) {
    return 'La contraseña no cumple los requisitos mínimos de seguridad (mínimo 6 caracteres).'
  }
  return message
}

function normalizeTipoMiembro(
  value: string | undefined | null,
): 'Observador' | 'Oficio' | 'Profesion' | 'Especialidad' {
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

  const full = await admin.from('perfiles').upsert(payload, { onConflict: 'id' })
  if (!full.error) return

  // Si el check antiguo aún no se actualizó, reintenta con minúsculas (legado)
  if (String(full.error.message).includes('perfiles_tipo_miembro_check')) {
    const legacyPayload = {
      ...payload,
      tipo_miembro: tipoMiembro.toLowerCase(),
    }
    const legacy = await admin.from('perfiles').upsert(legacyPayload, { onConflict: 'id' })
    if (!legacy.error) return
    throw new Error(
      `No se pudo guardar el perfil: ${legacy.error.message}. Ejecuta en Supabase el SQL 014_fix_tipo_miembro_observador.sql`,
    )
  }

  const { fecha_registro: _fecha, ...withoutFecha } = payload
  const fallback = await admin.from('perfiles').upsert(withoutFecha, { onConflict: 'id' })
  if (fallback.error) {
    throw new Error(`No se pudo guardar el perfil: ${fallback.error.message}`)
  }
}

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator((d: SignUpInput) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const admin = createSupabaseAdminClient()
    const email = data.email.trim().toLowerCase()
    const redirectTo = `${getSiteUrl()}/auth/confirm`
    const resend = getResendConfig()

    let userId: string
    let emailConfirmed = false
    let needsEmailConfirmation = true
    let confirmationSentViaResend = false

    if (resend.enabled) {
      // Crea usuario + enlace sin que Supabase mande su propio correo (evita doble envío).
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'signup',
        email,
        password: data.password,
        options: {
          redirectTo,
          data: { nombre: data.nombre.trim() },
        },
      })
      if (linkError) {
        throw new Error(mapSignUpError(linkError.message, email))
      }

      userId = linkData.user?.id || ''
      if (!userId) throw new Error('No se pudo crear la cuenta')
      emailConfirmed = Boolean(linkData.user?.email_confirmed_at)

      const actionLink = linkData.properties?.action_link
      if (!actionLink) {
        throw new Error('No se pudo generar el enlace de confirmación.')
      }

      const sent = await sendSignupConfirmEmailViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to: email,
        actionLink,
        nombre: data.nombre,
      })
      if (!sent.ok) {
        throw new Error(
          `Cuenta creada, pero no se pudo enviar el correo de confirmación. Verifica dominio y RESEND_FROM. ${sent.error}`,
        )
      }
      confirmationSentViaResend = true
      needsEmailConfirmation = !emailConfirmed
    } else {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { nombre: data.nombre.trim() },
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

    await saveSignupProfile(admin, userId, email, data, emailConfirmed)

    await admin.from('perfiles').update({
      codigo_referido: generarCodigoReferido(userId),
    }).eq('id', userId)

    await registrarReferidoEnSignup(admin, userId, data.codigo_referido)

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

export const confirmEmailFromLinkFn = createServerFn({ method: 'GET' })
  .inputValidator((search: string) => search)
  .handler(async ({ data: search }) => {
    const supabase = createSupabaseServerClient()
    const params = parseAuthLinkParams(search)
    const sessionData = await establishSessionFromAuthParams(
      supabase,
      params,
      'Enlace de confirmación inválido o expirado.',
    )

    if (sessionData.user?.id) {
      const admin = createSupabaseAdminClient()
      await admin
        .from('perfiles')
        .update({ verificado: true })
        .eq('id', sessionData.user.id)
    }

    return { success: true }
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

      const actionLink = linkData?.properties?.action_link
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

type UpdateProfileInput = {
  nombre?: string
  habilidad_empirica?: string
  descripcion_profesion?: string
  estado?: string
  municipio?: string
  avatar_url?: string
}

export const updateProfileFn = createServerFn({ method: 'POST' })
  .inputValidator((d: UpdateProfileInput) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase.from('perfiles').upsert(
      {
        id: user.id,
        nombre: data.nombre,
        habilidad_empirica: data.habilidad_empirica,
        descripcion_profesion: data.descripcion_profesion,
        estado: data.estado,
        municipio: data.municipio,
        avatar_url: data.avatar_url,
      },
      { onConflict: 'id' },
    )

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
