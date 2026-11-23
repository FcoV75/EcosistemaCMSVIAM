import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = 'ContacNeed - Arquitectura Modular Diamante Estabilizada'

const migration = fs.readFileSync(`${base}/supabase/migrations/021_tu_contador_privado.sql`, 'utf8')
assert.match(migration, /contador_config/)
assert.match(migration, /contador_periodos/)
assert.match(migration, /contador_movimientos/)
assert.match(migration, /contador_checklist/)

const pricing = fs.readFileSync(`${base}/src/lib/contador-privado.ts`, 'utf8')
assert.match(pricing, /case 'diamante':\s*return 199/)
assert.match(pricing, /case 'platino':\s*return 299/)
assert.match(pricing, /evaluarTiendaEstructurada/)
assert.match(pricing, /evaluarPerfilCompleto/)
assert.match(pricing, /CONTADOR_DISCLAIMER/)

const entitlements = fs.readFileSync(`${base}/src/lib/contador-entitlements.ts`, 'utf8')
assert.match(entitlements, /PRODUCTO_CONTADOR/)
assert.match(entitlements, /getContadorAccess/)
assert.match(entitlements, /activateContadorPrivado/)

const server = fs.readFileSync(`${base}/src/server/contador.functions.ts`, 'utf8')
assert.match(server, /ensureContadorPeriodoFn/)
assert.match(server, /addContadorMovimientoFn/)
assert.match(server, /exportContadorAnualFn/)
assert.match(server, /readiness/)

const ui = fs.readFileSync(`${base}/src/components/contador/ContadorPrivadoApp.tsx`, 'utf8')
assert.match(ui, /export function ContadorPrivadoApp/)
assert.match(ui, /CHECKLIST_SAT_MENSUAL/)
assert.match(ui, /\/profile/)

const route = fs.readFileSync(`${base}/src/routes/tu-contador-privado.tsx`, 'utf8')
assert.match(route, /createFileRoute\('\/tu-contador-privado'\)/)
assert.match(route, /createContadorCheckoutFn/)

const nav = fs.readFileSync(`${base}/src/components/SidebarNav.tsx`, 'utf8')
assert.match(nav, /tu-contador-privado/)

const tree = fs.readFileSync(`${base}/src/routeTree.gen.ts`, 'utf8')
assert.match(tree, /TuContadorPrivadoRoute/)

const stripe = fs.readFileSync(`${base}/src/server/stripe.functions.ts`, 'utf8')
assert.match(stripe, /createContadorCheckoutFn/)
assert.match(stripe, /PRODUCTO_CONTADOR/)

const webhook = fs.readFileSync(`${base}/netlify/functions/stripe-webhook.mjs`, 'utf8')
assert.match(webhook, /contador_privado/)
assert.match(webhook, /activateContadorFromCheckout/)

console.log('test_tu_contador_privado: ok')
