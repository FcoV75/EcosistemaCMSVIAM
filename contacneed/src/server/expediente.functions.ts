import { createServerFn } from '@tanstack/react-start'
import { requireActiveUser, requireAdminUser } from '../lib/auth'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import {
  authorLabel,
  calcImc,
  nextNumeroExpediente,
  NOTA_TIPOS,
  type ExpedienteRama,
  type ExpedienteVitals,
  type NotaTipo,
} from '../lib/expediente-clinico'
import {
  activateExpedienteClinico,
  getExpedienteAccess,
} from '../lib/expediente-entitlements'
import { getCmsPlusStatus } from '../lib/cms-plus-entitlements'

async function requireExpedienteUser() {
  const session = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const access = await getExpedienteAccess(supabase, session.user, session.profile)
  if (!access.ok) {
    throw new Error(
      `Expediente clínico requiere suscripción (${access.precioLabel}). Actívalo desde la sección Expediente clínico.`,
    )
  }
  return { ...session, supabase, access }
}

function sealAuthor(profesional: {
  nombre_profesional?: string | null
  cedula_profesional?: string | null
} | null) {
  return authorLabel(profesional || {})
}

export const getExpedienteAccessFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const access = await getExpedienteAccess(supabase, session.user, session.profile)
  const cms = await getCmsPlusStatus(supabase, session.user.id)
  return {
    ...access,
    cmsActive: cms.active,
    cmsNivel: cms.nivel,
  }
})

export const getExpedienteProfesionalFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, supabase, access } = await requireExpedienteUser()
  const { data } = await supabase
    .from('expediente_profesional')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  return { profesional: data, access }
})

export const saveExpedienteProfesionalFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      institucion: string
      tipo_establecimiento?: string
      telefono_institucional?: string
      domicilio_establecimiento: string
      nombre_profesional: string
      cedula_profesional: string
      especialidad?: string
      profesion_rama?: ExpedienteRama
      aviso_privacidad_aceptado?: boolean
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    if (!data.institucion?.trim()) throw new Error('Institución / unidad médica es obligatoria')
    if (!data.domicilio_establecimiento?.trim()) throw new Error('Domicilio del establecimiento es obligatorio')
    if (!data.nombre_profesional?.trim()) throw new Error('Nombre del profesional es obligatorio')
    if (!data.cedula_profesional?.trim()) throw new Error('Cédula profesional es obligatoria')

    const row = {
      user_id: user.id,
      institucion: data.institucion.trim(),
      tipo_establecimiento: (data.tipo_establecimiento || '').trim(),
      telefono_institucional: (data.telefono_institucional || '').trim(),
      domicilio_establecimiento: data.domicilio_establecimiento.trim(),
      nombre_profesional: data.nombre_profesional.trim(),
      cedula_profesional: data.cedula_profesional.trim(),
      especialidad: (data.especialidad || '').trim(),
      profesion_rama: data.profesion_rama || 'medicina',
      aviso_privacidad_aceptado: data.aviso_privacidad_aceptado !== false,
      updated_at: new Date().toISOString(),
    }

    const { data: saved, error } = await supabase
      .from('expediente_profesional')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return { profesional: saved }
  })

export const listExpedientePacientesFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      q?: string
      filtro?: 'todos' | 'miembros' | 'no_miembros' | 'activo' | 'alta'
    }) => d || {},
  )
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    let query = supabase
      .from('expediente_pacientes')
      .select(
        'id, numero_expediente, estatus, es_miembro, nombre_completo, fecha_nacimiento, sexo, diagnostico, alergias, telefono, created_at, updated_at, miembro_email, miembro_codigo_cms',
      )
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200)

    const filtro = data?.filtro || 'todos'
    if (filtro === 'miembros') query = query.eq('es_miembro', true)
    if (filtro === 'no_miembros') query = query.eq('es_miembro', false)
    if (filtro === 'activo') query = query.eq('estatus', 'activo')
    if (filtro === 'alta') query = query.eq('estatus', 'alta')

    const { data: rows, error } = await query
    if (error) throw new Error(error.message)

    const q = (data?.q || '').trim().toLowerCase()
    const pacientes = !q
      ? rows || []
      : (rows || []).filter((p) => {
          const blob = [
            p.nombre_completo,
            p.numero_expediente,
            p.diagnostico,
            p.miembro_email,
            p.miembro_codigo_cms,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return blob.includes(q)
        })

    return {
      pacientes,
      conteos: {
        total: (rows || []).length,
        miembros: (rows || []).filter((p) => p.es_miembro).length,
        no_miembros: (rows || []).filter((p) => !p.es_miembro).length,
        activos: (rows || []).filter((p) => p.estatus === 'activo').length,
      },
    }
  })

