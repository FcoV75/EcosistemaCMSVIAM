import { createServerFn } from '@tanstack/react-start'
import { requireActiveUser, requireProUser } from '../lib/auth'
import { createSupabaseAdminClient } from '../lib/supabase.server'

function admin() {
  return createSupabaseAdminClient()
}

function isMissingSchemaError(message?: string | null) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('column') && m.includes('not exist'))
  )
}

async function notify(
  usuarioId: string,
  payload: { tipo: string; titulo: string; cuerpo: string; enlace?: string; metadata?: Record<string, unknown> },
) {
  const { error } = await admin().from('notificaciones').insert({
    usuario_id: usuarioId,
    tipo: payload.tipo,
    titulo: payload.titulo,
    cuerpo: payload.cuerpo,
    enlace: payload.enlace || null,
    metadata: payload.metadata || {},
  })
  if (error) console.warn('notify:', error.message)
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

async function assertGrupoOwner(grupoId: string, userId: string) {
  const db = admin()
  const full = await db
    .from('grupos')
    .select(
      'id, owner_id, nombre, tipo, proyecto_id, activo, descripcion, rol_etiqueta, presupuesto_asignado',
    )
    .eq('id', grupoId)
    .maybeSingle()
  let grupo = full.data
  if (full.error && isMissingSchemaError(full.error.message)) {
    const legacy = await db
      .from('grupos')
      .select('id, owner_id, nombre, tipo, proyecto_id, activo, descripcion, rol_etiqueta')
      .eq('id', grupoId)
      .maybeSingle()
    if (legacy.error) throw new Error(legacy.error.message)
    grupo = legacy.data ? { ...legacy.data, presupuesto_asignado: 0 } : null
  } else if (full.error) {
    throw new Error(full.error.message)
  }
  if (!grupo) throw new Error('Grupo no encontrado')
  if (grupo.owner_id !== userId) throw new Error('Solo el dueño del grupo puede hacer esto.')
  return grupo
}

async function assertProyectoOwner(proyectoId: string, userId: string) {
  const { data } = await admin()
    .from('proyectos')
    .select('id, owner_id, estatus, nombre')
    .eq('id', proyectoId)
    .maybeSingle()
  if (!data) throw new Error('Proyecto no encontrado')
  if (data.owner_id !== userId) throw new Error('Solo el dueño del proyecto puede hacer esto.')
  return data
}

async function loadProyectoRow(proyectoId: string) {
  const db = admin()
  const full = await db
    .from('proyectos')
    .select(
      'id, owner_id, estatus, nombre, descripcion, tipo_obra, fecha_inicio, fecha_probable_termino, created_at, concluido_at',
    )
    .eq('id', proyectoId)
    .maybeSingle()
  if (!full.error) return full.data
  if (!isMissingSchemaError(full.error.message)) throw new Error(full.error.message)

  const legacy = await db
    .from('proyectos')
    .select('id, owner_id, estatus, nombre, descripcion, tipo_obra, created_at, concluido_at')
    .eq('id', proyectoId)
    .maybeSingle()
  if (legacy.error) throw new Error(legacy.error.message)
  return legacy.data
    ? {
        ...legacy.data,
        fecha_inicio: null as string | null,
        fecha_probable_termino: null as string | null,
      }
    : null
}

async function assertProyectoAcceso(proyectoId: string, userId: string) {
  const db = admin()
  const proyecto = await loadProyectoRow(proyectoId)
  if (!proyecto) throw new Error('Proyecto no encontrado')
  if (proyecto.owner_id === userId) return { proyecto, esOwner: true }

  const { data: grupos } = await db.from('grupos').select('id').eq('proyecto_id', proyectoId)
  const gIds = (grupos || []).map((g) => g.id)
  if (!gIds.length) throw new Error('No tienes acceso a este proyecto.')
  const { data: memb } = await db
    .from('grupo_miembros')
    .select('id')
    .eq('usuario_id', userId)
    .eq('estatus', 'activo')
    .in('grupo_id', gIds)
    .limit(1)
  if (!memb?.length) throw new Error('No tienes acceso a este proyecto.')
  return { proyecto, esOwner: false }
}

async function loadGrupoMiembros(grupoId: string) {
  const db = admin()
  // Sin embed: evita PGRST201 por FKs dobles (usuario_id + invited_by → perfiles).
  const { data: miembros, error } = await db
    .from('grupo_miembros')
    .select('usuario_id, rol, estatus')
    .eq('grupo_id', grupoId)
    .in('estatus', ['activo', 'invitado'])
  if (error) throw new Error(error.message)
  const rows = miembros || []
  const ids = [...new Set(rows.map((m) => m.usuario_id).filter(Boolean))]
  let perfilesById = new Map<string, any>()
  if (ids.length) {
    const { data: perfiles } = await db
      .from('perfiles')
      .select('id, nombre, avatar_url, habilidad_empirica')
      .in('id', ids)
    perfilesById = new Map((perfiles || []).map((p) => [p.id, p]))
  }
  return rows.map((m) => ({
    ...m,
    perfiles: perfilesById.get(m.usuario_id) || null,
  }))
}

async function inviteUsersToGrupo(
  grupoId: string,
  inviterId: string,
  inviterName: string,
  grupoNombre: string,
  usuarioIds: string[],
) {
  const db = admin()
  const unique = [...new Set(usuarioIds.map(String).filter((id) => id && id !== inviterId))]
  for (const usuarioId of unique) {
    const { error } = await db.from('grupo_miembros').upsert(
      {
        grupo_id: grupoId,
        usuario_id: usuarioId,
        rol: 'miembro',
        estatus: 'invitado',
        invited_by: inviterId,
      },
      { onConflict: 'grupo_id,usuario_id' },
    )
    if (error) {
      console.warn('invite upsert:', error.message)
      continue
    }
    await notify(usuarioId, {
      tipo: 'grupo_invitacion',
      titulo: `Invitación al grupo «${grupoNombre}»`,
      cuerpo: `${inviterName} te invita a unirte. Acepta o rechaza desde Avisos o Grupos.`,
      enlace: '/grupos',
      metadata: { grupoId, action: 'invitar' },
    })
  }
  return unique.length
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
  .inputValidator((d: { nombre: string; descripcion?: string; miembroIds?: string[] }) => d)
  .handler(async ({ data }) => {
    const { user, profile } = await requireProUser()
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
    const invitados = await inviteUsersToGrupo(
      grupo.id,
      user.id,
      String(profile?.nombre || 'Un miembro'),
      grupo.nombre,
      data.miembroIds || [],
    )
    return { success: true, grupo, invitados }
  })

export const updateGrupoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      grupoId: string
      nombre?: string
      descripcion?: string
      rol_etiqueta?: string
      presupuesto_asignado?: number
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const grupo = await assertGrupoOwner(data.grupoId, user.id)
    if (!grupo.activo) throw new Error('Este grupo ya no está activo.')

    const patch: Record<string, unknown> = {}
    if (data.nombre !== undefined) {
      const nombre = String(data.nombre || '').trim()
      if (nombre.length < 2) throw new Error('Nombre: mínimo 2 caracteres.')
      patch.nombre = nombre
    }
    if (data.descripcion !== undefined) {
      patch.descripcion = String(data.descripcion || '').trim() || null
    }
    if (data.rol_etiqueta !== undefined && grupo.tipo === 'proyecto') {
      patch.rol_etiqueta = String(data.rol_etiqueta || '').trim() || null
    }
    if (data.presupuesto_asignado !== undefined && grupo.tipo === 'proyecto') {
      patch.presupuesto_asignado = Math.max(0, Number(data.presupuesto_asignado || 0))
    }
    if (!Object.keys(patch).length) return { success: true }

    const { error } = await admin().from('grupos').update(patch).eq('id', data.grupoId)
    if (error) {
      if (isMissingSchemaError(error.message) && 'presupuesto_asignado' in patch) {
        delete patch.presupuesto_asignado
        if (!Object.keys(patch).length) return { success: true }
        const retry = await admin().from('grupos').update(patch).eq('id', data.grupoId)
        if (retry.error) throw new Error(retry.error.message)
        return { success: true }
      }
      throw new Error(error.message)
    }
    return { success: true }
  })

