import assert from 'node:assert/strict'
import fs from 'node:fs'

const entitlements = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/lib/cms-plus-entitlements.ts',
  'utf8',
)
assert.match(entitlements, /cms_plus_consumir_credito/)
assert.match(entitlements, /idempotencyKey/)
assert.match(entitlements, /Solo se puede descontar 1 crédito/)
assert.match(entitlements, /ajustarUsadosCredito/)

const migration = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/supabase/migrations/019_cms_plus_credito_atomico.sql',
  'utf8',
)
assert.match(migration, /cms_plus_consumir_credito/)
assert.match(migration, /allotment - usados/)

const ui = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/routes/circulo-cms-plus.tsx',
  'utf8',
)
assert.match(ui, /Registrar 1 crédito de mi consulta/)
assert.equal(ui.includes('Usar 1 crédito (beneficiario)'), false)
assert.equal(ui.includes('abrirCitasConCredito'), false)
assert.match(ui, /no gastan tus\s+créditos/)

const admin = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/components/admin/CmsPlusAdminPanel.tsx',
  'utf8',
)
assert.match(admin, /consultarMiembroCmsPlusAdminFn/)
assert.match(admin, /Consulta de créditos/)
assert.match(admin, /Corregir usados/)
assert.match(admin, /Beneficiarios del círculo/)

const fns = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/cms-plus.functions.ts',
  'utf8',
)
assert.match(fns, /consultarMiembroCmsPlusAdminFn/)
assert.match(fns, /ajustarCreditosCmsPlusAdminFn/)
assert.match(fns, /idempotencyKey/)

console.log('test_cms_plus_creditos_admin: ok')
