import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const catalogSrc = fs.readFileSync('netlify/functions/lib/stripe-catalog.mjs', 'utf8')
assert.match(catalogSrc, /cms_plus/)
assert.match(catalogSrc, /STRIPE_PRICE_CMS_PLUS_PLATA_MONTHLY/)
assert.match(catalogSrc, /249900/)

const webhook = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/netlify/functions/stripe-webhook.mjs',
  'utf8',
)
assert.match(webhook, /producto === 'cms_plus'/)
assert.match(webhook, /activateCmsPlusFromCheckout/)
assert.equal(webhook.includes('payment_method_types'), false)

const stripeFn = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/stripe.functions.ts',
  'utf8',
)
assert.match(stripeFn, /createCmsPlusCheckoutFn/)
assert.match(stripeFn, /producto: 'cms_plus'/)
assert.match(stripeFn, /images: \[imageUrl\]/)
assert.match(stripeFn, /Gracias_Pago_CMS\.png/)
assert.equal(stripeFn.includes('payment_method_types'), false)

const circuloUi = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/routes/circulo-cms-plus.tsx',
  'utf8',
)
assert.equal(
  circuloUi.includes('GraciasPagoVisual'),
  false,
  'La foto Gracias no debe ir en ContacNeed; va en Stripe Checkout',
)

const cmsPlus = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/lib/cms-plus.ts',
  'utf8',
)
assert.match(cmsPlus, /precioMensualMxn: 499/)
assert.match(cmsPlus, /precioMensualMxn: 899/)
assert.match(cmsPlus, /precioMensualMxn: 1499/)
assert.match(cmsPlus, /precioMensualMxn: 2499/)
assert.equal(cmsPlus.includes('bronce'), false)

const route = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/routes/circulo-cms-plus.tsx',
  'utf8',
)
assert.match(route, /Círculo CMS-Plus Membresías/)
assert.match(route, /No es pirámide/)

const migration = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/supabase/migrations/016_cms_plus_membresias.sql',
  'utf8',
)
assert.match(migration, /cms_plus_creditos/)
assert.match(migration, /cms_plus_circulo/)
assert.match(migration, /producto IN \('contacneed_pro', 'cms_plus'\)/)

// Catalog module loads
const { PRODUCTOS, catalogoPublico } = await import('../netlify/functions/lib/stripe-catalog.mjs')
assert.ok(PRODUCTOS.cms_plus)
assert.equal(PRODUCTOS.cms_plus.niveles.oro.mensual.centavos, 89900)
const pub = catalogoPublico()
assert.equal(pub.cms_plus.niveles.diamante.mensual.centavos, 249900)

void require
console.log('test_cms_plus_catalog: ok')
