import { getStore } from '@netlify/blobs';
import Stripe from 'stripe';

const PRODUCTOS_VIDEO_DIAMANTE = new Set(['video_diamante_premium']);
const MONTOS_VIDEO_DIAMANTE = new Set([30000, 300000]);

function stripeSecretKey() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env?.get) {
      const v = Netlify.env.get('STRIPE_SECRET_KEY');
      if (v) return String(v).trim();
    }
  } catch {
    /* ignore */
  }
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function duracionDias(plan, producto) {
  if (plan === 'anual') return 365;
  if (plan === 'mensual') return 30;
  if (producto === 'sincronia_nexus') return 30;
  if (producto === 'video_diamante_premium') return 30;
  return 30;
}

function inferirProductoDesdeSesion(session) {
  const metadata = session.metadata || {};
  if (metadata.producto) {
    return { producto: metadata.producto, plan: metadata.plan || null };
  }

  const items = session.line_items?.data || [];
  const textoItems = items
    .map((i) => `${i.description || ''} ${i.price?.nickname || ''}`.toLowerCase())
    .join(' ');

  const amount = session.amount_total ?? items[0]?.amount_total ?? null;

  if (/video diamante/i.test(textoItems) || (amount != null && MONTOS_VIDEO_DIAMANTE.has(amount))) {
    return {
      producto: 'video_diamante_premium',
      plan: amount != null && amount >= 100000 ? 'anual' : 'mensual',
    };
  }
  if (/sincron[ií]a nexus/i.test(textoItems)) {
    return { producto: 'sincronia_nexus', plan: amount != null && amount >= 100000 ? 'anual' : 'mensual' };
  }
  return { producto: null, plan: null };
}

function sesionPagada(session) {
  if (session.payment_status === 'paid') return true;
  if (session.status === 'complete') return true;
  if (session.mode === 'subscription' && session.status === 'complete') {
    return session.payment_status !== 'unpaid';
  }
  return false;
}

async function recuperarPagoDesdeStripe(transactionId) {
  const stripeSecret = stripeSecretKey();
  const id = transactionId.trim();

  if (!stripeSecret) {
    return {
      fail: true,
      error: 'Stripe no está configurado en Netlify (falta STRIPE_SECRET_KEY). Contacta al administrador del sitio.',
    };
  }

  if (!id.startsWith('cs_')) {
    return {
      fail: true,
      error: 'El ID debe ser de Stripe Checkout (cs_live_... o cs_test_...).',
    };
  }

  const esLive = id.startsWith('cs_live_');
  if (esLive && stripeSecret.startsWith('sk_test_')) {
    return {
      fail: true,
      error: 'Tu pago es real (cs_live_) pero Netlify tiene clave de prueba (sk_test_). Debe configurarse sk_live_ en Netlify → Environment variables.',
    };
  }
  if (id.startsWith('cs_test_') && stripeSecret.startsWith('sk_live_')) {
    return {
      fail: true,
      error: 'El ID es de prueba (cs_test_) pero la clave en Netlify es live (sk_live_).',
    };
  }

  const stripe = new Stripe(stripeSecret);
  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items.data.price'],
    });

    if (!sesionPagada(session)) {
      return {
        pendiente: true,
        error: `Stripe aún no marca el pago como completado (estado: ${session.status}, pago: ${session.payment_status}). Espera 2 minutos e intenta de nuevo.`,
      };
    }

    const inferido = inferirProductoDesdeSesion(session);
    const metadata = session.metadata || {};
    const producto = inferido.producto || metadata.producto || 'ecosistema_cms_compra';
    const plan = inferido.plan || metadata.plan || null;

    return {
      status: 'PAID',
      amount: session.amount_total,
      currency: (session.currency || 'mxn').toUpperCase(),
      timestamp: Date.now(),
      provider: 'stripe',
      producto,
      plan,
      detalle: metadata.detalle || null,
      used: false,
      customerEmail: session.customer_details?.email || session.customer_email || null,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('Stripe retrieve failed:', msg);
    if (/no such checkout/i.test(msg)) {
      return {
        fail: true,
        error: 'Stripe no encuentra esa sesión. Verifica que copiaste el ID completo y que STRIPE_SECRET_KEY en Netlify sea sk_live_ de la misma cuenta donde pagaste.',
      };
    }
    return {
      fail: true,
      error: `No se pudo consultar Stripe: ${msg}`,
    };
  }
}

function productoCoincide(payment, productoRequerido) {
  const producto = payment.producto || 'ecosistema_cms_compra';
  if (!productoRequerido || producto === productoRequerido) return producto;

  if (
    productoRequerido === 'video_diamante_premium'
    && payment.amount != null
    && MONTOS_VIDEO_DIAMANTE.has(payment.amount)
  ) {
    payment.producto = 'video_diamante_premium';
    if (!payment.plan) {
      payment.plan = payment.amount >= 100000 ? 'anual' : 'mensual';
    }
    return 'video_diamante_premium';
  }

  return null;
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
        return Response.json({ success: false, error: desdeStripe.error }, { status: 400 });
      }
      if (desdeStripe?.fail || !desdeStripe?.status) {
        return Response.json({
          success: false,
          error: desdeStripe?.error || 'No se encontró registro del pago. Verifica el ID o contacta soporte.',
        }, { status: 404 });
      }
      payment = desdeStripe;
      await store.setJSON(id, payment);
    }

    if (payment.status !== 'PAID') {
      return Response.json({ success: false, error: 'El pago se encuentra pendiente de confirmación por la pasarela.' }, { status: 400 });
    }

    const productoOk = productoCoincide(payment, productoRequerido);
    if (productoRequerido && !productoOk) {
      return Response.json({
        success: false,
        error: `Este pago corresponde a "${payment.producto}", no a "${productoRequerido}". Usa el ID de la compra correcta.`,
      }, { status: 400 });
    }

    if (payment.used) {
      if (payment.issuedCode) {
        const existente = await membersStore.get(payment.issuedCode, { type: 'json' });
        if (existente) {
          return Response.json({
            success: true,
            code: payment.issuedCode,
            producto: payment.producto,
            plan: payment.plan,
            durationDays: duracionDias(payment.plan, payment.producto),
            esVideoDiamante: PRODUCTOS_VIDEO_DIAMANTE.has(payment.producto),
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
