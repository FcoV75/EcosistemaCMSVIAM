import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'netlify/functions/create-checkout-session.mjs',
  'contacneed/netlify/functions/create-checkout-session.mjs',
  'contacneed/src/server/stripe.functions.ts',
  'contacneed/src/server/cursos-educativos.functions.ts',
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
  'contacneed/src/server/stripe.functions.ts',
  'utf8',
);
assert.match(contacneedServer, /metadata: \{ userId: user\.id, plan: data\.plan, producto: 'contacneed_pro' \}/);

console.log('test_stripe_checkout_config: ok');
