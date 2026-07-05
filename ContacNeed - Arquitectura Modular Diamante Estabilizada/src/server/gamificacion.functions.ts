import { createServerFn } from '@tanstack/react-start'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import { requireActiveUser, requireAdminUser } from '../lib/auth'
import {
  PUNTOS_MENSUALIDAD_GRATIS,
  PUNTOS_POR_REFERIDO_REGISTRO,
  asegurarCodigoReferido,
  otorgarPuntos,
} from '../lib/gamificacion'
import { upsertContacNeedPro } from '../lib/ecosistema-entitlements'

export const getRankingPerfilesFn = createServerFn({ method: 'GET' }).handler(async () => {
    const supabase = createSupabaseAdminClient()
    const limit = 15
    const { data, error } = await supabase
      .from('ranking_perfiles_engagement')
      .select('*')
      .order('puntaje_engagement', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return { ranking: data ?? [] }
  })

export const calificarPerfilFn = createServerFn({ method: 'POST' })
  .inputValidator((d: {
    calificadoId: string
    estrellas: number
    conducta?: 'eficiente' | 'ineficiente' | 'neutral'
    comentario?: string
  }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireActiveUser()
    if (user.id === data.calificadoId) throw new Error('No puedes calificarte a ti mismo.')

    const estrellas = Math.max(1, Math.min(5, Math.round(data.estrellas)))
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase.from('calificaciones_perfil').upsert(
      {
        calificador_id: user.id,
        calificado_id: data.calificadoId,
        estrellas,
        conducta: data.conducta || 'neutral',
        comentario: data.comentario?.trim() || null,
      },
      { onConflict: 'calificador_id,calificado_id' },
    )
    if (error) throw new Error(error.message)

    const { data: agg } = await supabase
      .from('calificaciones_perfil')
      .select('estrellas')
      .eq('calificado_id', data.calificadoId)

    const rows = agg ?? []
    const promedio = rows.length
      ? rows.reduce((s, r) => s + Number(r.estrellas), 0) / rows.length
      : estrellas

    await supabase
      .from('perfiles')
      .update({
        calificacion_promedio: Math.round(promedio * 100) / 100,
        total_calificaciones: rows.length,
      })
      .eq('id', data.calificadoId)

    return { success: true, promedio, total: rows.length }
  })

export const getMiGamificacionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const codigo = await asegurarCodigoReferido(supabase, user.id)
  const siteUrl = process.env.URL ?? process.env.VITE_SITE_URL ?? 'https://contacneed.com'

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('puntos_ecosistema, calificacion_promedio, total_calificaciones')
    .eq('id', user.id)
    .maybeSingle()

  const puntos = Number(perfil?.puntos_ecosistema ?? 0)

  return {
    codigoReferido: codigo,
    enlaceRegistro: `${siteUrl}/registro?ref=${encodeURIComponent(codigo)}`,
    enlaceEcosistema: `https://centromultidisciplinarioags.com/mi-ecosistema?ref=${encodeURIComponent(codigo)}`,
    puntos,
    puntosParaMensualidad: PUNTOS_MENSUALIDAD_GRATIS,
    progresoMensualidad: Math.min(100, Math.round((puntos / PUNTOS_MENSUALIDAD_GRATIS) * 100)),
    calificacionPromedio: perfil?.calificacion_promedio ?? null,
    totalCalificaciones: perfil?.total_calificaciones ?? 0,
  }
})

export const canjearPuntosMensualidadFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user } = await requireActiveUser()
  const supabase = createSupabaseAdminClient()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('puntos_ecosistema')
    .eq('id', user.id)
    .maybeSingle()

  const puntos = Number(perfil?.puntos_ecosistema ?? 0)
  if (puntos < PUNTOS_MENSUALIDAD_GRATIS) {
    throw new Error(`Necesitas ${PUNTOS_MENSUALIDAD_GRATIS} puntos para canjear 1 mes PRO gratis.`)
  }

  await supabase
    .from('perfiles')
    .update({ puntos_ecosistema: puntos - PUNTOS_MENSUALIDAD_GRATIS })
    .eq('id', user.id)

  await supabase.from('puntos_historial').insert({
    usuario_id: user.id,
    puntos: -PUNTOS_MENSUALIDAD_GRATIS,
    motivo: 'canje_mensualidad_pro',
    metadata: { meses: 1 },
  })

  await upsertContacNeedPro(supabase, user.id, 'monthly')

  return { success: true, puntosRestantes: puntos - PUNTOS_MENSUALIDAD_GRATIS }
})

export async function registrarReferidoEnSignup(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  nuevoUserId: string,
  codigoReferido?: string | null,
) {
  const referidor = codigoReferido
    ? await admin
        .from('perfiles')
        .select('id')
        .eq('codigo_referido', String(codigoReferido).trim().toUpperCase())
        .maybeSingle()
    : { data: null }

  if (!referidor.data?.id || referidor.data.id === nuevoUserId) return null

  await admin.from('perfiles').update({ referido_por: referidor.data.id }).eq('id', nuevoUserId)
  await admin.from('eventos_referido').insert({
    referidor_id: referidor.data.id,
    referido_id: nuevoUserId,
    producto: 'contacneed',
    codigo_usado: String(codigoReferido).trim().toUpperCase(),
    puntos_otorgados: PUNTOS_POR_REFERIDO_REGISTRO,
  })

  await otorgarPuntos(
    admin,
    referidor.data.id,
    PUNTOS_POR_REFERIDO_REGISTRO,
    'referido_registro',
    { referido_id: nuevoUserId },
  )

  return referidor.data.id
}
