# Piloto — *Ecos de Singularidad* (vertical)

M01–M02: stills + Wav2Lip CPU + edge-tts. M03–M06: ElevenLabs + Kling Avatar.

| Archivo | Capítulo |
|---|---|
| `M01-la-imagen-llora.mp4` | La imagen llora |
| `M02-socializacion.mp4` | Socialización |
| `M03-americano.mp4` | ¿Americano? |
| `M04-estas-triste.mp4` | Estás triste |
| `M05-importo.mp4` | ¿Importo? |
| `M06-el-numero-tiene-cara.mp4` | El número tiene cara |

- Formato: 1080×1920 (9:16)
- Audio final: AAC **estéreo** (`-ac 2`) + loudnorm. El AAC mono no se oye en Windows Media Player ni en varios móviles.
- Regenerar M01–M02: `python3 ../scripts/produce_vertical.py --ep all`
- Regenerar M03–M06 (keys en entorno): `produce_m03_kling.py` · `produce_m04_kling.py` · `produce_m05_kling.py` · `produce_m06_kling.py`

El “parpadeo” de círculos de piel está **apagado**.
