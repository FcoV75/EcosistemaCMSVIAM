import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { code, message } = await req.json();

    if (!code || !message) {
      return Response.json({ error: 'Faltan datos (código o mensaje).' }, { status: 400 });
    }

    const store = getStore('nexus-members');
    let memberData = await store.get(code, { type: 'json' });

    if (!memberData) {
      return Response.json({ error: 'Membresía no encontrada.' }, { status: 404 });
    }

    // Check membership expiration
    const now = Date.now();
    const msInDay = 1000 * 60 * 60 * 24;
    const elapsedDays = Math.floor((now - memberData.startDate) / msInDay);
    const daysLeft = memberData.durationDays - elapsedDays;

    if (daysLeft < 0) {
      return Response.json({ error: 'Membresía expirada.' }, { status: 403 });
    }

    // Check daily usage limits
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (!memberData.usage) memberData.usage = {};
    const usageToday = memberData.usage[today] || 0;

    if (usageToday >= 3) {
      return Response.json({ 
        error: 'Has alcanzado el límite de 3 intervenciones diarias. Por favor, toma el tiempo necesario para acatar y practicar los consejos otorgados antes de solicitar uno nuevo.'
      }, { status: 429 });
    }

    // Prepare Groq API Call
    const systemPrompt = `Eres el 'Santuario Sincronía NEXUS', el Consejero Cuántico Avanzado con IA Groq.
Perfil: Especialista avanzado en biodescodificación, bienestar emocional y frecuencias sonoras curativas.

Instrucciones:
1. Tono y Personalidad: Empático, cálido, místico pero aterrizado. Debes hablarle al usuario haciéndolo sentir en un espacio completamente seguro y de sanación profunda.
2. Análisis: El usuario te planteará su situación. Analiza la posible raíz emocional profunda, el síntoma o el bloqueo.
3. Consejo y Acción: Otorga un consejo claro, práctico y profundo. Hazle entender que para ver una mejoría franca debe aplicar y acatar el consejo con disciplina y paciencia.
4. Frecuencia Musical: Menciona que a continuación escuchará una pista musical con frecuencias curativas que le acompañará durante su meditación o reflexión, invitándolo a sumergirse en ella.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Netlify.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error('Groq Error:', aiData);
      return Response.json({ error: 'Error al contactar a la Inteligencia Artificial.' }, { status: 500 });
    }

    const reply = aiData.choices[0].message.content;

    // Track array for members
    const audioTracks = [
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139886/EternidadenJazz_ESPA%C3%91OL_x7t9bt.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139884/Tempus_Te_Mecum_LATIN_peqtfx.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139879/Universal_Acoustic_Ballad_Instrumental_e8b1al.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139877/Universal_Live_Jazz_Ballad_hlw9zp.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139876/Instrumental_Chino_Mandar%C3%ADn_lwz3ar.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139854/Mistica_Ancestral_Greco-Latina_mgzaob.mp3"
    ];
    const randomTrack = audioTracks[Math.floor(Math.random() * audioTracks.length)];

    // Increment usage
    memberData.usage[today] = usageToday + 1;
    await store.setJSON(code, memberData);

    return Response.json({
      reply,
      audioUrl: randomTrack
    });

  } catch (err) {
    console.error('Chat error:', err);
    return Response.json({ error: 'Ocurrió un error interno.' }, { status: 500 });
  }
}
