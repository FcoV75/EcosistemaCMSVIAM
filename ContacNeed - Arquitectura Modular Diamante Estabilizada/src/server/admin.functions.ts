import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireAdminUser } from '../lib/auth'
import { askLlm } from '../lib/llm'
import { mapPublicacionToPost } from '../lib/posts-mapper'

async function assertAdmin() {
  const admin = await requireAdminUser()
  if (!admin) throw new Error('Acceso denegado: se requiere rol de administrador')
  return admin
}

function countByField(rows: { value: string | null }[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = row.value?.trim() || 'Sin dato'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

const PROFILE_STATS_SELECT =
  'id, nombre, correo, estado, habilidad_empirica, tipo_miembro, es_pro, is_admin, bloqueado, verificado, fecha_registro'

const POST_SELECT =
  'id, contenido, url_multimedia, estado, estatus, fecha_creacion, usuario_id'

async function attachProfilesToPosts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  posts: {
    id: string
    contenido?: string | null
    url_multimedia?: string | null
    estado?: string | null
    estatus?: string | null
    fecha_creacion?: string | null
    usuario_id?: string | null
  }[],
) {
  const userIds = [...new Set(posts.map((post) => post.usuario_id).filter(Boolean))] as string[]
  if (userIds.length === 0) {
    return posts.map((post) => ({ ...post, perfiles: null }))
  }

  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('id, nombre, habilidad_empirica, descripcion_profesion, verificado')
    .in('id', userIds)

  if (error) {
    return posts.map((post) => ({ ...post, perfiles: null }))
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  return posts.map((post) => ({
    ...post,
    perfiles: post.usuario_id ? profileById.get(post.usuario_id) ?? null : null,
  }))
}

async function fetchRecentUsers(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const ordered = await supabase
    .from('perfiles')
    .select(PROFILE_STATS_SELECT)
    .order('id', { ascending: false })
    .limit(200)

  if (!ordered.error) return ordered

  const fallback = await supabase
    .from('perfiles')
    .select('id, nombre, correo, estado, habilidad_empirica, es_pro, is_admin, bloqueado, verificado')
    .order('id', { ascending: false })
    .limit(200)

  return fallback
}

async function fetchAllProfilesForStats(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const full = await supabase.from('perfiles').select('estado, habilidad_empirica, tipo_miembro, verificado, es_pro')
  if (!full.error) return full

  return supabase.from('perfiles').select('estado, habilidad_empirica, es_pro')
}

export const getAdminDashboardFn = createServerFn({ method: 'GET' }).handler(async () => {
  await assertAdmin()
  const supabase = createSupabaseAdminClient()
  const warnings: string[] = []

  const [
    postsRes,
    usersRes,
    profilesRes,
    postsCountRes,
    usersCountRes,
    proCountRes,
    verifiedCountRes,
    pendingPostsRes,
    pendingProRes,
  ] = await Promise.all([
    supabase.from('publicaciones').select(POST_SELECT).order('fecha_creacion', { ascending: false }).limit(100),
    fetchRecentUsers(supabase),
    fetchAllProfilesForStats(supabase),
    supabase.from('publicaciones').select('*', { count: 'exact', head: true }),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('es_pro', true),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('verificado', true),
    supabase
      .from('publicaciones')
      .select(POST_SELECT)
      .eq('estatus', 'pendiente')
      .order('fecha_creacion', { ascending: false })
      .limit(50),
    supabase
      .from('solicitudes_pro')
      .select('id, usuario_id, metodo, monto, estatus, notas, created_at, perfiles(nombre, correo, estado)')
      .eq('estatus', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (postsRes.error) warnings.push(`Publicaciones: ${postsRes.error.message}`)
  if (usersRes.error) warnings.push(`Usuarios: ${usersRes.error.message}`)
  if (profilesRes.error) warnings.push(`Estadísticas: ${profilesRes.error.message}`)
  if (usersCountRes.error) warnings.push(`Conteo usuarios: ${usersCountRes.error.message}`)
  if (postsCountRes.error) warnings.push(`Conteo publicaciones: ${postsCountRes.error.message}`)

  const rawPosts = postsRes.error ? [] : postsRes.data ?? []
  const rawPendingPosts =
    pendingPostsRes.error && pendingPostsRes.error.message.includes('does not exist')
      ? []
      : pendingPostsRes.error
        ? []
        : pendingPostsRes.data ?? []

  const [postsWithProfiles, pendingWithProfiles] = await Promise.all([
    attachProfilesToPosts(supabase, rawPosts),
    attachProfilesToPosts(supabase, rawPendingPosts),
  ])

  const mapPost = (post: {
    id: string
    contenido?: string | null
    url_multimedia?: string | null
    estado?: string | null
    estatus?: string | null
    fecha_creacion?: string | null
    usuario_id?: string | null
    perfiles?: unknown
  }) =>
    mapPublicacionToPost({
      ...post,
      fecha_creacion: post.fecha_creacion ? new Date(post.fecha_creacion) : null,
      perfiles: post.perfiles as Parameters<typeof mapPublicacionToPost>[0]['perfiles'],
    })

  const posts = postsWithProfiles.map(mapPost)
  const pendingPosts = pendingWithProfiles.map(mapPost)
  const pendingProRequests =
    pendingProRes.error && pendingProRes.error.message.includes('does not exist')
      ? []
      : (pendingProRes.data ?? [])

  const users = usersRes.error ? [] : (usersRes.data ?? [])
  const allProfiles = profilesRes.error ? users : (profilesRes.data ?? [])

  const proFromProfiles = allProfiles.filter((p) => Boolean(p.es_pro)).length
  const verifiedFromProfiles = allProfiles.filter((p) => Boolean(p.verificado)).length

  return {
    posts,
    pendingPosts,
    pendingProRequests,
    users,
    warnings,
    statsByState: countByField(allProfiles.map((p) => ({ value: p.estado ?? null }))),
    statsByProfession: countByField(allProfiles.map((p) => ({ value: p.habilidad_empirica ?? null }))),
    statsByMemberType: countByField(
      allProfiles.map((p) => ({ value: 'tipo_miembro' in p ? (p.tipo_miembro as string | null) : null })),
    ),
    totals: {
      posts: postsCountRes.count ?? posts.length,
      users: usersCountRes.count ?? users.length,
      proUsers: proCountRes.count ?? proFromProfiles,
      verifiedUsers: verifiedCountRes.count ?? verifiedFromProfiles,
      pendingPosts: pendingPosts.length,
      pendingPro: pendingProRequests.length,
    },
  }
})

export const moderatePostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; estatus: 'aprobado' | 'baneado' | 'pendiente' }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('publicaciones')
      .update({ estatus: data.estatus })
      .eq('id', data.id)

    if (error) throw error
    return { success: true, id: data.id, estatus: data.estatus }
  })

export const deletePostAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('publicaciones').delete().eq('id', data.id)
    if (error) throw error
    return { success: true }
  })

