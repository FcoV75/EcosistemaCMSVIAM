/**
 * Pruebas unitarias de la lógica de corrección/borrado (sin Supabase real).
 * Simula el contrato que usan updateGrupoFn / deleteGrupoFn / updateProyectoFn.
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function softDeleteGrupo(grupo, userId) {
  if (!grupo) throw new Error('Grupo no encontrado')
  if (grupo.owner_id !== userId) throw new Error('Solo el dueño del grupo puede hacer esto.')
  return { ...grupo, activo: false }
}

function patchGrupo(grupo, userId, patch) {
  if (!grupo) throw new Error('Grupo no encontrado')
  if (grupo.owner_id !== userId) throw new Error('Solo el dueño del grupo puede hacer esto.')
  if (!grupo.activo) throw new Error('Este grupo ya no está activo.')
  const next = { ...grupo }
  if (patch.nombre !== undefined) {
    const nombre = String(patch.nombre || '').trim()
    if (nombre.length < 2) throw new Error('Nombre: mínimo 2 caracteres.')
    next.nombre = nombre
  }
  if (patch.descripcion !== undefined) {
    next.descripcion = String(patch.descripcion || '').trim() || null
  }
  return next
}

function patchProyecto(proyecto, userId, patch) {
  if (!proyecto) throw new Error('Proyecto no encontrado')
  if (proyecto.owner_id !== userId) throw new Error('Solo el dueño del proyecto puede hacer esto.')
  if (proyecto.estatus === 'concluido') {
    throw new Error('El proyecto ya está concluido. No se puede editar.')
  }
  const next = { ...proyecto }
  if (patch.nombre !== undefined) {
    const nombre = String(patch.nombre || '').trim()
    if (nombre.length < 3) throw new Error('Nombre: mínimo 3 caracteres.')
    next.nombre = nombre
  }
  return next
}

function isMissingSchemaError(message) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('column') && m.includes('not exist'))
  )
}

const owner = 'user-owner'
const other = 'user-other'
const grupo = {
  id: 'g1',
  owner_id: owner,
  nombre: 'Taller',
  descripcion: 'desc',
  activo: true,
  tipo: 'comun',
}
const proyecto = {
  id: 'p1',
  owner_id: owner,
  nombre: 'Hospital',
  estatus: 'activo',
}

let passed = 0
function ok(name) {
  passed += 1
  console.log('OK ', name)
}

try {
  const edited = patchGrupo(grupo, owner, { nombre: 'Taller 2', descripcion: 'nueva' })
  assert(edited.nombre === 'Taller 2', 'nombre no actualizado')
  ok('dueño edita grupo')
} catch (e) {
  console.error('FAIL dueño edita grupo', e.message)
  process.exitCode = 1
}

try {
  patchGrupo(grupo, other, { nombre: 'Hack' })
  console.error('FAIL extraño no debe editar')
  process.exitCode = 1
} catch (e) {
  assert(e.message.includes('dueño'), e.message)
  ok('bloquea edición de no-dueño')
}

try {
  const deleted = softDeleteGrupo(grupo, owner)
  assert(deleted.activo === false, 'debe soft-delete')
  ok('dueño borra (soft) grupo')
} catch (e) {
  console.error('FAIL soft delete', e.message)
  process.exitCode = 1
}

try {
  patchProyecto({ ...proyecto, estatus: 'concluido' }, owner, { nombre: 'Xxxx' })
  console.error('FAIL no editar concluido')
  process.exitCode = 1
} catch (e) {
  assert(e.message.includes('concluido'), e.message)
  ok('no edita proyecto concluido')
}

try {
  const p = patchProyecto(proyecto, owner, { nombre: 'Torre Norte' })
  assert(p.nombre === 'Torre Norte', 'nombre proyecto')
  ok('dueño edita proyecto')
} catch (e) {
  console.error('FAIL editar proyecto', e.message)
  process.exitCode = 1
}

assert(isMissingSchemaError('column proyectos.fecha_inicio does not exist'), 'detecta col')
assert(isMissingSchemaError("Could not find the table 'public.proyecto_movimientos' in the schema cache"), 'detecta tabla')
assert(!isMissingSchemaError('new row violates row-level security'), 'no confunde RLS')
ok('detector missing schema')

console.log('\nCRUD logic:', passed, 'checks')
