# Minidrama vertical — *Ecos de Singularidad*

Adaptación a serie vertical (TikTok / Reels / ReelShort) de los **12 capítulos de audio** ya reescritos. No parte de los 20 originales.

## Lo que Claude acertó

El formato: personajes fijos, sets pocos, cliffhanger, emisión diaria. Ella puede escribir desglose. **No puede** generar imagen/video con cara estable.

## Lo que mejoramos aquí

1. **No trocear 300 minutos en 80–100 caps.** Eso hincha la historia y mata a Anya. El audio ya es 12 × 15 min. En imagen, un minuto de radio no es un minuto de plano. Temporada 1 vertical: **30 micro-episodios de 80–100 s** (~40 min de serie). Diario, un mes.
2. **No cortar cada 70 s por fórmula.** El gancho nace del giro (el americano, el pulso, el 2050 con cara), no de un cronómetro.
3. **Misma Anya:** niña científica, literal, ingenua. No dialecto “ceo humillado / cachetada”.
4. **Piloto primero:** M01–M06 (el café y el número). Si la cara se sostiene, se sigue.

## Qué se produce en esta carpeta

| Entrego | No entrego (aún) |
|---|---|
| Biblia vertical, mapa de 30, lock de sets | 30 MP4 de una tacada |
| Guiones de producción M01–M06 | Kling / Pika / Seedance (cuerpo actuado) |
| Fichas de imagen + piloto M01–M02 con boca y ademán | ElevenLabs / GPU |
| Motor `scripts/produce_vertical.py` (Wav2Lip CPU) | Performance real de manos/caminar |

El video con cara estable sigue siendo **Runway, Kling, Pika, MiniMax o Video Diamante** (Ken Burns + voz, peor consistencia, más barato). Estas fichas son el ancla.

**Pilotos:** M01–M02 (Wav2Lip), M03–M04 (ElevenLabs + Kling Avatar). Elenco amplio: `assets/refs/`.

Empieza por `BIBLIA-VERTICAL.md`, `MAPA-30.md` y `episodios/M01`.
