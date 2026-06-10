import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireAdminUser } from '../lib/auth'
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

export const getAdminDashboardFn = createServerFn({ method: 'GET' }).handler(async () => {
  await assertAdmin()
  const supabase = createSupabaseAdminClient()

  const [postsRes, usersRes, profilesRes] = await Promise.all([
    supabase
      .from('publicaciones')
      .select(
        'id, contenido, url_multimedia, estado, estatus, fecha_creacion, usuario_id, perfiles(nombre, habilidad_empirica, descripcion_profesion, verificado, es_fundador)',
      )
      .order('fecha_creacion', { ascending: false })
      .limit(100),
    supabase
      .from('perfiles')
      .select('id, nombre, estado, habilidad_empirica, es_pro, is_admin, fecha_registro')
      .order('fecha_registro', { ascending: false })
      .limit(100),
    supabase.from('perfiles').select('estado, habilidad_empirica'),
  ])

  if (postsRes.error) throw postsRes.error
  if (usersRes.error) throw usersRes.error
  if (profilesRes.error) throw profilesRes.error

  const posts = (postsRes.data ?? []).map((post) =>
    mapPublicacionToPost({
      ...post,
      fecha_creacion: post.fecha_creacion ? new Date(post.fecha_creacion) : null,
      perfiles: post.perfiles,
    }),
  )

  const users = usersRes.data ?? []
  const allProfiles = profilesRes.data ?? []

  return {
    posts,
    users,
    statsByState: countByField(allProfiles.map((p) => ({ value: p.estado }))),
    statsByProfession: countByField(allProfiles.map((p) => ({ value: p.habilidad_empirica }))),
    totals: {
      posts: posts.length,
      users: users.length,
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
  .inputValidator((d: { id: string; es_pro?: boolean; is_admin?: boolean }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('perfiles')
      .update({
        es_pro: data.es_pro,
        is_admin: data.is_admin,
      })
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

    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Eres el asistente de administración de ContacNeed (red de oficios en México). Responde en español, con datos concretos y acciones sugeridas para moderación, crecimiento por estado/oficio y membresías PRO.\n\nDatos actuales:\n${context}\n\nPregunta del admin: ${data.question}`,
                    },
                  ],
                },
              ],
            }),
          },
        )

        if (response.ok) {
          const payload = await response.json()
          const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) return { answer: String(text) }
        }
      } catch {
        // fallback below
      }
    }

    return {
      answer: `Resumen rápido:\n${context}\n\nPara moderar: usa Aprobar/Banear en la tabla. Tras aprobar, la publicación vuelve al feed con estatus "aprobado".`,
    }
  })
