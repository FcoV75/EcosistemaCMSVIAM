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
    const { montoTotal, nombreProducto } = await req.json();

    if (!montoTotal || montoTotal <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine base URL dynamically
    const url = new URL(req.url);
    const origin = url.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: nombreProducto || 'Compra en Ecosistema CMS',
            },
            unit_amount: Math.round(montoTotal * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // We send them back to the home page with a success parameter to trigger the verify modal
      success_url: `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment_cancelled=true`,
    });

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
