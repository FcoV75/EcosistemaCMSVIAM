# Piloto — *Ecos de Singularidad* (vertical)

Stills con lock de Anya + **movimiento** (reencuadre / respiración) + **lipsync CPU (Wav2Lip)** + voces edge-tts + captions.

| Archivo | Capítulo |
|---|---|
| `M01-la-imagen-llora.mp4` | La imagen llora |
| `M02-socializacion.mp4` | Socialización |

- Formato: 1080×1920 (9:16)
- Voces: Anya `es-MX-DaliaNeural` · Levin `es-ES-AlvaroNeural` · Alice `es-ES-ElviraNeural`
- Regenerar: `python3 ../scripts/produce_vertical.py --ep all` (red para las voces; Wav2Lip en `/tmp/wav2lip/Wav2Lip`)

Esto **no** es Kling/Pika: no hay performance de cuerpo completa. La boca la mueve Wav2Lip sobre el still; manos, cristal y puerta son cortes a fotos de gesto. Si la cara y el tono se sostienen, el siguiente salto es la misma toma en Kling anclada a `assets/anya-lock-retrato.png`.