export const deleteGrupoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { grupoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const grupo = await assertGrupoOwner(data.grupoId, user.id)
    if (grupo.tipo === 'proyecto' && grupo.proyecto_id) {
      await assertProyectoOwner(grupo.proyecto_id, user.id)
    }
    // Soft-delete: conserva historial de mensajes; deja de listarse.
    const { error } = await admin().from('grupos').update({ activo: false }).eq('id', data.grupoId)
    if (error) throw new Error(error.message)
    return { success: true }
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
    const { user, profile } = await requireProUser()
    const memb = await assertMiembroActivo(data.grupoId, user.id)
    if (memb.rol !== 'owner' && memb.rol !== 'admin') {
      throw new Error('Solo el dueño o un admin puede invitar.')
    }
    const { data: grupo } = await admin()
      .from('grupos')
      .select('id, nombre')
      .eq('id', data.grupoId)
      .maybeSingle()
    if (!grupo) throw new Error('Grupo no encontrado')
    await inviteUsersToGrupo(
      data.grupoId,
      user.id,
      String(profile?.nombre || 'Un miembro'),
      grupo.nombre,
      [data.usuarioId],
    )
    return { success: true }
  })

export const responderInvitacionGrupoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { grupoId: string; accept: boolean; notificacionId?: string }) => d)
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
    if (data.notificacionId) {
      await db
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', data.notificacionId)
        .eq('usuario_id', user.id)
    }
    return { success: true }
  })

