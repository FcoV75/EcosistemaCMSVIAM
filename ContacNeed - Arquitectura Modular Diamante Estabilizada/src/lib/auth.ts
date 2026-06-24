import { createSupabaseAdminClient, createSupabaseServerClient } from './supabase.server'

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
      'id, nombre, correo, estado, municipio, habilidad_empirica, descripcion_profesion, es_pro, is_admin, verificado, es_fundador, avatar_url, bloqueado',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function requireAdminUser() {
  const user = await getServerUser()
  if (!user) return null

  const profile = await getServerProfile(user.id)
  if (!profile?.is_admin || profile.bloqueado) return null

  return { user, profile }
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
  if (!session.profile?.es_pro) {
    throw new Error('Esta función requiere membresía ContacNeed PRO')
  }
  return session
}
