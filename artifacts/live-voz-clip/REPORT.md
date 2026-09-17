# LIVE voz/clip

- Started: 2026-09-17T20:43:56.386Z
- Finished: 2026-09-17T20:44:05.191Z
- Keys lengths: GROQ=56, FAL=69, GEMINI=53

## Voz
- 30s: FAIL chunk 0: groq: HTTP 400: {"error":{"message":"The model `canopylabs/orpheus-v1-english` requires terms acceptance. Please have the org admin accept the terms at https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english","type":"invalid_request_error","code":"model_terms_required"}} · gemini: gemini/gemini-2.5-flash-preview-tts: HTTP 429: {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quot | gemini/gemini-2.5-flas · fal: HTTP 403: {"detail":"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."}

## Clip I2V FAL
- FAIL: fuente=fal:fal-ai/flux/dev tipo=cinematico fallback=fal-t2v:fal-ai/kling-video/v2.1/standard/text-to-video HTTP 403: {"detail":"User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."} error=n/a

## Blockers proveedor
- Groq Orpheus requiere aceptar términos del modelo en la consola Groq.
- Gemini devolvió 429 por cuota agotada.
- Fal devolvió saldo agotado / usuario bloqueado.