export const getGrupoDetalleFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { grupoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const memb = await assertMiembroActivo(data.grupoId, user.id)
    const db = admin()

    let grupo: any = null
    const withBudget = await db
      .from('grupos')
      .select(
        'id, nombre, descripcion, tipo, proyecto_id, owner_id, rol_etiqueta, mantenimiento, activo, presupuesto_asignado',
      )
      .eq('id', data.grupoId)
      .maybeSingle()
    if (withBudget.error && isMissingSchemaError(withBudget.error.message)) {
      const legacy = await db
        .from('grupos')
        .select(
          'id, nombre, descripcion, tipo, proyecto_id, owner_id, rol_etiqueta, mantenimiento, activo',
        )
        .eq('id', data.grupoId)
        .maybeSingle()
      if (legacy.error || !legacy.data) throw new Error(legacy.error?.message || 'Grupo no encontrado')
      grupo = { ...legacy.data, presupuesto_asignado: 0 }
    } else if (withBudget.error || !withBudget.data) {
      throw new Error(withBudget.error?.message || 'Grupo no encontrado')
    } else {
      grupo = withBudget.data
    }

    const miembros = await loadGrupoMiembros(data.grupoId)
    return {
      grupo,
      miembros,
      mi_rol: memb.rol,
      esOwner: memb.rol === 'owner' || grupo.owner_id === user.id,
    }
  })

export const getGrupoMensajesFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { grupoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertMiembroActivo(data.grupoId, user.id)
    const db = admin()
    const { data: rows, error } = await db
      .from('grupo_mensajes')
      .select('id, cuerpo, created_at, autor_id')
      .eq('grupo_id', data.grupoId)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) throw new Error(error.message)
    const items = rows || []
    const autorIds = [...new Set(items.map((r) => r.autor_id).filter(Boolean))]
    let perfilesById = new Map<string, any>()
    if (autorIds.length) {
      const { data: perfiles } = await db
        .from('perfiles')
        .select('id, nombre, avatar_url')
        .in('id', autorIds)
      perfilesById = new Map((perfiles || []).map((p) => [p.id, p]))
    }
    return {
      items: items.map((r) => ({
        ...r,
        perfiles: perfilesById.get(r.autor_id) || null,
      })),
    }
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

  async function loadPropios() {
    const full = await db
      .from('proyectos')
      .select(
        'id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id, fecha_inicio, fecha_probable_termino',
      )
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (!full.error) return full.data || []
    if (!isMissingSchemaError(full.error.message)) throw new Error(full.error.message)
    const legacy = await db
      .from('proyectos')
      .select('id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (legacy.error) throw new Error(legacy.error.message)
    return (legacy.data || []).map((p) => ({
      ...p,
      fecha_inicio: null as string | null,
      fecha_probable_termino: null as string | null,
    }))
  }

  const propios = await loadPropios()

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
      const full = await db
        .from('proyectos')
        .select(
          'id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id, fecha_inicio, fecha_probable_termino',
        )
        .in('id', extra)
      if (full.error && isMissingSchemaError(full.error.message)) {
        const legacy = await db
          .from('proyectos')
          .select('id, nombre, descripcion, tipo_obra, estatus, created_at, concluido_at, owner_id')
          .in('id', extra)
        colaborando = (legacy.data || []).map((p) => ({
          ...p,
          fecha_inicio: null,
          fecha_probable_termino: null,
        }))
      } else {
        colaborando = full.data || []
      }
    }
  }

  return { propios: propios || [], colaborando }
})