export const getExpedientePacienteFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { pacienteId: string }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    const { data: paciente, error } = await supabase
      .from('expediente_pacientes')
      .select('*')
      .eq('id', data.pacienteId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!paciente) throw new Error('Expediente no encontrado')

    const { data: notas, error: nErr } = await supabase
      .from('expediente_notas')
      .select('*')
      .eq('paciente_id', paciente.id)
      .eq('owner_id', user.id)
      .order('sealed_at', { ascending: false })
    if (nErr) throw new Error(nErr.message)

    const { data: profesional } = await supabase
      .from('expediente_profesional')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    return { paciente, notas: notas || [], profesional }
  })

export const createExpedientePacienteFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      es_miembro: boolean
      miembro_email?: string
      miembro_codigo_cms?: string
      miembro_user_id?: string
      nombre_completo: string
      fecha_nacimiento: string
      sexo: 'Femenino' | 'Masculino' | 'Intersexual'
      curp?: string
      grupo_sanguineo?: string
      telefono: string
      domicilio: string
      ocupacion?: string
      contacto_emergencia?: string
      alergias: string
      ahf: string
      app: string
      apnp: string
      ago?: string
      padecimiento_actual: string
      interrogatorio_sistemas: string
      vitals?: ExpedienteVitals
      exploracion_fisica: string
      laboratorios?: string
      diagnostico: string
      plan_terapeutico: string
      pronostico: string
      numero_expediente?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    const { data: profesional } = await supabase
      .from('expediente_profesional')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profesional?.cedula_profesional || !profesional?.nombre_profesional) {
      throw new Error('Configura primero tus datos profesionales (NOM-004 numeral 5.2).')
    }

    const required = [
      ['nombre_completo', data.nombre_completo],
      ['fecha_nacimiento', data.fecha_nacimiento],
      ['telefono', data.telefono],
      ['domicilio', data.domicilio],
      ['alergias', data.alergias],
      ['ahf', data.ahf],
      ['app', data.app],
      ['apnp', data.apnp],
      ['padecimiento_actual', data.padecimiento_actual],
      ['interrogatorio_sistemas', data.interrogatorio_sistemas],
      ['exploracion_fisica', data.exploracion_fisica],
      ['diagnostico', data.diagnostico],
      ['plan_terapeutico', data.plan_terapeutico],
      ['pronostico', data.pronostico],
    ] as const
    for (const [k, v] of required) {
      if (!String(v || '').trim()) throw new Error(`Campo obligatorio: ${k}`)
    }

    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('expediente_pacientes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
    const numero =
      (data.numero_expediente || '').trim() || nextNumeroExpediente(year, (count || 0) + 1)

    const vitals = { ...(data.vitals || {}) }
    if (!vitals.bmi && vitals.weight && vitals.height) {
      vitals.bmi = calcImc(vitals.weight, vitals.height)
    }

    const row = {
      owner_id: user.id,
      numero_expediente: numero,
      estatus: 'activo',
      es_miembro: Boolean(data.es_miembro),
      miembro_user_id: data.es_miembro ? data.miembro_user_id || null : null,
      miembro_email: data.es_miembro ? (data.miembro_email || '').trim().toLowerCase() || null : null,
      miembro_codigo_cms: data.es_miembro
        ? (data.miembro_codigo_cms || '').trim().toUpperCase() || null
        : null,
      nombre_completo: data.nombre_completo.trim(),
      fecha_nacimiento: data.fecha_nacimiento,
      sexo: data.sexo,
      curp: (data.curp || '').trim().toUpperCase() || null,
      grupo_sanguineo: data.grupo_sanguineo || 'No referido',
      telefono: data.telefono.trim(),
      domicilio: data.domicilio.trim(),
      ocupacion: (data.ocupacion || '').trim() || null,
      contacto_emergencia: (data.contacto_emergencia || '').trim() || null,
      alergias: data.alergias.trim(),
      ahf: data.ahf.trim(),
      app: data.app.trim(),
      apnp: data.apnp.trim(),
      ago: (data.ago || '').trim() || null,
      padecimiento_actual: data.padecimiento_actual.trim(),
      interrogatorio_sistemas: data.interrogatorio_sistemas.trim(),
      vitals,
      exploracion_fisica: data.exploracion_fisica.trim(),
      laboratorios: (data.laboratorios || '').trim() || null,
      diagnostico: data.diagnostico.trim(),
      plan_terapeutico: data.plan_terapeutico.trim(),
      pronostico: data.pronostico.trim(),
      created_by_label: sealAuthor(profesional),
      updated_at: new Date().toISOString(),
    }

    const { data: saved, error } = await supabase
      .from('expediente_pacientes')
      .insert(row)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return { paciente: saved }
  })

