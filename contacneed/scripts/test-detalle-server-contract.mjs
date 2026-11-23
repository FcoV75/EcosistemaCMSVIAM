/**
 * Contrato de las funciones de detalle: deben poder resolverse con dueño
 * sin depender de embeds ambiguos de perfiles.
 */
function isMissingSchemaError(message) {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('column') && m.includes('not exist'))
  )
}

function loadMiembrosSinEmbed(rows, perfiles) {
  const byId = new Map(perfiles.map((p) => [p.id, p]))
  return rows.map((m) => ({ ...m, perfiles: byId.get(m.usuario_id) || null }))
}

function assertProyectoAcceso(proyecto, userId, membGrupoIds) {
  if (!proyecto) throw new Error('Proyecto no encontrado')
  if (proyecto.owner_id === userId) return { esOwner: true }
  if (!membGrupoIds.length) throw new Error('No tienes acceso a este proyecto.')
  return { esOwner: false }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

let n = 0
function ok(name) {
  n += 1
  console.log('OK ', name)
}

const miembros = loadMiembrosSinEmbed(
  [
    { usuario_id: 'u1', rol: 'owner', estatus: 'activo' },
    { usuario_id: 'u2', rol: 'miembro', estatus: 'invitado' },
  ],
  [{ id: 'u1', nombre: 'Ana' }],
)
assert(miembros[0].perfiles?.nombre === 'Ana', 'owner perfil')
assert(miembros[1].perfiles === null, 'invitado sin perfil')
ok('miembros sin embed')

const accesoOwner = assertProyectoAcceso({ owner_id: 'u1' }, 'u1', [])
assert(accesoOwner.esOwner === true, 'owner acceso')
ok('proyecto owner entra sin membresía de grupo')

try {
  assertProyectoAcceso({ owner_id: 'u1' }, 'u9', [])
  throw new Error('debía fallar')
} catch (e) {
  assert(String(e.message).includes('acceso'), e.message)
  ok('colaborador sin grupo no entra')
}

assert(isMissingSchemaError('column x does not exist'), 'schema detector')
ok('schema detector')

console.log(`\nDetalle contract: ${n} checks`)