export const createProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      nombre: string
      descripcion?: string
      tipo_obra?: string
      fecha_inicio?: string
      fecha_probable_termino?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const nombre = String(data.nombre || '').trim()
    if (nombre.length < 3) throw new Error('Nombre del proyecto: mínimo 3 caracteres.')
    const base = {
      owner_id: user.id,
      nombre,
      descripcion: String(data.descripcion || '').trim() || null,
      tipo_obra: String(data.tipo_obra || 'otro').trim() || 'otro',
    }
    const withDates = {
      ...base,
      fecha_inicio: data.fecha_inicio || null,
      fecha_probable_termino: data.fecha_probable_termino || null,
    }
    const first = await admin().from('proyectos').insert(withDates).select('id, nombre').single()
    if (first.error && isMissingSchemaError(first.error.message)) {
      const legacy = await admin().from('proyectos').insert(base).select('id, nombre').single()
      if (legacy.error) throw new Error(legacy.error.message)
      return { success: true, proyecto: legacy.data }
    }
    if (first.error) throw new Error(first.error.message)
    return { success: true, proyecto: first.data }
  })

export const updateProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      proyectoId: string
      nombre?: string
      descripcion?: string
      tipo_obra?: string
      fecha_inicio?: string
      fecha_probable_termino?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const proyecto = await assertProyectoOwner(data.proyectoId, user.id)
    if (proyecto.estatus === 'concluido') {
      throw new Error('El proyecto ya está concluido. No se puede editar.')
    }
    const patch: Record<string, unknown> = {}
    if (data.nombre !== undefined) {
      const nombre = String(data.nombre || '').trim()
      if (nombre.length < 3) throw new Error('Nombre: mínimo 3 caracteres.')
      patch.nombre = nombre
    }
    if (data.descripcion !== undefined) {
      patch.descripcion = String(data.descripcion || '').trim() || null
    }
    if (data.tipo_obra !== undefined) {
      patch.tipo_obra = String(data.tipo_obra || 'otro').trim() || 'otro'
    }
    if (data.fecha_inicio !== undefined) patch.fecha_inicio = data.fecha_inicio || null
    if (data.fecha_probable_termino !== undefined) {
      patch.fecha_probable_termino = data.fecha_probable_termino || null
    }
    if (!Object.keys(patch).length) return { success: true }

    const { error } = await admin().from('proyectos').update(patch).eq('id', data.proyectoId)
    if (error) {
      if (
        isMissingSchemaError(error.message) &&
        ('fecha_inicio' in patch || 'fecha_probable_termino' in patch)
      ) {
        delete patch.fecha_inicio
        delete patch.fecha_probable_termino
        if (!Object.keys(patch).length) return { success: true }
        const retry = await admin().from('proyectos').update(patch).eq('id', data.proyectoId)
        if (retry.error) throw new Error(retry.error.message)
        return { success: true }
      }
      throw new Error(error.message)
    }
    return { success: true }
  })

