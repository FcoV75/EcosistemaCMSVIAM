import { createServerFn } from '@tanstack/react-start'
import { requireActiveUser, requireProUser } from '../lib/auth'
import { createSupabaseAdminClient } from '../lib/supabase.server'

function admin() {
  return createSupabaseAdminClient()
}

async function assertMiembroActivo(grupoId: string, userId: string) {
  const { data } = await admin()
    .from('grupo_miembros')
    .select('id, rol, estatus')
    .eq('grupo_id', grupoId)
    .eq('usuario_id', userId)
    .maybeSingle()
  if (!data || data.estatus !== 'activo') {
    throw new Error('No perteneces a este grupo o la invitación sigue pendiente.')
  }
  return data
}

export const listMisGruposComunesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireProUser()
  const db = admin()
  const { data: membresias, error } = await db
    .from('grupo_miembros')
    .select('grupo_id, estatus, rol')
    .eq('usuario_id', user.id)
    .in('estatus', ['activo', 'invitado'])
  if (error) throw new Error(error.message)
  const ids = (membresias || []).map((m) => m.grupo_id)
  if (!ids.length) return { items: [] as any[] }

  const { data: grupos, error: gErr } = await db
    .from('grupos')
    .select('id, nombre, descripcion, owner_id, activo, created_at')
    .in('id', ids)
    .eq('tipo', 'comun')
    .eq('activo', true)
    .order('created_at', { ascending: false })
  if (gErr) throw new Error(gErr.message)

  const byId = new Map((membresias || []).map((m) => [m.grupo_id, m]))
  return {
    items: (grupos || []).map((g) => ({
      ...g,
      mi_rol: byId.get(g.id)?.rol || 'miembro',
      mi_estatus: byId.get(g.id)?.estatus || 'activo',
    })),
  }
})

export const createGrupoComunFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { nombre: string; descripcion?: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const nombre = String(data.nombre || '').trim()
    if (nombre.length < 2) throw new Error('Pon un nombre de grupo (mínimo 2 caracteres).')
    const db = admin()
    const { data: grupo, error } = await db
      .from('grupos')
      .insert({
        nombre,
        descripcion: String(data.descripcion || '').trim() || null,
        tipo: 'comun',
        owner_id: user.id,
      })
      .select('id, nombre')
      .single()
    if (error) throw new Error(error.message)
    await db.from('grupo_miembros').insert({
      grupo_id: grupo.id,
      usuario_id: user.id,
      rol: 'owner',
      estatus: 'activo',
      invited_by: user.id,
    })
    return { success: true, grupo }
  })

export const buscarMiembrosParaInvitarFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    await requireProUser()
    const q = String(data.q || '')
      .trim()
      .replace(/[%_,]/g, ' ')
      .replace(/\s+/g, ' ')
    if (q.length < 2) return { items: [] as any[] }
    const db = admin()
    const { data: rows, error } = await db
      .from('perfiles')
      .select('id, nombre, habilidad_empirica, estado, avatar_url, es_pro')
      .or(`nombre.ilike.%${q}%,habilidad_empirica.ilike.%${q}%,correo.ilike.%${q}%`)
      .eq('bloqueado', false)
      .limit(12)
    if (error) throw new Error(error.message)
    return { items: rows || [] }
  })

export const invitarAGrupoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { grupoId: string; usuarioId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const grupoId = String(data.grupoId || '')
    const usuarioId = String(data.usuarioId || '')
    const memb = await assertMiembroActivo(grupoId, user.id)
    if (memb.rol !== 'owner' && memb.rol !== 'admin') {
      throw new Error('Solo el dueño o un admin puede invitar.')
    }
    if (usuarioId === user.id) throw new Error('Ya estás en el grupo.')
    const db = admin()
    const { error } = await db.from('grupo_miembros').upsert(
      {
        grupo_id: grupoId,
        usuario_id: usuarioId,
        rol: 'miembro',
        estatus: 'invitado',
        invited_by: user.id,
      },
      { onConflict: 'grupo_id,usuario_id' },
    )
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const responderInvitacionGrupoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { grupoId: string; accept: boolean }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const db = admin()
    if (data.accept) {
      const { error } = await db
        .from('grupo_miembros')
        .update({ estatus: 'activo' })
        .eq('grupo_id', data.grupoId)
        .eq('usuario_id', user.id)
        .eq('estatus', 'invitado')
      if (error) throw new Error(error.message)
    } else {
      const { error } = await db
        .from('grupo_miembros')
        .update({ estatus: 'salido' })
        .eq('grupo_id', data.grupoId)
        .eq('usuario_id', user.id)
      if (error) throw new Error(error.message)
    }
    return { success: true }
  })

