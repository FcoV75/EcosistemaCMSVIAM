import { createServerFn } from '@tanstack/react-start'
import { requireActiveUser } from '../lib/auth'
import { createSupabaseAdminClient } from '../lib/supabase.server'
import {
  CHECKLIST_SAT_MENSUAL,
  evaluarPerfilCompleto,
  evaluarTiendaEstructurada,
  resumenPorCategoria,
  type ContadorRegimen,
} from '../lib/contador-privado'
import { getContadorAccess } from '../lib/contador-entitlements'

async function requireContadorUser() {
  const session = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const access = await getContadorAccess(supabase, session.user, session.profile)
  if (!access.ok) {
    throw new Error(
      `Tu Contador Privado requiere suscripción (${access.precioLabel}). Actívalo desde la sección.`,
    )
  }
  return { ...session, supabase, access }
}

async function loadReadiness(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data: profile } = await supabase
    .from('perfiles')
    .select('nombre, habilidad_empirica, tipo_miembro, estado, municipio, celular')
    .eq('id', userId)
    .maybeSingle()
  const { data: negocio } = await supabase
    .from('negocios')
    .select('banner_url, items')
    .eq('id', userId)
    .maybeSingle()

  const perfil = evaluarPerfilCompleto(profile)
  const tienda = evaluarTiendaEstructurada(negocio)
  return {
    listo: perfil.ok && tienda.ok,
    perfil,
    tienda,
    profile,
  }
}

export const getContadorAccessFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireActiveUser()
  const supabase = createSupabaseAdminClient()
  const access = await getContadorAccess(supabase, session.user, session.profile)
  const readiness = await loadReadiness(supabase, session.user.id)
  return { ...access, readiness }
})

export const getContadorConfigFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, supabase, access } = await requireContadorUser()
  const readiness = await loadReadiness(supabase, user.id)
  const { data: config } = await supabase
    .from('contador_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  return { config, access, readiness }
})

export const saveContadorConfigFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      nombre_negocio: string
      rfc?: string
      regimen?: ContadorRegimen
      actividad?: string
      aviso_aceptado?: boolean
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    if (!data.nombre_negocio?.trim()) throw new Error('Nombre del negocio es obligatorio')
    if (data.aviso_aceptado === false) {
      throw new Error('Debes aceptar el aviso: esta herramienta no sustituye a un contador ni al SAT.')
    }
    const row = {
      user_id: user.id,
      nombre_negocio: data.nombre_negocio.trim(),
      rfc: (data.rfc || '').trim().toUpperCase() || null,
      regimen: data.regimen || 'sin_definir',
      actividad: (data.actividad || '').trim() || null,
      aviso_aceptado: data.aviso_aceptado !== false,
      updated_at: new Date().toISOString(),
    }
    const { data: saved, error } = await supabase
      .from('contador_config')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return { config: saved }
  })

export const ensureContadorPeriodoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { anio: number; mes: number }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    // Perfil/tienda son recomendaciones; no bloquean el libro de ingresos/egresos
    const anio = Number(data.anio)
    const mes = Number(data.mes)
    if (!anio || mes < 1 || mes > 12) throw new Error('Periodo inválido')

    const { data: existing } = await supabase
      .from('contador_periodos')
      .select('*')
      .eq('owner_id', user.id)
      .eq('anio', anio)
      .eq('mes', mes)
      .maybeSingle()

    if (existing) {
      await ensureChecklistRows(supabase, user.id, existing.id)
      return { periodo: existing }
    }

    const { data: created, error } = await supabase
      .from('contador_periodos')
      .insert({
        owner_id: user.id,
        anio,
        mes,
        estatus: 'abierto',
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await ensureChecklistRows(supabase, user.id, created.id)
    return { periodo: created }
  })

async function ensureChecklistRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  ownerId: string,
  periodoId: string,
) {
  const rows = CHECKLIST_SAT_MENSUAL.map((c) => ({
    periodo_id: periodoId,
    owner_id: ownerId,
    item_key: c.key,
    hecho: false,
  }))
  await supabase.from('contador_checklist').upsert(rows, {
    onConflict: 'periodo_id,item_key',
    ignoreDuplicates: true,
  })
}

export const listContadorPeriodosFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, supabase } = await requireContadorUser()
  const { data, error } = await supabase
    .from('contador_periodos')
    .select('id, anio, mes, estatus, cerrado_at, updated_at')
    .eq('owner_id', user.id)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(36)
  if (error) throw new Error(error.message)
  return { periodos: data || [] }
})

export const getContadorPeriodoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { periodoId: string }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    const { data: periodo, error } = await supabase
      .from('contador_periodos')
      .select('*')
      .eq('id', data.periodoId)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!periodo) throw new Error('Periodo no encontrado')

    const { data: movimientos } = await supabase
      .from('contador_movimientos')
      .select('*')
      .eq('periodo_id', periodo.id)
      .eq('owner_id', user.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    const { data: checklist } = await supabase
      .from('contador_checklist')
      .select('*')
      .eq('periodo_id', periodo.id)
      .eq('owner_id', user.id)

    const movs = movimientos || []
    const ingresos = movs
      .filter((m) => m.tipo === 'ingreso')
      .reduce((s, m) => s + Number(m.monto_centavos || 0), 0)
    const egresos = movs
      .filter((m) => m.tipo === 'egreso')
      .reduce((s, m) => s + Number(m.monto_centavos || 0), 0)

    // Saldo acumulado: meses anteriores del mismo año + saldo del mes actual
    const { data: prevPeriodos } = await supabase
      .from('contador_periodos')
      .select('id')
      .eq('owner_id', user.id)
      .eq('anio', periodo.anio)
      .lt('mes', periodo.mes)
    const prevIds = (prevPeriodos || []).map((p) => p.id)
    let saldoAcumuladoAnterior = 0
    if (prevIds.length) {
      const { data: prevMovs } = await supabase
        .from('contador_movimientos')
        .select('tipo, monto_centavos')
        .eq('owner_id', user.id)
        .in('periodo_id', prevIds)
      for (const m of prevMovs || []) {
        const n = Number(m.monto_centavos || 0)
        saldoAcumuladoAnterior += m.tipo === 'ingreso' ? n : -n
      }
    }

    return {
      periodo,
      movimientos: movs,
      checklist: checklist || [],
      resumen: {
        ingresosCentavos: ingresos,
        egresosCentavos: egresos,
        saldoCentavos: ingresos - egresos,
        saldoAcumuladoCentavos: saldoAcumuladoAnterior + (ingresos - egresos),
        countIngresos: movs.filter((m) => m.tipo === 'ingreso').length,
        countEgresos: movs.filter((m) => m.tipo === 'egreso').length,
        porCategoria: resumenPorCategoria(movs),
      },
    }
  })

