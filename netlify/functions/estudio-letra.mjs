import { guardRailwayRequest, jsonResponse } from './lib/railway-guard.mjs';

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function planDiscurso(duracionSeg) {
  const seg = clamp(duracionSeg, 8, 3600);
  const palabras = Math.round((seg / 60) * 135);
  if (seg <= 45) {
    return {
      seg,
      palabras: Math.max(40, Math.min(90, palabras)),
      maxTokens: 700,
      guia: `Discurso MUY CORTO (~${seg} s, unas ${Math.max(40, Math.min(90, palabras))} palabras). Un gancho, el beneficio y un cierre con llamada a la acción. Un solo bloque, para hablarlo seguido.`,
    };
  }
  if (seg <= 240) {
    return {
      seg,
      palabras: Math.max(90, Math.min(650, palabras)),
      maxTokens: 1800,
      guia: `Discurso de ~${seg} segundos (unas ${Math.max(90, Math.min(650, palabras))} palabras). Estructura: saludo, problema, solución/producto, prueba o ejemplo, cierre con llamada a la acción. Párrafos cortos, orales, sin versos.`,
    };
  }
  return {
    seg,
    palabras: Math.min(2200, Math.max(650, palabras)),
    maxTokens: 3500,
    guia: `Guion hablado para un video de ${Math.round(seg / 60)} min. Escribe completo el arranque (primeros 3–4 minutos, ~450-600 palabras) y luego secciones numeradas con tiempo aproximado y puntos para desarrollar el resto hasta ${seg} s. No es una canción.`,
  };
}

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
    const body = await req.json();
    const tema = String(body.tema || body.prompt || "").trim();
    const tono = String(body.tono || body.mood || body.genero || "cercano").trim();
    const duracionSeg = clamp(body.duracionSeg ?? body.duracion ?? 30, 8, 3600);
    if (!tema) return Response.json({ error: "Indica el producto o el tema del discurso." }, { status: 400 });

    const plan = planDiscurso(duracionSeg);
    const prompt = `Escribe un DISCURSO o texto hablado original en español latino (México), NO una letra de canción.
Tema o producto: ${tema}
Tono: ${tono}
Duración objetivo: ${plan.seg} segundos.
${plan.guia}

Reglas:
- Para presentarlo en voz alta frente a cámara o como locución del video.
- Frases orales, claras, con acentos correctos.
- Sin estribillos, sin coros, sin estructura verso/verso.
- Sin títulos tipo "Estrofa 1".
- Cierra con una llamada a la acción concreta.`;

    for (const modelo of ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          temperature: 0.65,
          max_tokens: plan.maxTokens,
          messages: [
            { role: "system", content: "Eres locutor y copywriter de video. Solo devuelves discurso o texto hablado, nunca letra de canción." },
            { role: "user", content: prompt }
          ]
        })
      });
      const d = await r.json();
      if (r.ok) {
        const letra = d.choices?.[0]?.message?.content?.trim();
        if (letra) {
          return Response.json({
            success: true,
            letra,
            discurso: letra,
            modelo,
            duracionSeg: plan.seg,
            tipo: "discurso",
          });
        }
      }
    }
    return Response.json({ error: "No se pudo generar el discurso." }, { status: 502 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
};
