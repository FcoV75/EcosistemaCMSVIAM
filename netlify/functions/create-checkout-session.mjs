import Stripe from 'stripe';
import { PRODUCTOS, resolverProducto } from './stripe-catalog.mjs';

function lineaSuscripcion(stripe, cfg, planTipo) {
  const esAnual = planTipo === 'anual';
  const plan = esAnual ? cfg.anual : cfg.mensual;
  const priceId = process.env[plan.envPrice];
  if (priceId) return { price: priceId, quantity: 1 };
  return {
    price_data: {
      currency: 'mxn',
      product_data: { name: plan.nombre },
      unit_amount: plan.centavos,
      recurring: { interval: esAnual ? 'year' : 'month' },
    },
    quantity: 1,
  };
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return new Response(JSON.stringify({ error: 'Stripe no configurado en Netlify.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(stripeSecret);

  try {
    const body = await req.json();
    const {
      montoTotal,
      nombreProducto,
      successUrl,
      cancelUrl,
      planTipo,
      producto: productoRaw,
      detalle = '',
    } = body;

    const producto = resolverProducto(productoRaw, planTipo);
    const cfg = PRODUCTOS[producto];
    const url = new URL(req.url);
    const origin = url.origin;

    let session;

    if (cfg.tipo === 'subscription' && (planTipo === 'mensual' || planTipo === 'anual')) {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [lineaSuscripcion(stripe, cfg, planTipo)],
        mode: 'subscription',
        success_url: successUrl || `${origin}${cfg.successPath}`,
        cancel_url: cancelUrl || `${origin}${cfg.cancelPath}`,
        metadata: { producto, plan: planTipo, detalle: detalle || producto },
      });
    } else if (cfg.tipo === 'payment' || montoTotal > 0) {
      if (!montoTotal || montoTotal <= 0) {
        return new Response(JSON.stringify({ error: 'Monto inválido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'mxn',
            product_data: { name: nombreProducto || cfg.etiqueta || 'Ecosistema CMS VIAM' },
            unit_amount: Math.round(montoTotal * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl || `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}#pago-general`,
        cancel_url: cancelUrl || `${origin}/?payment_cancelled=true`,
        metadata: {
          producto: 'ecosistema_cms_compra',
          detalle: detalle || 'cms_general',
        },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Falta plan o monto para el checkout.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: session.url, producto }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-checkout-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
