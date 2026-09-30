import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'netlify/functions/create-checkout-session.mjs',
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/netlify/functions/create-checkout-session.mjs',
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/stripe.functions.ts',
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/cursos-educativos.functions.ts',
];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  assert.equal(
    src.includes('payment_method_types'),
    false,
    `${file} no debe fijar payment_method_types; Stripe debe usar metodos dinamicos`,
  );
}

const cmsCheckout = fs.readFileSync('netlify/functions/create-checkout-session.mjs', 'utf8');
assert.match(cmsCheckout, /metadataBase\(req, \{ producto, plan: planTipo/);
assert.match(cmsCheckout, /producto: 'ecosistema_cms_compra'/);

const contacneedServer = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/stripe.functions.ts',
  'utf8',
);
assert.match(contacneedServer, /metadata: \{ userId: user\.id, plan: data\.plan, producto: 'contacneed_pro' \}/);

console.log('test_stripe_checkout_config: ok');
