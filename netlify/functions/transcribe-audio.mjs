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

    const upstream = new FormData();
    upstream.append("file", audio, audio.name || "audio.mp3");
    upstream.append("model", "whisper-large-v3");
    upstream.append("language", "es");
    upstream.append("response_format", "json");
    upstream.append("temperature", "0");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: upstream
    });

    const data = await response.json();
    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "Error en transcripción Groq." },
        { status: response.status }
      );
    }

    return Response.json({
      success: true,
      texto: data.text || "",
    });
  } catch (err) {
    console.error("transcribe-audio:", err);
    return Response.json({ error: "Error interno transcribiendo audio." }, { status: 500 });
  }
};
