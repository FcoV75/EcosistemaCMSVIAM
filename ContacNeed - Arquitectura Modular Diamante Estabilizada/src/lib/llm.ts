type LlmOptions = {
  system?: string
  user: string
  maxSentences?: number
  maxTokens?: number
}

/** Reemplazos oficiales Groq tras decommission de Llama 3.3 70B / 3.1 8B (16 ago 2026). */
const GROQ_CHAT_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
] as const
const GEMINI_TEXT_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash'] as const
const LLM_TIMEOUT_MS = 18_000

function configuredModels(envValue: string | undefined, defaults: readonly string[]) {
  const fromEnv = String(envValue ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
  return [...new Set([...fromEnv, ...defaults])]
}

function retryMsFromProvider(status: number, payload: unknown) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})
  const match = raw.match(/try again in\s+(\d+(?:\.\d+)?)s/i)
  if (match) return Math.ceil(Number(match[1]) * 1000)
  if (status === 429 || /rate limit|too many requests/i.test(raw)) return 6500
  return 0
}

export async function askLlm({
  system,
  user,
  maxSentences = 6,
  maxTokens = 600,
}: LlmOptions): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    const answer = await askGroq(groqKey, system, user, maxSentences, maxTokens)
    if (answer) return answer
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey) {
    const answer = await askGemini(geminiKey, system, user)
    if (answer) return answer
  }

  return null
}

async function askGroq(
  apiKey: string,
  system: string | undefined,
  user: string,
  maxSentences: number,
  maxTokens: number,
) {
  const messages = [
    {
      role: 'system',
      content:
        system ??
        `Responde en español, máximo ${maxSentences} oraciones, tono cercano y profesional.`,
    },
    { role: 'user', content: user },
  ]

  for (const model of configuredModels(process.env.GROQ_CHAT_MODELS ?? process.env.GROQ_NEXUS_MODELS, GROQ_CHAT_MODELS)) {
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            max_tokens: maxTokens,
            messages,
          }),
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const wait = retryMsFromProvider(response.status, payload)
          if (wait && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 9000)))
            continue
          }
          break
        }

        const text = payload?.choices?.[0]?.message?.content
        if (text) return String(text).trim()
        break
      }
    } catch {
      // prueba el siguiente modelo
    }
  }

  return null
}

async function askGemini(apiKey: string, system: string | undefined, user: string) {
  const prompt = system ? `${system}\n\n${user}` : user
  for (const model of configuredModels(process.env.GEMINI_TEXT_MODELS ?? process.env.GEMINI_TEXT_MODEL, GEMINI_TEXT_MODELS)) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        },
      )

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const wait = retryMsFromProvider(response.status, payload)
        if (wait) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 9000)))
        continue
      }
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return String(text).trim()
    } catch {
      // prueba el siguiente modelo
    }
  }
  return null
}