export const addContadorMovimientoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      periodoId: string
      tipo: 'ingreso' | 'egreso'
      categoria: string
      concepto: string
      monto: number
      fecha?: string
      comprobante_url?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()

    const { data: periodo } = await supabase
      .from('contador_periodos')
      .select('id, estatus')
      .eq('id', data.periodoId)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!periodo) throw new Error('Periodo no encontrado')
    if (periodo.estatus === 'cerrado') throw new Error('El mes ya está cerrado. Reábrelo para editar.')

    const monto = Number(data.monto)
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido')
    if (!data.concepto?.trim()) throw new Error('Concepto obligatorio')
    if (data.tipo !== 'ingreso' && data.tipo !== 'egreso') throw new Error('Tipo inválido')

    const montoCentavos = Math.round(monto * 100)
    const { data: mov, error } = await supabase
      .from('contador_movimientos')
      .insert({
        periodo_id: data.periodoId,
        owner_id: user.id,
        tipo: data.tipo,
        categoria: (data.categoria || 'otros').trim(),
        concepto: data.concepto.trim(),
        monto_centavos: montoCentavos,
        fecha: data.fecha || new Date().toISOString().slice(0, 10),
        comprobante_url: data.comprobante_url || null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await supabase
      .from('contador_periodos')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', data.periodoId)

    return { movimiento: mov }
  })

export const deleteContadorMovimientoFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { movimientoId: string }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    const { data: mov } = await supabase
      .from('contador_movimientos')
      .select('id, periodo_id')
      .eq('id', data.movimientoId)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!mov) throw new Error('Movimiento no encontrado')

    const { data: periodo } = await supabase
      .from('contador_periodos')
      .select('estatus')
      .eq('id', mov.periodo_id)
      .maybeSingle()
    if (periodo?.estatus === 'cerrado') throw new Error('Mes cerrado')

    const { error } = await supabase
      .from('contador_movimientos')
      .delete()
      .eq('id', data.movimientoId)
      .eq('owner_id', user.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const toggleContadorChecklistFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { periodoId: string; itemKey: string; hecho: boolean }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    const { data: row, error } = await supabase
      .from('contador_checklist')
      .upsert(
        {
          periodo_id: data.periodoId,
          owner_id: user.id,
          item_key: data.itemKey,
          hecho: Boolean(data.hecho),
          hecho_at: data.hecho ? new Date().toISOString() : null,
        },
        { onConflict: 'periodo_id,item_key' },
      )
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return { item: row }
  })

export const setContadorPeriodoEstatusFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { periodoId: string; estatus: 'abierto' | 'cerrado' }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    const { data: saved, error } = await supabase
      .from('contador_periodos')
      .update({
        estatus: data.estatus,
        cerrado_at: data.estatus === 'cerrado' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.periodoId)
      .eq('owner_id', user.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return { periodo: saved }
  })

export const exportContadorAnualFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { anio: number }) => d)
  .handler(async ({ data }) => {
    const { user, supabase } = await requireContadorUser()
    const anio = Number(data.anio)
    const { data: config } = await supabase
      .from('contador_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    const { data: periodos } = await supabase
      .from('contador_periodos')
      .select('*')
      .eq('owner_id', user.id)
      .eq('anio', anio)
      .order('mes', { ascending: true })
    const ids = (periodos || []).map((p) => p.id)
    let movimientos: unknown[] = []
    if (ids.length) {
      const { data: movs } = await supabase
        .from('contador_movimientos')
        .select('*')
        .eq('owner_id', user.id)
        .in('periodo_id', ids)
        .order('fecha', { ascending: true })
      movimientos = movs || []
    }

    const porMes = (periodos || []).map((p) => {
      const movs = (movimientos as Array<{ periodo_id: string; tipo: string; monto_centavos: number }>).filter(
        (m) => m.periodo_id === p.id,
      )
      const ingresos = movs.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_centavos, 0)
      const egresos = movs.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto_centavos, 0)
      return {
        mes: p.mes,
        estatus: p.estatus,
        ingresosCentavos: ingresos,
        egresosCentavos: egresos,
        saldoCentavos: ingresos - egresos,
      }
    })

    return {
      exportedAt: new Date().toISOString(),
      anio,
      disclaimer:
        'Resumen educativo ContacNeed. No es una declaración fiscal ni sustituye presentación ante el SAT.',
      config,
      periodos: periodos || [],
      movimientos,
      resumenAnual: {
        porMes,
        ingresosCentavos: porMes.reduce((s, m) => s + m.ingresosCentavos, 0),
        egresosCentavos: porMes.reduce((s, m) => s + m.egresosCentavos, 0),
        saldoCentavos: porMes.reduce((s, m) => s + m.saldoCentavos, 0),
      },
    }
  })
