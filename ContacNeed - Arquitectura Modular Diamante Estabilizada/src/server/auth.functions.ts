import { createServerFn } from '@tanstack/react-start'

import { createSupabaseAdminClient, createSupabaseServerClient } from '../lib/supabase.server'

import { getServerUser, getServerProfile, requireAdminUser } from '../lib/auth'



export const getServerUserFn = createServerFn({ method: 'GET' }).handler(async () => {

  const user = await getServerUser()

  if (!user) return null

  return { id: user.id, email: user.email ?? undefined }

})



export const getSessionContextFn = createServerFn({ method: 'GET' }).handler(async () => {

  const user = await getServerUser()

  if (!user) return { user: null, isAdmin: false }



  const profile = await getServerProfile(user.id)

  return {

    user: { id: user.id, email: user.email ?? undefined },

    isAdmin: Boolean(profile?.is_admin),

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

  .handler(async ({ data: userId }) => {

    return getServerProfile(userId)

  })



type SignInInput = { email: string; password: string }



export const signInFn = createServerFn({ method: 'POST' })

  .inputValidator((d: SignInInput) => d)

  .handler(async ({ data }) => {

    const supabase = createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({

      email: data.email.trim(),

      password: data.password,

    })

    if (error) throw new Error(error.message)

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



    const { data: authData, error: authError } = await supabase.auth.signUp({

      email: data.email.trim(),

      password: data.password,

    })



    if (authError) throw new Error(authError.message)

    if (!authData.user) throw new Error('No se pudo crear la cuenta')



    const needsCedula = data.tipo_miembro === 'Profesion' || data.tipo_miembro === 'Especialidad'



    const { error: profileError } = await admin.from('perfiles').upsert({

      id: authData.user.id,

      nombre: data.nombre.trim(),

      correo: data.email.trim(),

      tipo_miembro: data.tipo_miembro,

      direccion: data.direccion ?? null,

      cp: data.cp ?? null,

      celular: data.celular ?? data.telefono ?? null,

      estado: data.estado ?? null,

      municipio: data.municipio ?? null,

      comunidad: data.comunidad ?? null,

      sexo: data.sexo ?? null,

      fecha_nacimiento: data.fecha_nacimiento ?? null,

      habilidad_empirica: data.habilidad_empirica ?? null,

      descripcion_profesion: data.descripcion_profesion ?? null,

      cedula: needsCedula ? data.cedula ?? null : null,

      verificado: false,

      es_pro: false,

      is_admin: false,

    })



    if (profileError) throw new Error(profileError.message)

    return { success: true }

  })



export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {

  const supabase = createSupabaseServerClient()

  await supabase.auth.signOut()

  return { success: true }

})


