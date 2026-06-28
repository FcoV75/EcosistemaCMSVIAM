function esErrorInterno(msg) {
  return String(msg || "").toLowerCase().includes("internal error");
}

async function llamarGroq(audio, groqKey, modelo, responseFormat, extras = []) {
  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "audio.mp3");
  upstream.append("model", modelo);
  upstream.append("language", "es");
  upstream.append("response_format", responseFormat);
  upstream.append("temperature", "0");
  for (const [k, v] of extras) upstream.append(k, v);

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: upstream
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: { message: await response.text() } };
  }
  return { response, data };
}

function palabrasDesdeTexto(texto, duracion = 180) {
  const inicio = Math.min(15, duracion * 0.06);
  const fin = Math.max(duracion - 12, inicio + 1);
  const tokens = texto.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const paso = (fin - inicio) / tokens.length;
  let t = inicio;
  return tokens.map((word) => {
    const item = { start: t, end: t + paso, text: word, word };
    t += paso;
    return item;
  });
}

function segmentosDesdeTexto(texto, duracion = 180) {
  const lineas = texto.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return [];
  const inicio = Math.min(15, duracion * 0.06);
  const fin = Math.max(duracion - 12, inicio + 1);
  const paso = (fin - inicio) / lineas.length;
  let t = inicio;
  return lineas.map((text) => {
    const seg = { start: t, end: t + paso, text };
    t += paso;
    return seg;
  });
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

    const estrategias = [
      ["whisper-large-v3-turbo", "json", []],
      ["whisper-large-v3-turbo", "verbose_json", []],
      ["whisper-large-v3", "json", []],
      ["whisper-large-v3", "verbose_json", []],
      ["whisper-large-v3", "verbose_json", [["timestamp_granularities[]", "word"]]]
    ];

    let ultimoError = "Sin respuesta de Groq";

    for (const [modelo, fmt, extras] of estrategias) {
      for (let intento = 0; intento < 2; intento++) {
        const { response, data } = await llamarGroq(audio, groqKey, modelo, fmt, extras);
        if (response.ok) {
          let texto = (data.text || "").trim();
          if (!texto && fmt === "verbose_json" && Array.isArray(data.segments)) {
            texto = data.segments.map((s) => (s.text || "").trim()).filter(Boolean).join(" ");
          }
          if (!texto) {
            ultimoError = "Groq respondió vacío";
            break;
          }
          const palabras = data.words?.length ? data.words : palabrasDesdeTexto(texto);
          const segmentos = data.segments?.length ? data.segments : segmentosDesdeTexto(texto);
          return Response.json({
            success: true,
            texto,
            segmentos,
            palabras,
            fuente: `${modelo}/${fmt}`
          });
        }
        ultimoError = data.error?.message || JSON.stringify(data);
        if (!esErrorInterno(ultimoError) && response.status < 500) break;
        await new Promise((r) => setTimeout(r, 1200 * (intento + 1)));
      }
    }

    return Response.json({ error: `Transcripción fallida: ${ultimoError}` }, { status: 502 });
  } catch (err) {
    console.error("transcribe-audio:", err);
    return Response.json({ error: "Error interno transcribiendo audio.", detalle: String(err) }, { status: 500 });
  }
};
