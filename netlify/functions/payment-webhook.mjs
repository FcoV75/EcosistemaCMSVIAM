import { getStore } from '@netlify/blobs';
import Stripe from 'stripe';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const sig = req.headers.get('stripe-signature');
    let payload;
    let provider = 'unknown';
    let transactionId;
    let amount = 0;

    // Optional: If Stripe Webhook Secret is present, verify the signature.
    // If it's a Stripe webhook, it should always have 'stripe-signature' header.
    if (sig) {
      provider = 'stripe';
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeSecret) {
         console.error('Missing STRIPE_SECRET_KEY');
         return new Response('Webhook Error: Missing stripe configuration', { status: 500 });
      }
      
      const stripe = new Stripe(stripeSecret);
      
      if (endpointSecret) {
        try {
          payload = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
        } catch (err) {
          console.error(`Webhook signature verification failed:`, err.message);
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }
      } else {
         // Fallback if secret is not set but signature exists (not recommended for production)
         payload = JSON.parse(rawBody);
      }
      
      // We only care about successful checkouts for now
      if (payload.type === 'checkout.session.completed') {
        const session = payload.data.object;
        // In verify-payment the user might enter the checkout session id (cs_test_...)
        transactionId = session.id;
        amount = session.amount_total;
      } else {
        // Unhandled Stripe event
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' }});
      }

    } else {
      // It might be a PayPal webhook or raw test
      provider = 'paypal_or_other';
      payload = JSON.parse(rawBody);
      transactionId = payload.transaction_id || 
                      (payload.data && payload.data.object && (payload.data.object.payment_intent || payload.data.object.id)) || 
                      (payload.resource && payload.resource.id) || 
                      payload.id;
      amount = payload.amount || (payload.data && payload.data.object && payload.data.object.amount_total) || 0;
    }
                          
    if (!transactionId) {
       return new Response(JSON.stringify({ error: 'Formato de webhook no reconocido. Falta ID de transacción.' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    const store = getStore('nexus-payments');
    
    // Registrar el pago en Netlify Blobs como completado y pagado
    await store.setJSON(transactionId, {
      status: 'PAID',
      amount: amount,
      currency: 'MXN',
      timestamp: Date.now(),
      provider: provider,
      used: false
    });

    return new Response(JSON.stringify({ success: true, message: 'Webhook procesado. Pago registrado exitosamente.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response(JSON.stringify({ error: 'Error procesando la petición del webhook.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