export const deleteProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { proyectoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertProyectoOwner(data.proyectoId, user.id)
    const { error } = await admin().from('proyectos').delete().eq('id', data.proyectoId)
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const updateProyectoFechasFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      proyectoId: string
      fecha_inicio?: string
      fecha_probable_termino?: string
      descripcion?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertProyectoOwner(data.proyectoId, user.id)
    const patch: Record<string, unknown> = {}
    if (data.fecha_inicio !== undefined) patch.fecha_inicio = data.fecha_inicio || null
    if (data.fecha_probable_termino !== undefined)
      patch.fecha_probable_termino = data.fecha_probable_termino || null
    if (data.descripcion !== undefined) patch.descripcion = String(data.descripcion || '').trim() || null
    const { error } = await admin().from('proyectos').update(patch).eq('id', data.proyectoId)
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const getProyectoDetalleFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { proyectoId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const { proyecto, esOwner } = await assertProyectoAcceso(data.proyectoId, user.id)
    const db = admin()

    let grupos: any[] = []
    const gFull = await db
      .from('grupos')
      .select(
        'id, nombre, descripcion, rol_etiqueta, activo, mantenimiento, owner_id, created_at, presupuesto_asignado',
      )
      .eq('proyecto_id', data.proyectoId)
      .eq('activo', true)
      .order('created_at', { ascending: true })
    if (gFull.error && isMissingSchemaError(gFull.error.message)) {
      const gLegacy = await db
        .from('grupos')
        .select('id, nombre, descripcion, rol_etiqueta, activo, mantenimiento, owner_id, created_at')
        .eq('proyecto_id', data.proyectoId)
        .eq('activo', true)
        .order('created_at', { ascending: true })
      if (gLegacy.error) throw new Error(gLegacy.error.message)
      grupos = (gLegacy.data || []).map((g) => ({ ...g, presupuesto_asignado: 0 }))
    } else if (gFull.error) {
      throw new Error(gFull.error.message)
    } else {
      grupos = gFull.data || []
    }

    let movimientos: any[] = []
    const movRes = await db
      .from('proyecto_movimientos')
      .select('id, tipo, categoria, monto, fecha, concepto, referencia, notas, grupo_id, created_at')
      .eq('proyecto_id', data.proyectoId)
      .order('fecha', { ascending: false })
      .limit(200)
    if (movRes.error) {
      if (!isMissingSchemaError(movRes.error.message)) {
        console.warn('proyecto_movimientos:', movRes.error.message)
      }
    } else {
      movimientos = movRes.data || []
    }

    let imprevistos: any[] = []
    const impRes = await db
      .from('proyecto_imprevistos')
      .select('id, titulo, descripcion, fecha, impacto, monto, movimiento_id, created_at')
      .eq('proyecto_id', data.proyectoId)
      .order('fecha', { ascending: false })
      .limit(100)
    if (impRes.error) {
      if (!isMissingSchemaError(impRes.error.message)) {
        console.warn('proyecto_imprevistos:', impRes.error.message)
      }
    } else {
      imprevistos = impRes.data || []
    }

    const movs = movimientos
    const ingresos = movs.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto || 0), 0)
    const egresos = movs.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto || 0), 0)

    const gastoPorGrupo: Record<string, number> = {}
    for (const m of movs) {
      if (m.tipo !== 'egreso' || !m.grupo_id) continue
      gastoPorGrupo[m.grupo_id] = (gastoPorGrupo[m.grupo_id] || 0) + Number(m.monto || 0)
    }

    let diasTotales: number | null = null
    let diasTranscurridos: number | null = null
    let pctTiempo: number | null = null
    if (proyecto.fecha_inicio && proyecto.fecha_probable_termino) {
      const ini = Date.parse(proyecto.fecha_inicio)
      const fin = Date.parse(proyecto.fecha_probable_termino)
      if (Number.isFinite(ini) && Number.isFinite(fin) && fin >= ini) {
        diasTotales = Math.max(1, Math.round((fin - ini) / 86400000))
        diasTranscurridos = Math.min(
          diasTotales,
          Math.max(0, Math.round((Date.now() - ini) / 86400000)),
        )
        pctTiempo = Math.round((diasTranscurridos / diasTotales) * 100)
      }
    }

    return {
      proyecto,
      grupos,
      movimientos: movs,
      imprevistos,
      esOwner,
      finanzas: {
        ingresos,
        egresos,
        balance: ingresos - egresos,
        gastoPorGrupo,
      },
      tiempo: { diasTotales, diasTranscurridos, pctTiempo },
    }
  })

export const createGrupoProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      proyectoId: string
      nombre: string
      rol_etiqueta?: string
      descripcion?: string
      presupuesto_asignado?: number
      miembroIds?: string[]
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, profile } = await requireProUser()
    const proyecto = await assertProyectoOwner(data.proyectoId, user.id)
    if (proyecto.estatus === 'concluido') throw new Error('El proyecto ya está concluido.')
    const nombre = String(data.nombre || '').trim()
    if (nombre.length < 2) throw new Error('Nombre del grupo requerido.')
    const presupuesto = Math.max(0, Number(data.presupuesto_asignado || 0))
    const base = {
      nombre,
      descripcion: String(data.descripcion || '').trim() || null,
      tipo: 'proyecto' as const,
      proyecto_id: data.proyectoId,
      owner_id: user.id,
      rol_etiqueta: String(data.rol_etiqueta || '').trim() || null,
    }
    let grupo: { id: string; nombre: string }
    const withBudget = await admin()
      .from('grupos')
      .insert({ ...base, presupuesto_asignado: presupuesto })
      .select('id, nombre')
      .single()
    if (withBudget.error && isMissingSchemaError(withBudget.error.message)) {
      const legacy = await admin().from('grupos').insert(base).select('id, nombre').single()
      if (legacy.error) throw new Error(legacy.error.message)
      grupo = legacy.data
    } else if (withBudget.error || !withBudget.data) {
      throw new Error(withBudget.error?.message || 'No se pudo crear el grupo')
    } else {
      grupo = withBudget.data
    }
    await admin().from('grupo_miembros').insert({
      grupo_id: grupo.id,
      usuario_id: user.id,
      rol: 'owner',
      estatus: 'activo',
      invited_by: user.id,
    })
    const invitados = await inviteUsersToGrupo(
      grupo.id,
      user.id,
      String(profile?.nombre || 'Un miembro'),
      grupo.nombre,
      data.miembroIds || [],
    )
    return { success: true, grupo, invitados }
  })

