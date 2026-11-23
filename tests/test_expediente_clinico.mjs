import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = 'ContacNeed - Arquitectura Modular Diamante Estabilizada'

const migration = fs.readFileSync(`${base}/supabase/migrations/020_expediente_clinico.sql`, 'utf8')
assert.match(migration, /expediente_profesional/)
assert.match(migration, /expediente_pacientes/)
assert.match(migration, /expediente_notas/)
assert.match(migration, /es_miembro/)

const pricing = fs.readFileSync(`${base}/src/lib/expediente-clinico.ts`, 'utf8')
assert.match(pricing, /case 'diamante':\s*return 300/)
assert.match(pricing, /case 'platino':\s*return 500/)
assert.match(pricing, /case 'oro':\s*case 'plata':\s*return 600/)
assert.match(pricing, /default:\s*return 800/)
assert.match(pricing, /OTROS_REGISTROS_SUGERIDOS/)

const entitlements = fs.readFileSync(`${base}/src/lib/expediente-entitlements.ts`, 'utf8')
assert.match(entitlements, /PRODUCTO_EXPEDIENTE/)
assert.match(entitlements, /getExpedienteAccess/)
assert.match(entitlements, /activateExpedienteClinico/)

const server = fs.readFileSync(`${base}/src/server/expediente.functions.ts`, 'utf8')
assert.match(server, /createExpedientePacienteFn/)
assert.match(server, /addExpedienteNotaFn/)
assert.match(server, /audio_url/)
assert.match(server, /buscarMiembroParaExpedienteFn/)

const ui = fs.readFileSync(`${base}/src/components/expediente/ExpedienteClinicoApp.tsx`, 'utf8')
assert.match(ui, /export function ExpedienteClinicoApp/)
assert.match(ui, /MediaRecorder|mediaRecorder|getUserMedia/)
assert.match(ui, /miembros|es_miembro|No miembro/i)

const admin = fs.readFileSync(`${base}/src/components/admin/CmsPlusAdminPanel.tsx`, 'utf8')
assert.match(admin, /ExpedienteClinicoApp/)
assert.match(admin, /Expediente clínico/)

const route = fs.readFileSync(`${base}/src/routes/expediente-clinico.tsx`, 'utf8')
assert.match(route, /createFileRoute\('\/expediente-clinico'\)/)
assert.match(route, /createExpedienteCheckoutFn/)

const nav = fs.readFileSync(`${base}/src/components/SidebarNav.tsx`, 'utf8')
assert.match(nav, /expediente-clinico/)

const tree = fs.readFileSync(`${base}/src/routeTree.gen.ts`, 'utf8')
assert.match(tree, /ExpedienteClinicoRoute/)

const stripe = fs.readFileSync(`${base}/src/server/stripe.functions.ts`, 'utf8')
assert.match(stripe, /createExpedienteCheckoutFn/)
assert.match(stripe, /PRODUCTO_EXPEDIENTE/)

const webhook = fs.readFileSync(`${base}/netlify/functions/stripe-webhook.mjs`, 'utf8')
assert.match(webhook, /expediente_clinico/)
assert.match(webhook, /activateExpedienteFromCheckout/)

console.log('test_expediente_clinico: ok')
