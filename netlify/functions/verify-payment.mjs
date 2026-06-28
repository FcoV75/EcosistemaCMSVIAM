import { getStore } from '@netlify/blobs';
import Stripe from 'stripe';

const PRODUCTOS_VIDEO_DIAMANTE = new Set(['video_diamante_premium']);

function duracionDias(plan, producto) {
  if (plan === 'anual') return 365;
  if (plan === 'mensual') return 30;
  if (producto === 'sincronia_nexus') return 30;
  if (producto === 'video_diamante_premium') return 30;
  return 30;
}

async function recuperarPagoDesdeStripe(transactionId) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const id = transactionId.trim();
  if (!stripeSecret || !id.startsWith('cs_')) {
    return null;
  }

  const stripe = new Stripe(stripeSecret);
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const pagado = session.payment_status === 'paid' || session.status === 'complete';
    if (!pagado) {
      return { pendiente: true };
    }

    const metadata = session.metadata || {};
    return {
      status: 'PAID',
      amount: session.amount_total,
      currency: (session.currency || 'mxn').toUpperCase(),
      timestamp: Date.now(),
      provider: 'stripe',
      producto: metadata.producto || 'ecosistema_cms_compra',
      plan: metadata.plan || null,
      detalle: metadata.detalle || null,
      used: false,
    };
  } catch (err) {
    console.error('Stripe retrieve failed:', err.message);
    return null;
  }
}

async function emitirLicencia(store, membersStore, transactionId, payment) {
  const producto = payment.producto || 'ecosistema_cms_compra';
  const plan = payment.plan || null;
  const generatedCode = 'CMS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const durationDays = duracionDias(plan, producto);

  await membersStore.setJSON(generatedCode, {
    startDate: Date.now(),
    durationDays,
    producto,
    plan,
    transactionId: transactionId.trim(),
    usage: {},
  });

  payment.used = true;
  payment.issuedCode = generatedCode;
  await store.setJSON(transactionId.trim(), payment);

  return {
    success: true,
    code: generatedCode,
    producto,
    plan,
    durationDays,
    esVideoDiamante: PRODUCTOS_VIDEO_DIAMANTE.has(producto),
  };
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

    const id = transactionId.trim();
    const store = getStore('nexus-payments');
    const membersStore = getStore('nexus-members');
    let payment = await store.get(id, { type: 'json' });

    if (!payment) {
      const desdeStripe = await recuperarPagoDesdeStripe(id);
      if (desdeStripe?.pendiente) {
        return Response.json({
          success: false,
          error: 'Stripe aún está procesando el pago. Espera 1–2 minutos e intenta de nuevo.',
        }, { status: 400 });
      }
      if (!desdeStripe) {
        return Response.json({
          success: false,
          error: 'No se encontró registro del pago. Verifica el ID (cs_live_...) o contacta soporte si ya pagaste.',
        }, { status: 404 });
      }
      payment = desdeStripe;
      await store.setJSON(id, payment);
    }

    if (payment.status !== 'PAID') {
      return Response.json({ success: false, error: 'El pago se encuentra pendiente de confirmación por la pasarela.' }, { status: 400 });
    }

    const producto = payment.producto || 'ecosistema_cms_compra';
    const plan = payment.plan || null;

    if (productoRequerido && producto !== productoRequerido) {
      return Response.json({
        success: false,
        error: `Este pago corresponde a "${producto}", no a "${productoRequerido}". Usa el ID de la compra correcta.`,
      }, { status: 400 });
    }

    if (payment.used) {
      if (payment.issuedCode) {
        const existente = await membersStore.get(payment.issuedCode, { type: 'json' });
        if (existente) {
          return Response.json({
            success: true,
            code: payment.issuedCode,
            producto,
            plan,
            durationDays: duracionDias(plan, producto),
            esVideoDiamante: PRODUCTOS_VIDEO_DIAMANTE.has(producto),
            reutilizado: true,
          }, { status: 200 });
        }
      }
      return Response.json({ success: false, error: 'Este ID de transacción ya fue utilizado para generar un comprobante.' }, { status: 400 });
    }

    const resultado = await emitirLicencia(store, membersStore, id, payment);
    return Response.json(resultado, { status: 200 });

  } catch (err) {
    console.error('Verify error:', err);
    return Response.json({ success: false, error: 'Error interno verificando el pago.' }, { status: 500 });
  }
};
