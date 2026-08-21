"""Mezcla del riel de locución con el riel de música de fondo (FFmpeg)."""

VOLUMEN_FONDO_DEFAULT = 0.48
VOLUMEN_VOZ_DEFAULT = 1.0


def _vol(valor, default, lo=0.0, hi=1.0):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        n = default
    return max(lo, min(hi, n))


def comandos_mezcla_rieles(
    ffmpeg_bin,
    ruta_voz,
    ruta_fondo,
    salida,
    duracion=None,
    volumen_fondo=VOLUMEN_FONDO_DEFAULT,
    volumen_voz=VOLUMEN_VOZ_DEFAULT,
):
    """Varias estrategias: loop en el input (no aloop), amix sin normalizar, MP3 o AAC."""
    vol_f = _vol(volumen_fondo, VOLUMEN_FONDO_DEFAULT)
    vol_v = _vol(volumen_voz, VOLUMEN_VOZ_DEFAULT)
    duracion_flag = []
    if duracion and float(duracion) > 0:
        duracion_flag = ["-t", f"{float(duracion):.3f}"]
    filtro = (
        f"[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume={vol_v:.3f}[voz];"
        f"[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume={vol_f:.3f}[bg];"
        f"[voz][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]"
    )
    base_loop = [
        ffmpeg_bin, "-y",
        "-i", ruta_voz,
        "-stream_loop", "-1", "-i", ruta_fondo,
        "-filter_complex", filtro,
        "-map", "[a]",
        *duracion_flag,
    ]
    base_noloop = [
        ffmpeg_bin, "-y",
        "-i", ruta_voz,
        "-i", ruta_fondo,
        "-filter_complex", filtro,
        "-map", "[a]",
        *duracion_flag,
    ]
    return [
        [*base_loop, "-c:a", "libmp3lame", "-b:a", "192k", salida],
        [*base_loop, "-c:a", "aac", "-b:a", "192k", salida],
        [*base_noloop, "-c:a", "libmp3lame", "-b:a", "192k", salida],
        [*base_noloop, "-c:a", "aac", "-b:a", "192k", salida],
    ]


def comando_mezcla_rieles(*args, **kwargs):
    """Compat: primer comando de la lista."""
    return comandos_mezcla_rieles(*args, **kwargs)[0]
