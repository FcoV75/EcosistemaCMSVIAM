import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';

export default async (req) => {
  const guard = await guardRailwayRequest(req, {
    product: 'video_diamante_premium',
    action: 'estudio',
  });
  if (guard.preflight) return guard.preflight;
  if (!guard.ok) return jsonResponse({ error: guard.error }, guard.status);

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return Response.json({ error: "GROQ_API_KEY no configurada." }, { status: 500 });

  try {
    const { tema, genero = "pop", mood = "romántico" } = await req.json();
    if (!tema?.trim()) return Response.json({ error: "Indica un tema." }, { status: 400 });

    const prompt = `Escribe la letra completa de una canción original en español latino.
Tema: ${tema}
Género: ${genero}
Estado de ánimo: ${mood}

Solo la letra, con acentos correctos, versos y estribillo, 16-28 líneas.`;

    for (const modelo of ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          temperature: 0.75,
          messages: [
            { role: "system", content: "Eres compositor latino. Solo devuelves letra de canción." },
            { role: "user", content: prompt }
          ]
        })
      });
      const d = await r.json();
      if (r.ok) {
        const letra = d.choices?.[0]?.message?.content?.trim();
        if (letra) return Response.json({ success: true, letra, modelo });
      }
    }
    return Response.json({ error: "No se pudo generar la letra." }, { status: 502 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
};
