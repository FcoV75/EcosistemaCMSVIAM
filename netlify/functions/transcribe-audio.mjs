async function llamarGroq(audio, groqKey, modelo) {
  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "audio.wav");
  upstream.append("model", modelo);
  upstream.append("language", "es");
  upstream.append("response_format", "verbose_json");
  upstream.append("timestamp_granularities[]", "word");
  upstream.append("temperature", "0");
  upstream.append(
    "prompt",
    "Transcripción de letra de canción en español latino. Respeta acentos, tildes y puntuación exactamente."
  );

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: upstream
  });

  const data = await response.json();
  return { response, data };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return Response.json({ error: "GROQ_API_KEY no configurada." }, { status: 500 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Se requiere audio en FormData." }, { status: 400 });
    }

    const form = await req.formData();
    const audio = form.get("audio");
    if (!audio || typeof audio === "string") {
      return Response.json({ error: "Archivo de audio no recibido." }, { status: 400 });
    }

    const modelos = ["whisper-large-v3", "whisper-large-v3-turbo"];
    let ultimoError = "Sin respuesta de Groq";

    for (const modelo of modelos) {
      for (let intento = 0; intento < 3; intento++) {
        const { response, data } = await llamarGroq(audio, groqKey, modelo);
        if (response.ok) {
          return Response.json({
            success: true,
            texto: data.text || "",
            segmentos: data.segments || [],
            palabras: data.words || []
          });
        }
        ultimoError = data.error?.message || JSON.stringify(data);
        if (response.status < 500) break;
        await new Promise((r) => setTimeout(r, 1200 * (intento + 1)));
      }
    }

    return Response.json({ error: `Groq: ${ultimoError}` }, { status: 502 });
  } catch (err) {
    console.error("transcribe-audio:", err);
    return Response.json({ error: "Error interno transcribiendo audio.", detalle: String(err) }, { status: 500 });
  }
};
