import { getStore } from '@netlify/blobs';

export default async (req) => {
  // Webhooks from Stripe/PayPal typically come as POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    
    // Identificar ID de la transacción según la pasarela
    // Stripe: payload.data.object.id o payment_intent
    // PayPal: payload.resource.id o payload.id
    const transactionId = payload.transaction_id || 
                          (payload.data && payload.data.object && (payload.data.object.payment_intent || payload.data.object.id)) || 
                          (payload.resource && payload.resource.id) || 
                          payload.id;
                          
    if (!transactionId) {
       return Response.json({ error: 'Formato de webhook no reconocido. Falta ID de transacción.' }, { status: 400 });
    }

    const store = getStore('nexus-payments');
    
    // Registrar el pago en Netlify Blobs como completado y pagado
    await store.setJSON(transactionId, {
      status: 'PAID',
      amount: payload.amount || (payload.data && payload.data.object && payload.data.object.amount_total) || 0,
      currency: payload.currency || 'MXN',
      timestamp: Date.now(),
      provider: payload.type && payload.type.startsWith('checkout.') ? 'stripe' : 'paypal_or_other',
      used: false
    });

    return Response.json({ success: true, message: 'Webhook procesado. Pago registrado exitosamente.' }, { status: 200 });

  } catch (err) {
    console.error('Webhook Error:', err);
    return Response.json({ error: 'Error procesando la petición del webhook.' }, { status: 500 });
  }
}