export const updateExpedienteEstatusFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { pacienteId: string; estatus: 'activo' | 'alta' | 'archivado' }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    const { data: saved, error } = await supabase
      .from('expediente_pacientes')
      .update({ estatus: data.estatus, updated_at: new Date().toISOString() })
      .eq('id', data.pacienteId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .select('id, estatus')
      .single()
    if (error) throw new Error(error.message)
    return { paciente: saved }
  })

export const softDeleteExpedientePacienteFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { pacienteId: string }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    // Soft delete: cumple espíritu de conservación (no se borra de base; se oculta).
    const { error } = await supabase
      .from('expediente_pacientes')
      .update({
        deleted_at: new Date().toISOString(),
        estatus: 'archivado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.pacienteId)
      .eq('owner_id', user.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const addExpedienteNotaFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      pacienteId: string
      tipo_nota: NotaTipo
      diagnostico: string
      evolucion: string
      laboratorios?: string
      tratamiento: string
      pronostico: string
      vitals?: ExpedienteVitals
      audio_url?: string
      audio_duracion_seg?: number
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    if (!NOTA_TIPOS.includes(data.tipo_nota)) throw new Error('Tipo de nota inválido')
    if (!data.diagnostico?.trim()) throw new Error('Diagnóstico obligatorio')
    if (!data.evolucion?.trim() && !data.audio_url) {
      throw new Error('Evolución escrita o grabación de audio es obligatoria')
    }
    if (!data.tratamiento?.trim()) throw new Error('Tratamiento / indicaciones obligatorias')
    if (!data.pronostico?.trim()) throw new Error('Pronóstico obligatorio')

    const { data: paciente } = await supabase
      .from('expediente_pacientes')
      .select('id')
      .eq('id', data.pacienteId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!paciente) throw new Error('Expediente no encontrado')

    const { data: profesional } = await supabase
      .from('expediente_profesional')
      .select('nombre_profesional, cedula_profesional')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: nota, error } = await supabase
      .from('expediente_notas')
      .insert({
        paciente_id: data.pacienteId,
        owner_id: user.id,
        tipo_nota: data.tipo_nota,
        diagnostico: data.diagnostico.trim(),
        evolucion: (data.evolucion || '').trim() || '(Nota respaldada con audio de consulta)',
        laboratorios: (data.laboratorios || '').trim() || null,
        tratamiento: data.tratamiento.trim(),
        pronostico: data.pronostico.trim(),
        vitals: data.vitals || {},
        audio_url: data.audio_url || null,
        audio_duracion_seg: data.audio_duracion_seg || null,
        author_label: sealAuthor(profesional),
        sealed_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await supabase
      .from('expediente_pacientes')
      .update({
        diagnostico: data.diagnostico.trim(),
        updated_at: new Date().toISOString(),
        ...(data.tipo_nota === 'Nota de Alta / Egreso' ? { estatus: 'alta' } : {}),
      })
      .eq('id', data.pacienteId)
      .eq('owner_id', user.id)

    return { nota }
  })

export const exportExpedienteBackupFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, supabase } = await requireExpedienteUser()
  const { data: profesional } = await supabase
    .from('expediente_profesional')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  const { data: pacientes } = await supabase
    .from('expediente_pacientes')
    .select('*')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
  const ids = (pacientes || []).map((p) => p.id)
  let notas: unknown[] = []
  if (ids.length) {
    const { data } = await supabase
      .from('expediente_notas')
      .select('*')
      .eq('owner_id', user.id)
      .in('paciente_id', ids)
      .order('sealed_at', { ascending: true })
    notas = data || []
  }
  return {
    exportedAt: new Date().toISOString(),
    norma: 'NOM-004-SSA3-2012 / NOM-024-SSA3-2012',
    profesional,
    pacientes: pacientes || [],
    notas,
  }
})