export const updateUserAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; es_pro?: boolean; is_admin?: boolean; bloqueado?: boolean }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const patch: Record<string, boolean> = {}
    if (typeof data.es_pro === 'boolean') patch.es_pro = data.es_pro
    if (typeof data.is_admin === 'boolean') patch.is_admin = data.is_admin
    if (typeof data.bloqueado === 'boolean') patch.bloqueado = data.bloqueado

    const { error } = await supabase.from('perfiles').update(patch).eq('id', data.id)

    if (error) throw error
    return { success: true }
  })

export const blockUserAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; bloqueado: boolean }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('perfiles')
      .update({ bloqueado: data.bloqueado })
      .eq('id', data.id)

    if (error) throw error
    return { success: true }
  })

export const approveProRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { data: request, error: fetchError } = await supabase
      .from('solicitudes_pro')
      .select('id, usuario_id, estatus')
      .eq('id', data.id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!request) throw new Error('Solicitud no encontrada')

    const { error: proError } = await supabase
      .from('perfiles')
      .update({ es_pro: true })
      .eq('id', request.usuario_id)

    if (proError) throw proError

    const { error: updateError } = await supabase
      .from('solicitudes_pro')
      .update({ estatus: 'aprobado' })
      .eq('id', data.id)

    if (updateError) throw updateError
    return { success: true }
  })

export const rejectProRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('solicitudes_pro')
      .update({ estatus: 'rechazado' })
      .eq('id', data.id)

    if (error) throw error
    return { success: true }
  })

export const banUserAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('publicaciones')
      .update({ estatus: 'baneado' })
      .eq('usuario_id', data.id)

    if (error) throw error
    return { success: true }
  })

export const askAdminBotFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { question: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const [{ count: userCount }, { count: postCount }, { count: proCount }, { data: topStates }] =
      await Promise.all([
        supabase.from('perfiles').select('*', { count: 'exact', head: true }),
        supabase.from('publicaciones').select('*', { count: 'exact', head: true }),
        supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('es_pro', true),
        supabase.from('perfiles').select('estado').limit(500),
      ])

    const stateCounts = countByField((topStates ?? []).map((p) => ({ value: p.estado }))).slice(0, 5)
    const context = [
      `Usuarios: ${userCount ?? 0}`,
      `Publicaciones: ${postCount ?? 0}`,
      `PRO activos: ${proCount ?? 0}`,
      `Top estados: ${stateCounts.map((s) => `${s.label} (${s.count})`).join(', ') || 'sin datos'}`,
    ].join('\n')

    const answer = await askLlm({
      system:
        'Eres el asistente de administración de ContacNeed (red de oficios en México). Responde en español, con datos concretos y acciones sugeridas para moderación, crecimiento por estado/oficio y membresías PRO.',
      user: `Datos actuales:\n${context}\n\nPregunta del admin: ${data.question}`,
      maxSentences: 8,
    })

    if (answer) return { answer }

    return {
      answer: `Resumen rápido:\n${context}\n\nPara moderar: usa Aprobar/Banear en la tabla. Tras aprobar, la publicación vuelve al feed con estatus "aprobado".`,
    }
  })
