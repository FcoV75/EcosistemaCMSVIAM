# LIVE voz/clip

- Started: 2026-09-17T21:16:14.150Z
- Finished: 2026-09-17T21:18:16.333Z
- Keys lengths: GROQ=56, FAL=69, GEMINI=53

## Voz
- 30s: OK (3 chunks, groq)
- 60s: OK (6 chunks, groq)
- 120s: FAIL chunk 6: groq: HTTP 429: {"error":{"message":"Rate limit reached for model `canopylabs/orpheus-v1-english` in organization `org_01knzsvs4yfdkb6877780afaa9` service tier `on_demand` on tokens per day (TPD): Limit 3600, Used 3498, Requested 146. Please try again in 17m36s. Need more tokens? Upgrade to Dev  · gemini: gemini/gemini-2.5-flash-preview-tts: HTTP 429: {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quot | gemini/gemini-2.5-flas · fal: HTTP 403: {"detail":"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."}

## Clip I2V FAL
- FAIL: fuente=pollinations-flux-realism tipo=cinematico fallback=fal-i2v:fal-ai/minimax/hailuo-02/standard/image-to-video HTTP 403: {"detail":"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."} | fal-t2v:fal-ai/kling-video/v2.1/standard/text-to-video HTTP 403: {"detail":"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."} error=n/a

## Blockers proveedor
- Gemini devolvió 429 por cuota agotada.
- Fal devolvió saldo agotado / usuario bloqueado.
