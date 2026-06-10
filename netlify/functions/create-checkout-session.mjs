import Stripe from 'stripe';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // The secret key should be set in Netlify Environment Variables.
  // We use process.env.STRIPE_SECRET_KEY as required by security policies.
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return new Response(JSON.stringify({ error: 'Stripe is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(stripeSecret);

  try {
    const { montoTotal, nombreProducto, successUrl, cancelUrl, planTipo } = await req.json();

    const url = new URL(req.url);
    const origin = url.origin;
    const baseSuccess = successUrl || `${origin}/video_diamante.html?payment_success=true&session_id={CHECKOUT_SESSION_ID}`;
    const baseCancel = cancelUrl || `${origin}/video_diamante.html?payment_cancelled=true`;

    let session;

    if (planTipo === 'mensual' || planTipo === 'anual') {
      const esAnual = planTipo === 'anual';
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'mxn',
            product_data: {
              name: esAnual
                ? 'Video Diamante Premium — Anual (2 meses de regalo)'
                : 'Video Diamante Premium — Mensual',
              description: esAnual
                ? 'Hasta 1 hora por video, 10 renders/día. 12 meses por el precio de 10.'
                : 'Hasta 1 hora por video, 10 renders/día.',
            },
            unit_amount: esAnual ? 300000 : 30000,
            recurring: { interval: esAnual ? 'year' : 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: baseSuccess,
        cancel_url: baseCancel,
        metadata: { plan: planTipo, producto: 'video_diamante_premium' },
      });
    } else {
      if (!montoTotal || montoTotal <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'mxn',
            product_data: { name: nombreProducto || 'Compra en Ecosistema CMS' },
            unit_amount: Math.round(montoTotal * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: baseSuccess,
        cancel_url: baseCancel,
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating Stripe session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
