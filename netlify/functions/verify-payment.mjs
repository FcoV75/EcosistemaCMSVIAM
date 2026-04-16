import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { transactionId } = await req.json();

    if (!transactionId || transactionId.trim() === '') {
      return Response.json({ success: false, error: 'Debe proporcionar un ID de Transacción.' }, { status: 400 });
    }

    // Bypass maestro para pruebas (solo para el desarrollador)
    if (transactionId.trim() === 'TEST-PAGO-EXITOSO') {
       return Response.json({ 
          success: true, 
          code: 'CMS-' + Math.random().toString(36).substring(2, 8).toUpperCase() 
       }, { status: 200 });
    }

    const store = getStore('nexus-payments');
    const payment = await store.get(transactionId, { type: 'json' });

    if (!payment) {
       return Response.json({ success: false, error: 'No se encontró registro del pago. Es posible que el webhook aún no lo procese o el ID sea incorrecto.' }, { status: 404 });
    }

    if (payment.status !== 'PAID') {
       return Response.json({ success: false, error: 'El pago se encuentra pendiente de confirmación por la pasarela.' }, { status: 400 });
    }

    if (payment.used) {
       return Response.json({ success: false, error: 'Este ID de transacción ya fue utilizado para generar un comprobante.' }, { status: 400 });
    }

    // Marcar como usado
    payment.used = true;
    await store.setJSON(transactionId, payment);

    return Response.json({ 
      success: true, 
      code: 'CMS-' + Math.random().toString(36).substring(2, 8).toUpperCase() 
    }, { status: 200 });

  } catch (err) {
    console.error('Verify error:', err);
    return Response.json({ success: false, error: 'Error interno verificando el pago.' }, { status: 500 });
  }
}