/** Descarga de un solo expediente (paciente + notas selladas) para archivo local o nube. */
export const exportExpedientePacienteFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { pacienteId: string }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireExpedienteUser()
    const { data: profesional } = await supabase
      .from('expediente_profesional')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    const { data: paciente, error } = await supabase
      .from('expediente_pacientes')
      .select('*')
      .eq('id', data.pacienteId)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!paciente) throw new Error('Expediente no encontrado')

    const { data: notas } = await supabase
      .from('expediente_notas')
      .select('*')
      .eq('paciente_id', paciente.id)
      .eq('owner_id', user.id)
      .order('sealed_at', { ascending: true })

    return {
      exportedAt: new Date().toISOString(),
      norma: 'NOM-004-SSA3-2012 / NOM-024-SSA3-2012',
      disclaimer:
        'Respaldo del expediente clínico ContacNeed. Consérvalo bajo tu responsabilidad profesional y la LFPDPPP.',
      profesional,
      paciente,
      notas: notas || [],
    }
  })

/** Owner/admin: activar expediente gratis para sí mismo (o permanent). */
export const activarExpedienteOwnerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const admin = await requireAdminUser()
  if (!admin?.user) throw new Error('Solo el creador/admin puede auto-activar sin pago')
  const supabase = createSupabaseAdminClient()
  const access = await getExpedienteAccess(supabase, admin.user, admin.profile)
  if (!access.esOwner && !admin.profile?.is_admin) {
    throw new Error('Sin privilegio de fundador')
  }
  await activateExpedienteClinico(supabase, {
    userId: admin.user.id,
    email: admin.user.email,
    permanent: true,
    precioMxn: 0,
    source: 'owner_gratis',
  })
  return { ok: true, precioLabel: 'Gratis (creador)' }
})

export const buscarMiembroParaExpedienteFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    await requireExpedienteUser()
    const q = data.q.trim()
    if (q.length < 2) return { matches: [] as Array<Record<string, unknown>> }
    const supabase = createSupabaseAdminClient()
    const like = `%${q}%`
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre, email, metadata')
      .or(`email.ilike.${like},nombre.ilike.${like}`)
      .limit(8)

    const matches = []
    for (const p of perfiles || []) {
      const { data: ent } = await supabase
        .from('ecosistema_entitlements')
        .select('legacy_code, plan, producto, status')
        .eq('user_id', p.id)
        .eq('producto', 'cms_plus')
        .eq('status', 'active')
        .maybeSingle()
      matches.push({
        userId: p.id,
        nombre: p.nombre,
        email: p.email,
        legacyCode: ent?.legacy_code || null,
        nivel: ent?.plan || null,
        esMiembroCmsPlus: Boolean(ent),
      })
    }

    if (/^CMS-/i.test(q)) {
      const { data: byCode } = await supabase
        .from('ecosistema_entitlements')
        .select('user_id, legacy_code, plan')
        .eq('producto', 'cms_plus')
        .eq('status', 'active')
        .ilike('legacy_code', q.toUpperCase())
        .limit(5)
      for (const e of byCode || []) {
        if (matches.some((m) => m.userId === e.user_id)) continue
        const { data: perf } = await supabase
          .from('perfiles')
          .select('id, nombre, email')
          .eq('id', e.user_id)
          .maybeSingle()
        if (perf) {
          matches.push({
            userId: perf.id,
            nombre: perf.nombre,
            email: perf.email,
            legacyCode: e.legacy_code,
            nivel: e.plan,
            esMiembroCmsPlus: true,
          })
        }
      }
    }

    return { matches }
  })