export const getGrupoDetalleFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { grupoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertMiembroActivo(data.grupoId, user.id)
    const db = admin()
    const { data: grupo, error } = await db
      .from('grupos')
      .select('id, nombre, descripcion, tipo, proyecto_id, owner_id, rol_etiqueta, mantenimiento, activo')
      .eq('id', data.grupoId)
      .maybeSingle()
    if (error || !grupo) throw new Error(error?.message || 'Grupo no encontrado')

    const { data: miembros } = await db
      .from('grupo_miembros')
      .select('usuario_id, rol, estatus, perfiles:usuario_id(id, nombre, avatar_url, habilidad_empirica)')
      .eq('grupo_id', data.grupoId)
      .in('estatus', ['activo', 'invitado'])

    return { grupo, miembros: miembros || [] }
  })

export const getGrupoMensajesFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { grupoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertMiembroActivo(data.grupoId, user.id)
    const { data: rows, error } = await admin()
      .from('grupo_mensajes')
      .select('id, cuerpo, created_at, autor_id, perfiles:autor_id(id, nombre, avatar_url)')
      .eq('grupo_id', data.grupoId)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) throw new Error(error.message)
    return { items: rows || [] }
  })

export const enviarMensajeGrupoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { grupoId: string; cuerpo: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertMiembroActivo(data.grupoId, user.id)
    const cuerpo = String(data.cuerpo || '').trim()
    if (!cuerpo) throw new Error('Escribe un mensaje.')
    const { error } = await admin().from('grupo_mensajes').insert({
      grupo_id: data.grupoId,
      autor_id: user.id,
      cuerpo,
    })
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const listMisProyectosFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireProUser()
  const db = admin()
  const { data: propios, error } = await db
    .from('proyectos')
    .select('id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const { data: memb } = await db
    .from('grupo_miembros')
    .select('grupo_id')
    .eq('usuario_id', user.id)
    .eq('estatus', 'activo')
  const gIds = (memb || []).map((m) => m.grupo_id)
  let colaborando: any[] = []
  if (gIds.length) {
    const { data: gProy } = await db
      .from('grupos')
      .select('proyecto_id')
      .in('id', gIds)
      .eq('tipo', 'proyecto')
      .not('proyecto_id', 'is', null)
    const pIds = [...new Set((gProy || []).map((g) => g.proyecto_id).filter(Boolean))]
    const ownIds = new Set((propios || []).map((p) => p.id))
    const extra = pIds.filter((id) => !ownIds.has(id as string))
    if (extra.length) {
      const { data } = await db
        .from('proyectos')
        .select('id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id')
        .in('id', extra)
      colaborando = data || []
    }
  }

  return { propios: propios || [], colaborando }
})

export const createProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { nombre: string; descripcion?: string; tipo_obra?: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const nombre = String(data.nombre || '').trim()
    if (nombre.length < 3) throw new Error('Nombre del proyecto: mínimo 3 caracteres.')
    const { data: proyecto, error } = await admin()
      .from('proyectos')
      .insert({
        owner_id: user.id,
        nombre,
        descripcion: String(data.descripcion || '').trim() || null,
        tipo_obra: String(data.tipo_obra || 'otro').trim() || 'otro',
      })
      .select('id, nombre')
      .single()
    if (error) throw new Error(error.message)
    return { success: true, proyecto }
  })