export const updateGrupoPresupuestoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { grupoId: string; presupuesto_asignado: number }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    const { data: grupo } = await admin()
      .from('grupos')
      .select('id, proyecto_id, tipo')
      .eq('id', data.grupoId)
      .maybeSingle()
    if (!grupo?.proyecto_id) throw new Error('Solo grupos de proyecto tienen presupuesto.')
    await assertProyectoOwner(grupo.proyecto_id, user.id)
    const { error } = await admin()
      .from('grupos')
      .update({ presupuesto_asignado: Math.max(0, Number(data.presupuesto_asignado || 0)) })
      .eq('id', data.grupoId)
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const addProyectoMovimientoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      proyectoId: string
      tipo: 'ingreso' | 'egreso'
      categoria: string
      monto: number
      concepto: string
      fecha?: string
      referencia?: string
      notas?: string
      grupoId?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertProyectoOwner(data.proyectoId, user.id)
    const monto = Number(data.monto)
    if (!Number.isFinite(monto) || monto < 0) throw new Error('Monto inválido.')
    const concepto = String(data.concepto || '').trim()
    if (!concepto) throw new Error('Indica el concepto.')
    const categoria = String(data.categoria || '').trim()
    if (!categoria) throw new Error('Indica la categoría.')
    const { error } = await admin().from('proyecto_movimientos').insert({
      proyecto_id: data.proyectoId,
      tipo: data.tipo,
      categoria,
      monto,
      concepto,
      fecha: data.fecha || new Date().toISOString().slice(0, 10),
      referencia: String(data.referencia || '').trim() || null,
      notas: String(data.notas || '').trim() || null,
      grupo_id: data.grupoId || null,
      creado_por: user.id,
    })
    if (error) {
      if (isMissingSchemaError(error.message)) {
        throw new Error(
          'Falta aplicar el SQL 017 en Supabase (tabla proyecto_movimientos). Pégalo en el SQL Editor y reintenta.',
        )
      }
      throw new Error(error.message)
    }
    return { success: true }
  })

export const addProyectoImprevistoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      proyectoId: string
      titulo: string
      descripcion?: string
      fecha?: string
      impacto?: string
      monto?: number
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertProyectoOwner(data.proyectoId, user.id)
    const titulo = String(data.titulo || '').trim()
    if (!titulo) throw new Error('Título del imprevisto requerido.')
    const impacto = ['tiempo', 'dinero', 'ambos', 'otro'].includes(String(data.impacto))
      ? String(data.impacto)
      : 'otro'
    const { error } = await admin().from('proyecto_imprevistos').insert({
      proyecto_id: data.proyectoId,
      titulo,
      descripcion: String(data.descripcion || '').trim() || null,
      fecha: data.fecha || new Date().toISOString().slice(0, 10),
      impacto,
      monto: data.monto != null && Number.isFinite(Number(data.monto)) ? Number(data.monto) : null,
      creado_por: user.id,
    })
    if (error) {
      if (isMissingSchemaError(error.message)) {
        throw new Error(
          'Falta aplicar el SQL 017 en Supabase (tabla proyecto_imprevistos). Pégalo en el SQL Editor y reintenta.',
        )
      }
      throw new Error(error.message)
    }
    return { success: true }
  })

export const concluirProyectoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { proyectoId: string; gruposMantenimientoIds: string[] }) => d)
  .handler(async ({ data }) => {
    const { user } = await requireProUser()
    await assertProyectoOwner(data.proyectoId, user.id)
    const db = admin()
    const keep = new Set((data.gruposMantenimientoIds || []).map(String))
    const { data: grupos } = await db.from('grupos').select('id').eq('proyecto_id', data.proyectoId)
    for (const g of grupos || []) {
      const esMant = keep.has(g.id)
      await db.from('grupos').update({ mantenimiento: esMant, activo: esMant }).eq('id', g.id)
    }
    const { error } = await db
      .from('proyectos')
      .update({ estatus: 'concluido', concluido_at: new Date().toISOString() })
      .eq('id', data.proyectoId)
    if (error) throw new Error(error.message)
    return { success: true }
  })

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
