/**
 * Prueba en vivo contra PostgREST público de ContacNeed:
 * valida columnas 017 y que el embed ambiguo de perfiles falla
 * (la causa del error al abrir un grupo con miembros).
 *
 * Requiere env:
 *   SUPABASE_URL o VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY o VITE_SUPABASE_ANON_KEY
 */
const URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
const KEY = String(
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
).trim()

if (!URL || !KEY) {
  console.error(
    'Faltan SUPABASE_URL/VITE_SUPABASE_URL y SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY',
  )
  process.exit(1)
}

async function api(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const results = []

async function check(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log('OK ', name)
  } catch (e) {
    results.push({ name, ok: false, error: e.message })
    console.error('FAIL', name, '→', e.message)
  }
}

await check('017 columnas fecha_inicio existen', async () => {
  const { json } = await api('proyectos?select=id,fecha_inicio,fecha_probable_termino&limit=1')
  assert(Array.isArray(json), `esperado array, got ${JSON.stringify(json)}`)
})

await check('017 presupuesto_asignado existe', async () => {
  const { json } = await api('grupos?select=id,presupuesto_asignado&limit=1')
  assert(Array.isArray(json), `esperado array, got ${JSON.stringify(json)}`)
})

await check('017 proyecto_movimientos existe', async () => {
  const { json } = await api('proyecto_movimientos?select=id&limit=1')
  assert(Array.isArray(json), `esperado array, got ${JSON.stringify(json)}`)
})

await check('017 proyecto_imprevistos existe', async () => {
  const { json } = await api('proyecto_imprevistos?select=id&limit=1')
  assert(Array.isArray(json), `esperado array, got ${JSON.stringify(json)}`)
})

await check('embed ambiguo perfiles(*) falla (PGRST201)', async () => {
  const { json } = await api('grupo_miembros?select=id,perfiles(*)&limit=1')
  assert(json?.code === 'PGRST201', `se esperaba PGRST201, got ${JSON.stringify(json)}`)
})

await check('embed con hint perfiles!usuario_id funciona', async () => {
  const { json } = await api(
    'grupo_miembros?select=usuario_id,rol,estatus,perfiles!usuario_id(id,nombre)&limit=1',
  )
  assert(Array.isArray(json), `esperado array, got ${JSON.stringify(json)}`)
})

await check('select sin embed (estrategia actual) funciona', async () => {
  const { json } = await api('grupo_miembros?select=usuario_id,rol,estatus&limit=1')
  assert(Array.isArray(json), `esperado array, got ${JSON.stringify(json)}`)
})

await check('sintaxis vieja perfiles:usuario_id no debe usarse como única vía', async () => {
  // Documentamos el riesgo: alias mal interpretado. La app ya no la usa.
  const { json } = await api(
    'grupo_miembros?select=usuario_id,perfiles:usuario_id(id,nombre)&limit=1',
  )
  // Puede devolver [] o error según versión; no debe ser PGRST201 de ambigüedad.
  if (json?.code === 'PGRST201') {
    throw new Error('alias también ambigua en este entorno')
  }
})

const failed = results.filter((r) => !r.ok)
console.log('\nResumen:', results.length - failed.length, '/', results.length, 'ok')
if (failed.length) {
  process.exitCode = 1
}
