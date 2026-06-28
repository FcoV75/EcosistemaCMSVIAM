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

function openBlobStore(name) {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  if (siteID && token) {
    return getStore(name, { siteID, token });
  }
  return getStore(name);
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

function pagoDesdeSession(session) {
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
    checkoutSessionId: session.id,
  };
}

async function recuperarDesdePaymentIntent(stripe, id) {
  const pi = await stripe.paymentIntents.retrieve(id);
  if (pi.status !== 'succeeded') {
    return {
      pendiente: true,
      error: `El pago está en estado "${pi.status}". Si acabas de pagar, espera 1–2 minutos.`,
    };
  }

  const sessions = await stripe.checkout.sessions.list({ payment_intent: id, limit: 1 });
  if (sessions.data?.length) {
    const session = sessions.data[0];
    if (sesionPagada(session)) {
      return pagoDesdeSession(session);
    }
  }

  const amount = pi.amount;
  const metadata = pi.metadata || {};
  let producto = metadata.producto || null;
  let plan = metadata.plan || null;
  if (!producto && amount != null && MONTOS_VIDEO_DIAMANTE.has(amount)) {
    producto = 'video_diamante_premium';
    plan = amount >= 100000 ? 'anual' : 'mensual';
  }

  return {
    status: 'PAID',
    amount,
    currency: (pi.currency || 'mxn').toUpperCase(),
    timestamp: Date.now(),
    provider: 'stripe',
    producto: producto || 'ecosistema_cms_compra',
    plan,
    detalle: metadata.detalle || null,
    used: false,
    paymentIntentId: id,
  };
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

  const esLiveRef = id.startsWith('cs_live_') || id.startsWith('pi_') && !id.includes('_test_');
  if (esLiveRef && stripeSecret.startsWith('sk_test_')) {
    return {
      fail: true,
      error: 'Tu pago es real pero Netlify tiene clave de prueba (sk_test_). Debe ser sk_live_.',
    };
  }

  const stripe = new Stripe(stripeSecret);

  if (id.startsWith('pi_')) {
    try {
      return await recuperarDesdePaymentIntent(stripe, id);
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('Stripe PI retrieve failed:', msg);
      return {
        fail: true,
        error: /no such payment_intent/i.test(msg)
          ? 'Stripe no encuentra ese Payment Intent (pi_...). Cópialo desde Pagos en el Dashboard.'
          : `No se pudo consultar Stripe: ${msg}`,
      };
    }
  }

  if (!id.startsWith('cs_')) {
    return {
      fail: true,
      error: 'Usa el ID de Checkout (cs_live_...) o el Payment Intent (pi_...) que ves en Stripe → Pagos.',
    };
  }

  if (id.startsWith('cs_test_') && stripeSecret.startsWith('sk_live_')) {
    return {
      fail: true,
      error: 'El ID es de prueba (cs_test_) pero la clave en Netlify es live (sk_live_).',
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items'],
    });

    if (!sesionPagada(session)) {
      return {
        pendiente: true,
        error: `Stripe aún no marca el pago como completado (estado: ${session.status}, pago: ${session.payment_status}). Espera 2 minutos e intenta de nuevo.`,
      };
    }

    return pagoDesdeSession(session);
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('Stripe retrieve failed:', msg);
    if (/no such checkout/i.test(msg)) {
      return {
        fail: true,
        error: 'Stripe no encuentra esa sesión cs_live_. Copia el ID exacto desde Workbench (ojo: la letra "l" vs el número "1"). También puedes pegar el pi_... del pago.',
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
    let store;
    let membersStore;
    try {
      store = openBlobStore('nexus-payments');
      membersStore = openBlobStore('nexus-members');
    } catch (blobErr) {
      console.error('Blob store init:', blobErr);
      return Response.json({
        success: false,
        error: 'Almacén Netlify Blobs no disponible. En Netlify activa Blobs y/o define SITE_ID + NETLIFY_AUTH_TOKEN.',
        detalle: blobErr.message,
      }, { status: 503 });
    }

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
    return Response.json({
      success: false,
      error: 'Error interno verificando el pago.',
      detalle: err?.message || String(err),
    }, { status: 500 });
  }
};
