import { getStore } from '@netlify/blobs';

const PRODUCTOS_VIDEO_DIAMANTE = new Set(['video_diamante_premium']);

function duracionDias(plan, producto) {
  if (plan === 'anual') return 365;
  if (plan === 'mensual') return 30;
  if (producto === 'sincronia_nexus') return 30;
  if (producto === 'video_diamante_premium') return 30;
  return 30;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { transactionId, productoRequerido } = await req.json();

    if (!transactionId || transactionId.trim() === '') {
      return Response.json({ success: false, error: 'Debe proporcionar un ID de Transacción.' }, { status: 400 });
    }

    const store = getStore('nexus-payments');
    const payment = await store.get(transactionId.trim(), { type: 'json' });

    if (!payment) {
      return Response.json({
        success: false,
        error: 'No se encontró registro del pago. Es posible que el webhook aún no lo procese o el ID sea incorrecto.'
      }, { status: 404 });
    }

    if (payment.status !== 'PAID') {
      return Response.json({ success: false, error: 'El pago se encuentra pendiente de confirmación por la pasarela.' }, { status: 400 });
    }

    const producto = payment.producto || 'ecosistema_cms_compra';
    const plan = payment.plan || null;

    if (productoRequerido && producto !== productoRequerido) {
      return Response.json({
        success: false,
        error: `Este pago corresponde a "${producto}", no a "${productoRequerido}". Usa el ID de la compra correcta.`
      }, { status: 400 });
    }

    if (payment.used) {
      return Response.json({ success: false, error: 'Este ID de transacción ya fue utilizado para generar un comprobante.' }, { status: 400 });
    }

    const generatedCode = 'CMS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const durationDays = duracionDias(plan, producto);

    const membersStore = getStore('nexus-members');
    await membersStore.setJSON(generatedCode, {
      startDate: Date.now(),
      durationDays,
      producto,
      plan,
      transactionId: transactionId.trim(),
      usage: {}
    });

    payment.used = true;
    payment.issuedCode = generatedCode;
    await store.setJSON(transactionId.trim(), payment);

    return Response.json({
      success: true,
      code: generatedCode,
      producto,
      plan,
      durationDays,
      esVideoDiamante: PRODUCTOS_VIDEO_DIAMANTE.has(producto)
    }, { status: 200 });

  } catch (err) {
    console.error('Verify error:', err);
    return Response.json({ success: false, error: 'Error interno verificando el pago.' }, { status: 500 });
  }
};
