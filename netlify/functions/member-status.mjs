import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, productoRequerido } = await req.json();
    if (!code || code.length < 5) {
      return Response.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const store = getStore('nexus-members');
    const memberData = await store.get(code, { type: 'json' });

    if (!memberData) {
      return Response.json({ error: 'Código de membresía no encontrado.' }, { status: 404 });
    }

    const now = Date.now();
    const msInDay = 1000 * 60 * 60 * 24;
    const elapsedMs = now - memberData.startDate;
    const elapsedDays = Math.floor(elapsedMs / msInDay);
    const daysLeft = memberData.durationDays - elapsedDays;

    const base = { producto: memberData.producto || null, plan: memberData.plan || null, daysLeft };

    if (daysLeft < 0) {
      return Response.json({ ...base, status: 'expired', daysLeft: 0 });
    } else if (daysLeft === 0) {
      return Response.json({ ...base, status: 'last_day', daysLeft: 0 });
    } else if (daysLeft <= 5) {
      return Response.json({ ...base, status: 'warning', daysLeft });
    } else {
      return Response.json({ ...base, status: 'active', daysLeft });
    }

  } catch (err) {
    console.error('Status error:', err);
    return Response.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}
