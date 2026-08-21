"""Mezcla del riel de locución con el riel de música de fondo (FFmpeg)."""

VOLUMEN_FONDO_DEFAULT = 0.24


def comando_mezcla_rieles(
    ffmpeg_bin,
    ruta_voz,
    ruta_fondo,
    salida,
    duracion=None,
    volumen_fondo=VOLUMEN_FONDO_DEFAULT,
):
    """Arma el comando FFmpeg: voz al frente, MP3/MIDI de fondo más bajo y en bucle."""
    try:
        vol = float(volumen_fondo)
    except (TypeError, ValueError):
        vol = VOLUMEN_FONDO_DEFAULT
    vol = max(0.04, min(0.6, vol))
    duracion_flag = []
    if duracion and float(duracion) > 0:
        duracion_flag = ["-t", f"{float(duracion):.3f}"]
    filtro = (
        f"[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[voz];"
        f"[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
        f"volume={vol:.3f},aloop=loop=-1:size=2147483647[bg];"
        f"[voz][bg]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.96[a]"
    )
    return [
        ffmpeg_bin, "-y",
        "-i", ruta_voz,
        "-i", ruta_fondo,
        "-filter_complex", filtro,
        "-map", "[a]",
        "-c:a", "libmp3lame", "-b:a", "192k",
        *duracion_flag,
        salida,
    ]
