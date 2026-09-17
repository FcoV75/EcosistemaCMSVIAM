# Live voz/clip — bloqueado por Environment

## Keys en esta VM
- GROQ_API_KEY length: 0
- FAL_KEY length: 0
- GEMINI_API_KEY length: 0
- Environment Cursor vinculado: **NO** (`environment: null` en run bc-e32b7ec9)

Las keys **sí existen** en el Environment del repo y en Netlify producción.
Hay que **vincular ese Environment a este agente** (o reiniciarlo con el Environment correcto).

## Producción (centromultidisciplinarioags.com) — diagnóstico ahora
- `estudio-gemini-status`: GEMINI_API_KEY presente (len 53)
- Gemini TTS: **429 quota** (hoy es límite de plan; el wrap TTS de este PR sigue siendo necesario para el 400 de formato)
- Gemini imagen: 429 quota
- `estudio-voz` con token guest: 502 genérico del código **aún no desplegado** (sin `detalle_proveedor`); Groq probablemente falla y Gemini cae por 429
- Código de este PR: wrap TTS + `detalle_proveedor` + chunking cliente + `solo_tts` sin quemar cuota en chunks >0

## Unit tests
- `test_estudio_limites.mjs` OK
- `test_estudio_voz_chunking.mjs` OK
  - 30s→2 chunks, 60s→3, 120s→5, 300s→12 (@420 chars)

## Qué falta para cerrar LIVE
1. Vincular Environment con GROQ/FAL/(GEMINI)
2. Redeploy Netlify con este branch
3. Re-correr `node tests/live_voz_clip_harness.mjs` y clip I2V con FAL_KEY
