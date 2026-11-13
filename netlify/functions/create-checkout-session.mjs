import Stripe from 'stripe';
import { PRODUCTOS, resolverProducto } from './lib/stripe-catalog.mjs';
import { getUserFromBearer } from './lib/supabase-admin.mjs';

const GRACIAS_PAGO_IMG =
  process.env.CMS_CHECKOUT_IMAGE_URL ||
  'https://centromultidisciplinarioags.com/Assets/Images/Gracias_Pago_CMS.png';

function metadataBase(req, extra = {}) {
  const meta = { ...extra };
  return getUserFromBearer(req).then((user) => {
    if (user?.id) {
      meta.userId = user.id;
      if (user.email) meta.userEmail = user.email;
    }
    return meta;
  });
}

async function syncProductImage(stripe, priceId) {
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product;
    if (!product || typeof product === 'string' || product.deleted) return;
    if (Array.isArray(product.images) && product.images[0] === GRACIAS_PAGO_IMG) return;
    await stripe.products.update(product.id, { images: [GRACIAS_PAGO_IMG] });
  } catch (err) {
    console.warn('checkout image sync:', err?.message || err);
  }
}

function lineaSuscripcion(stripe, cfg, planTipo) {
  const esAnual = planTipo === 'anual';
  const plan = esAnual ? cfg.anual : cfg.mensual;
  const priceId = process.env[plan.envPrice];
  // Preferimos price_data con imagen para que Checkout nunca muestre el hueco
  // en blanco (consultas/libros/Nexus). Si hay Price ID, sincronizamos la imagen
  // del Product y aún así usamos price_data con el mismo monto/nombre.
  if (priceId) {
    return {
      price_data: {
        currency: 'mxn',
        product_data: {
          name: plan.nombre,
          images: [GRACIAS_PAGO_IMG],
        },
        unit_amount: plan.centavos,
        recurring: { interval: esAnual ? 'year' : 'month' },
      },
      quantity: 1,
      _priceId: priceId,
    };
  }
  return {
    price_data: {
      currency: 'mxn',
      product_data: {
        name: plan.nombre,
        images: [GRACIAS_PAGO_IMG],
      },
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
      const metadata = await metadataBase(req, { producto, plan: planTipo, detalle: detalle || producto });
      const lineItem = lineaSuscripcion(stripe, cfg, planTipo);
      if (lineItem._priceId) {
        await syncProductImage(stripe, lineItem._priceId);
        delete lineItem._priceId;
      }
      session = await stripe.checkout.sessions.create({
        line_items: [lineItem],
        mode: 'subscription',
        success_url: successUrl || `${origin}${cfg.successPath}`,
        cancel_url: cancelUrl || `${origin}${cfg.cancelPath}`,
        metadata,
      });
    } else if (cfg.tipo === 'payment' || montoTotal > 0) {
      if (!montoTotal || montoTotal <= 0) {
        return new Response(JSON.stringify({ error: 'Monto inválido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const metadata = await metadataBase(req, {
        producto: 'ecosistema_cms_compra',
        detalle: detalle || 'cms_general',
      });
      session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'mxn',
            product_data: {
              name: nombreProducto || cfg.etiqueta || 'Ecosistema CMS VIAM',
              images: [GRACIAS_PAGO_IMG],
            },
            unit_amount: Math.round(montoTotal * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl || `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}#pago-general`,
        cancel_url: cancelUrl || `${origin}/?payment_cancelled=true`,
        metadata,
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
