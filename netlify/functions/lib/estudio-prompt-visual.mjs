/** Reescribe la escena del usuario a un prompt visual en inglés, sin perder sujetos. */

const MODELOS_GROQ_VISUAL = ['openai/gpt-oss-20b', 'llama-3.1-8b-instant', 'qwen/qwen3.6-27b'];

export function groqKeyVisual() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env?.get) {
      return Netlify.env.get('GROQ_API_KEY') || '';
    }
  } catch {
    /* ignore */
  }
  return process.env.GROQ_API_KEY || '';
}

export function reforzarSujetos(prompt) {
  const escena = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (!escena) return '';
  const partes = escena.split(/\s+y\s+/i);
  if (partes.length >= 2 && partes[0].length < 90 && partes.slice(1).join(' y ').length < 160) {
    const juntos = partes.map((p) => p.trim()).filter(Boolean);
    return `${escena}. ALL of these must be visible together in the same frame: ${juntos.join(' AND ')}. Do not omit any named subject.`;
  }
  return `${escena}. Include every named subject and setting. Do not replace the scene with only sky, clouds, or an empty landscape.`;
}

export function promptVisualFallback(prompt, modo = 'imagen') {
  const sujetos = reforzarSujetos(prompt);
  const cabeza = modo === 'clip'
    ? 'Photorealistic cinematic 16:9 film still, sharp details, lighting matching the described time of day.'
    : 'Photorealistic 16:9 photograph, sharp focus, high detail, natural professional lighting.';
  return `${cabeza} OBEY THIS SCENE EXACTLY (do not invent a different place or drop characters): ${sujetos} No text, no watermark, no logo, no letters.`;
}

function parsearExpansion(raw) {
  const texto = String(raw || '').trim();
  if (!texto) return null;
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      const promptEn = String(data.prompt_en || data.prompt || '').trim();
      if (promptEn.length > 24) {
        return {
          promptEn: promptEn.slice(0, 1200),
          resumen: String(data.resumen || '').trim().slice(0, 180),
        };
      }
    } catch {
      /* texto plano */
    }
  }
  const plano = texto.replace(/^```[\s\S]*?```/g, '').replace(/["']/g, '').trim();
  if (plano.length > 24) return { promptEn: plano.slice(0, 1200), resumen: '' };
  return null;
}

export async function expandirPromptVisual(prompt, { modo = 'imagen' } = {}) {
  const original = String(prompt || '').replace(/\s+/g, ' ').trim();
  const fallback = {
    promptEn: promptVisualFallback(original, modo),
    resumen: '',
    via: 'fallback',
  };
  const apiKey = groqKeyVisual();
  if (!apiKey || !original) return fallback;

  const tarea = modo === 'clip'
    ? 'Write an English prompt for a single cinematic film still that implies the camera move (zoom/pan/slow motion) without turning the scene into an abstract sky.'
    : 'Write an English prompt for a single photorealistic 16:9 photograph.';

  const system = `You turn a user's scene (usually Spanish) into ONE English image prompt.
Rules:
- Keep EVERY subject, place, time of day, weather and camera idea.
- If two animals or people are named, both must appear, named explicitly (example: "a deer AND a zebra, both fully visible").
- Do not replace the scene with clouds, a lone sky, or unrelated landscape.
- Start with the main subjects. 45-90 words. Photorealistic, sharp, 16:9.
- No text, watermark, logo or letters in the image.
- Reply ONLY JSON: {"prompt_en":"...","resumen":"una línea en español de lo que debe verse"}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `${tarea}\nEscena del usuario: ${original}` },
  ];

  try {
    for (const model of MODELOS_GROQ_VISUAL) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 280,
          messages,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) continue;
      const parsed = parsearExpansion(data?.choices?.[0]?.message?.content);
      if (parsed?.promptEn) {
        return { ...parsed, via: 'groq' };
      }
    }
  } catch (err) {
    console.warn('expandirPromptVisual:', err?.message || err);
  }
  return fallback;
}