export const getProyectoDetalleFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { proyectoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const db = admin()
    const { data: proyecto, error } = await db
      .from('proyectos')
      .select('id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id')
      .eq('id', data.proyectoId)
      .maybeSingle()
    if (error || !proyecto) throw new Error(error?.message || 'Proyecto no encontrado')

    const { data: grupos } = await db
      .from('grupos')
      .select('id, nombre, descripcion, rol_etiqueta, activo, mantenimiento, owner_id, created_at')
      .eq('proyecto_id', data.proyectoId)
      .eq('activo', true)
      .order('created_at', { ascending: true })

    const esOwner = proyecto.owner_id === user.id
    if (!esOwner) {
      const gIds = (grupos || []).map((g) => g.id)
      if (!gIds.length) throw new Error('No tienes acceso a este proyecto.')
      const { data: memb } = await db
        .from('grupo_miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('estatus', 'activo')
        .in('grupo_id', gIds)
        .limit(1)
      if (!memb?.length) throw new Error('No tienes acceso a este proyecto.')
    }

    return { proyecto, grupos: grupos || [], esOwner }
  })

export const createGrupoProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { proyectoId: string; nombre: string; rol_etiqueta?: string; descripcion?: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const db = admin()
    const { data: proyecto } = await db
      .from('proyectos')
      .select('id, owner_id, estatus')
      .eq('id', data.proyectoId)
      .maybeSingle()
    if (!proyecto || proyecto.owner_id !== user.id) {
      throw new Error('Solo quien inició el proyecto puede crear grupos estratégicos.')
    }
    if (proyecto.estatus === 'concluido') {
      throw new Error('El proyecto ya está concluido.')
    }
    const nombre = String(data.nombre || '').trim()
    if (nombre.length < 2) throw new Error('Nombre del grupo requerido.')
    const { data: grupo, error } = await db
      .from('grupos')
      .insert({
        nombre,
        descripcion: String(data.descripcion || '').trim() || null,
        tipo: 'proyecto',
        proyecto_id: data.proyectoId,
        owner_id: user.id,
        rol_etiqueta: String(data.rol_etiqueta || '').trim() || null,
      })
      .select('id, nombre')
      .single()
    if (error) throw new Error(error.message)
    await db.from('grupo_miembros').insert({
      grupo_id: grupo.id,
      usuario_id: user.id,
      rol: 'owner',
      estatus: 'activo',
      invited_by: user.id,
    })
    return { success: true, grupo }
  })

export const concluirProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { proyectoId: string; gruposMantenimientoIds: string[] }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const db = admin()
    const { data: proyecto } = await db
      .from('proyectos')
      .select('id, owner_id, estatus')
      .eq('id', data.proyectoId)
      .maybeSingle()
    if (!proyecto || proyecto.owner_id !== user.id) {
      throw new Error('Solo quien inició el proyecto puede concluirlo.')
    }
    const keep = new Set((data.gruposMantenimientoIds || []).map(String))
    const { data: grupos } = await db
      .from('grupos')
      .select('id')
      .eq('proyecto_id', data.proyectoId)
    for (const g of grupos || []) {
      const esMant = keep.has(g.id)
      await db
        .from('grupos')
        .update({ mantenimiento: esMant, activo: esMant })
        .eq('id', g.id)
    }
    const { error } = await db
      .from('proyectos')
      .update({ estatus: 'concluido', concluido_at: new Date().toISOString() })
      .eq('id', data.proyectoId)
    if (error) throw new Error(error.message)
    return { success: true }
  })

/** Para páginas que muestran candado PRO sin lanzar error. */
export const checkProAccessFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { user, profile } = await requireActiveUser()
    try {
      await requireProUser()
      return { loggedIn: true, isPro: true, userId: user.id }
    } catch {
      return { loggedIn: true, isPro: Boolean(profile?.es_pro), userId: user.id }
    }
  } catch {
    return { loggedIn: false, isPro: false, userId: null }
  }
})
