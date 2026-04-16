import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code } = await req.json();
    if (!code || code.length < 5) {
      return Response.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const store = getStore('nexus-members');
    let memberData = await store.get(code, { type: 'json' });

    const now = Date.now();
    const msInDay = 1000 * 60 * 60 * 24;

    if (!memberData) {
      memberData = {
        startDate: now,
        durationDays: 30, // 30 days membership default
        usage: {}
      };
      await store.setJSON(code, memberData);
    }

    const elapsedMs = now - memberData.startDate;
    const elapsedDays = Math.floor(elapsedMs / msInDay);
    const daysLeft = memberData.durationDays - elapsedDays;

    if (daysLeft < 0) {
      return Response.json({ status: 'expired', daysLeft: 0 });
    } else if (daysLeft === 0) {
      return Response.json({ status: 'last_day', daysLeft: 0 });
    } else if (daysLeft <= 5) {
      return Response.json({ status: 'warning', daysLeft });
    } else {
      return Response.json({ status: 'active', daysLeft });
    }

  } catch (err) {
    console.error('Status error:', err);
    return Response.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}
