import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../lib/supabase.server'
import { getSiteUrl } from '../lib/site-url'
import {
  getServerProfile,
  getServerUser,
  requireActiveUser,
  requireAdminUser,
} from '../lib/auth'

export const getServerUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? undefined }
})

export const getSessionContextFn = createServerFn({ method: 'GET' }).handler(async () => {
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

export const signInFn = createServerFn({ method: 'POST' })
  .inputValidator((d: SignInInput) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email.trim(),
      password: data.password,
    })
    if (error) {
      const msg = error.message
      if (msg.toLowerCase().includes('email not confirmed')) {
        throw new Error(
          'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada y la carpeta de spam.',
        )
      }
      throw new Error(msg)
    }

    const profile = authData.user ? await getServerProfile(authData.user.id) : null
    if (profile?.bloqueado) {
      await supabase.auth.signOut()
      throw new Error('Tu cuenta está suspendida. Contacta soporte.')
    }

    return { success: true }
  })

type SignUpInput = {
  email: string
  password: string
  nombre: string
  tipo_miembro: 'Observador' | 'Oficio' | 'Profesion' | 'Especialidad'
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

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator((d: SignUpInput) => d)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const admin = createSupabaseAdminClient()
    const email = data.email.trim()

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
        data: { nombre: data.nombre.trim() },
      },
    })

    if (signUpError) {
      const msg = signUpError.message
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        throw new Error('Este correo ya está registrado. Inicia sesión.')
      }
      throw new Error(msg)
    }

    const userId = signUpData.user?.id
    if (!userId) throw new Error('No se pudo crear la cuenta')

    const needsCedula = data.tipo_miembro === 'Profesion' || data.tipo_miembro === 'Especialidad'

    const { error: profileError } = await admin.from('perfiles').upsert(
      {
        id: userId,
        nombre: data.nombre.trim(),
        correo: email,
        tipo_miembro: data.tipo_miembro,
        direccion: data.direccion ?? null,
        cp: data.cp ?? null,
        celular: data.celular ?? data.telefono ?? null,
        estado: data.estado ?? null,
        municipio: data.municipio ?? null,
        comunidad: data.comunidad ?? null,
        sexo: data.sexo ?? null,
        fecha_nacimiento: data.fecha_nacimiento || null,
        habilidad_empirica: data.habilidad_empirica ?? null,
        descripcion_profesion: data.descripcion_profesion ?? null,
        cedula: needsCedula ? data.cedula ?? null : null,
        verificado: Boolean(signUpData.user?.email_confirmed_at),
        es_pro: false,
        is_admin: false,
        bloqueado: false,
        fecha_registro: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      throw new Error(`No se pudo guardar el perfil: ${profileError.message}`)
    }

    const needsEmailConfirmation = !signUpData.session

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
      message:
        'Te enviamos un correo de confirmación. Abre el enlace para activar tu cuenta y luego inicia sesión.',
    }
  })

export const confirmEmailFromLinkFn = createServerFn({ method: 'GET' })
  .inputValidator((search: string) => search)
  .handler(async ({ data: search }) => {
    const supabase = createSupabaseServerClient()
    const params = new URLSearchParams(search)
    const code = params.get('code')

    if (!code) {
      throw new Error('Enlace de confirmación inválido o expirado.')
    }

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw new Error(error.message)

    if (sessionData.user?.id) {
      const admin = createSupabaseAdminClient()
      await admin
        .from('perfiles')
        .update({ verificado: true })
        .eq('id', sessionData.user.id)
    }

    return { success: true }
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
