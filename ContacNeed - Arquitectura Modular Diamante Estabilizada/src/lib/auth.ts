import { createSupabaseAdminClient, createSupabaseServerClient } from './supabase.server'
import { getContacNeedProStatus } from './ecosistema-entitlements'

export type ServerProfile = {
  id: string
  nombre?: string | null
  correo?: string | null
  estado?: string | null
  municipio?: string | null
  habilidad_empirica?: string | null
  descripcion_profesion?: string | null
  es_pro?: boolean | null
  is_admin?: boolean | null
  verificado?: boolean | null
  es_fundador?: boolean | null
  avatar_url?: string | null
  bloqueado?: boolean | null
  pro_extra_ad_slots?: number | null
  pro_plan_type?: string | null
  ultimo_informe_pro?: string | null
}

export async function getServerUser() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function getServerProfile(userId: string): Promise<ServerProfile | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('perfiles')
    .select(
      'id, nombre, correo, estado, municipio, habilidad_empirica, descripcion_profesion, es_pro, is_admin, verificado, es_fundador, avatar_url, bloqueado, pro_extra_ad_slots, pro_plan_type, ultimo_informe_pro',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const pro = await getContacNeedProStatus(supabase, userId)
  const esPro = pro.active || Boolean(data.es_pro)

  return {
    ...data,
    es_pro: esPro,
    pro_plan_type: pro.plan ?? data.pro_plan_type ?? null,
  }
}

export const EMAIL_DOCENTE_ESCUELA = 'jfcovaoso@gmail.com'

function emailNorm(email?: string | null) {
  return String(email || '').trim().toLowerCase()
}

export function esCuentaDocenteEscuela(input: {
  email?: string | null
  is_admin?: boolean | null
  es_fundador?: boolean | null
}) {
  if (input.is_admin || input.es_fundador) return true
  return emailNorm(input.email) === EMAIL_DOCENTE_ESCUELA
}

export async function esDocenteEscuelaActual() {
  const user = await getServerUser()
  if (!user) return { user: null, profile: null as ServerProfile | null, esDocente: false }

  const porCorreo = emailNorm(user.email) === EMAIL_DOCENTE_ESCUELA
  try {
    const profile = await getServerProfile(user.id)
    if (profile?.bloqueado) return { user, profile, esDocente: false }
    return {
      user,
      profile,
      esDocente: esCuentaDocenteEscuela({
        email: user.email,
        is_admin: profile?.is_admin,
        es_fundador: profile?.es_fundador,
      }),
    }
  } catch {
    return { user, profile: null, esDocente: porCorreo }
  }
}

export async function requireAdminUser() {
  try {
    const ctx = await esDocenteEscuelaActual()
    if (!ctx.user || !ctx.esDocente) return null
    return { user: ctx.user, profile: ctx.profile }
  } catch {
    return null
  }
}

export async function requireActiveUser() {
  const user = await getServerUser()
  if (!user) throw new Error('Debes iniciar sesión')

  if (!user.email_confirmed_at) {
    throw new Error(
      'Confirma tu correo electrónico antes de continuar. Revisa tu bandeja de entrada y spam.',
    )
  }

  const profile = await getServerProfile(user.id)
  if (profile?.bloqueado) throw new Error('Tu cuenta está suspendida. Contacta soporte.')

  return { user, profile }
}

export async function requireProUser() {
  const session = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const pro = await getContacNeedProStatus(supabase, session.user.id)
  if (!pro.active && !session.profile?.es_pro) {
    throw new Error('Esta función requiere membresía ContacNeed PRO')
  }
  return session
}
