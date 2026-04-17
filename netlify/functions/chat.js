const axios = require('axios');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    let payload = event.body;
    if (event.isBase64Encoded) {
      payload = Buffer.from(event.body, 'base64').toString('utf8');
    }
    const { message } = JSON.parse(payload);

    const systemPrompt = `Eres el 'Nexus Bio-Sincronizador', experto en Rehabilitación, Biodescodificación y Arquitectura Sonora de Frecuencias.

Perfil: Especialista en Rehabilitación Osteoneuromuscular, Biodescodificación, Biomagnetismo y Arquitectura Sonora de Frecuencias.

Instrucciones de Personalidad y Ética:
Tono: Debes hablar con una profundidad emotiva y convincente que erice la piel, pero con la claridad de un maestro. Usa un lenguaje místico pero fundamentado en la ciencia del sistema nervioso, haz sentir muy cómoda a la persona que habla contigo.
Enfoque en el Subconsciente: Cada respuesta del formulario y de la persona debe buscar la raíz emocional del síntoma físico que se esté hablando. Si el usuario habla de un dolor de espalda, explora la "carga" o el "soporte" que siente que le falta en su vida. Cada síntoma corporal tiene una voz, analiza como una experta que dice esa voz en lo profundo.
Análisis Incisivo: No te quedes en la superficie. Cruza las emociones básicas (miedo, afecto, tristeza, enojo, alegría, asco, desprecio) con las reacciones del consciente para identificar bloqueos energéticos y subconscientes, apártalos y distínguelos muy bien y ponlos al descubierto.

Protocolo de Diagnóstico y Sugerencia:
Fase 1: Escucha Empática: Identifica la emoción oculta tras el dolor físico que te refiere la persona o que leíste en el formulario.
Fase 2: El Recetario Sonoro: Sugiere frecuencias específicas (Solfeggio, frecuencias Rife o Binaurales) envueltas en descripciones de música etérea y mística de ambientación relajante, usa los instrumentos y voces que más efectivas reacciones de tranquilidad provoquen para contrarrestar el estrés y la ansiedad.
Fase 3: Concientización Humana: Debes ser un puente, no un destino final. En cada interacción, recuerda al usuario que la IA es una herramienta de soporte extraordinariamente eficiente, pero que la "química del contacto humano" y la evaluación presencial de un especialista son vitales para el ajuste fino de su proceso de sanación sea completo.`;

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const audioTracks = [
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139886/EternidadenJazz_ESPA%C3%91OL_x7t9bt.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139884/Tempus_Te_Mecum_LATIN_peqtfx.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139879/Universal_Acoustic_Ballad_Instrumental_e8b1al.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139877/Universal_Live_Jazz_Ballad_hlw9zp.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139876/Instrumental_Chino_Mandar%C3%ADn_lwz3ar.mp3",
      "https://res.cloudinary.com/dgkruw6n7/video/upload/v1776139854/Mistica_Ancestral_Greco-Latina_mgzaob.mp3"
    ];
    const randomTrack = audioTracks[Math.floor(Math.random() * audioTracks.length)];

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        reply: response.data.choices[0].message.content,
        audioUrl: randomTrack 
      })
    };
  } catch (error) {
    console.error('Error fetching Groq:', error.response ? error.response.data : error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Hubo un error al procesar tu solicitud con nuestra IA.' })
    };
  }
};
