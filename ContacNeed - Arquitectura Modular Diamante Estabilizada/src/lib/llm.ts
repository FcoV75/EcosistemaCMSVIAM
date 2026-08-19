type LlmOptions = {
  system?: string
  user: string
  maxSentences?: number
}

/** Reemplazos oficiales Groq tras decommission de Llama 3.3 70B / 3.1 8B (16 ago 2026). */
const GROQ_CHAT_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
] as const

export async function askLlm({ system, user, maxSentences = 6 }: LlmOptions): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    const answer = await askGroq(groqKey, system, user, maxSentences)
    if (answer) return answer
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey) {
    const answer = await askGemini(geminiKey, system, user)
    if (answer) return answer
  }

  return null
}

async function askGroq(apiKey: string, system: string | undefined, user: string, maxSentences: number) {
  const messages = [
    {
      role: 'system',
      content:
        system ??
        `Responde en español, máximo ${maxSentences} oraciones, tono cercano y profesional.`,
    },
    { role: 'user', content: user },
  ]

  for (const model of GROQ_CHAT_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 600,
          messages,
        }),
      })

      if (!response.ok) continue
      const payload = await response.json()
      const text = payload?.choices?.[0]?.message?.content
      if (text) return String(text).trim()
    } catch {
      // prueba el siguiente modelo
    }
  }

  return null
}

async function askGemini(apiKey: string, system: string | undefined, user: string) {
  try {
    const prompt = system ? `${system}\n\n${user}` : user
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (!response.ok) return null
    const payload = await response.json()
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    return text ? String(text).trim() : null
  } catch {
    return null
  }
}
