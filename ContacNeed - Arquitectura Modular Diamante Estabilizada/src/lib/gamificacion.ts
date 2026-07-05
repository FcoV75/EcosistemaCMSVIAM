/** Umbrales de recompensa ecosistema (ContacNeed / Nexus / Video Diamante) */
export const PUNTOS_POR_REFERIDO_REGISTRO = 15
export const PUNTOS_POR_REFERIDO_PRO = 40
export const PUNTOS_POR_LIBRO_REFERIDO = 25
export const PUNTOS_MENSUALIDAD_GRATIS = 100

export function generarCodigoReferido(userId: string) {
  const base = userId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `CN-${base}`
}

export async function asegurarCodigoReferido(
  supabase: { from: (t: string) => any },
  userId: string,
) {
  const { data } = await supabase
    .from('perfiles')
    .select('codigo_referido')
    .eq('id', userId)
    .maybeSingle()

  if (data?.codigo_referido) return data.codigo_referido as string

  const codigo = generarCodigoReferido(userId)
  await supabase.from('perfiles').update({ codigo_referido: codigo }).eq('id', userId)
  return codigo
}

export async function otorgarPuntos(
  supabase: { from: (t: string) => any },
  userId: string,
  puntos: number,
  motivo: string,
  metadata: Record<string, unknown> = {},
) {
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('puntos_ecosistema')
    .eq('id', userId)
    .maybeSingle()

  const actual = Number(perfil?.puntos_ecosistema ?? 0)
  const nuevo = actual + puntos

  await supabase.from('puntos_historial').insert({
    usuario_id: userId,
    puntos,
    motivo,
    metadata,
  })

  await supabase.from('perfiles').update({ puntos_ecosistema: nuevo }).eq('id', userId)

  return { anterior: actual, nuevo, alcanzaMensualidadGratis: nuevo >= PUNTOS_MENSUALIDAD_GRATIS }
}

export async function resolverReferidorPorCodigo(
  supabase: { from: (t: string) => any },
  codigo: string | null | undefined,
) {
  const normalized = String(codigo || '').trim().toUpperCase()
  if (!normalized || normalized.length < 4) return null

  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre, codigo_referido')
    .eq('codigo_referido', normalized)
    .maybeSingle()

  return data?.id ? data : null
}
