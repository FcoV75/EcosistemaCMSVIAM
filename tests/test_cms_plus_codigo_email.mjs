import assert from 'node:assert/strict'
import fs from 'node:fs'

const entitlements = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/lib/cms-plus-entitlements.ts',
  'utf8',
)
assert.match(entitlements, /notifyCmsPlusActivation/)
assert.match(entitlements, /notifyPrivilegeGrant/)
assert.match(entitlements, /codigo_notificado_at/)

const cmsFns = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/cms-plus.functions.ts',
  'utf8',
)
assert.match(cmsFns, /Correo enviado con el código CMS/)
assert.match(cmsFns, /maybeSendRenewalReminder/)
assert.match(cmsFns, /usarCreditoCmsPlusFn/)

const stripeFns = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/stripe.functions.ts',
  'utf8',
)
assert.match(stripeFns, /subscription_data: \{ metadata \}/)
assert.match(stripeFns, /notifyPrivilegeGrant/)
assert.match(stripeFns, /legacyCode: result\.legacyCode/)

const webhook = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/netlify/functions/stripe-webhook.mjs',
  'utf8',
)
assert.match(webhook, /legacyCode/)
assert.match(webhook, /sendPrivilegeEmail/)
assert.match(webhook, /renewFromInvoice/)
assert.match(webhook, /subscription_create/)

const ui = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/routes/circulo-cms-plus.tsx',
  'utf8',
)
assert.match(ui, /usarCreditoCmsPlusFn/)
assert.match(ui, /Registrar 1 crédito de mi consulta/)
assert.equal(ui.includes('Usar 1 crédito (beneficiario)'), false)
assert.equal(ui.includes('abrirCitasConCredito'), false)

const shell = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/components/AppShell.tsx',
  'utf8',
)
assert.match(shell, /cmsPlusRenovacion/)
assert.match(shell, /Renueva tu Círculo CMS-Plus/)

const fallbackCheckout = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/netlify/functions/create-checkout-session.mjs',
  'utf8',
)
assert.match(fallbackCheckout, /plan = esAnual \? 'annual' : 'monthly'/)
assert.match(fallbackCheckout, /subscription_data/)

const bridge = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/components/LiveSocialBridge.tsx',
  'utf8',
)
assert.match(bridge, /table: 'publicaciones'/)

console.log('test_cms_plus_codigo_email: ok')
