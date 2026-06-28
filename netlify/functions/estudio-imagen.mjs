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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const { prompt } = await req.json();
    if (!prompt?.trim()) return Response.json({ error: "Describe la imagen." }, { status: 400 });

    const promptEn = `${prompt.trim()}, cinematic, high quality, 16:9, no text, no watermark`;
    const seed = Math.abs([...promptEn].reduce((a, c) => a + c.charCodeAt(0), 0)) % 99999;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptEn)}?width=1280&height=720&nologo=true&seed=${seed}`;

    const img = await fetch(url);
    if (!img.ok) return Response.json({ error: "Fallo al generar imagen." }, { status: 502 });

    const buf = await img.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return Response.json({
      success: true,
      imagen_base64: b64,
      mime: img.headers.get("content-type") || "image/jpeg",
      fuente: "pollinations"
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
};
