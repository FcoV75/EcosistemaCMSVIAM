"""Geometría del movimiento cinematográfico Ken Burns (sin OpenCV)."""

ESTILOS_MOVIMIENTO = ("zoom_in", "zoom_out", "pan_derecha", "pan_izquierda")
FACTOR_MOVIMIENTO = 1.22
MAX_MOVIMIENTO_GRATUITO = 5
MAX_MOVIMIENTO_PREMIUM = 30


def smoothstep(t):
    t = max(0.0, min(1.0, float(t)))
    return t * t * (3.0 - 2.0 * t)


def recuadro_ken_burns(t, estilo, bw, bh, out_w, out_h):
    """Recorte (x, y, w, h) sobre la imagen ampliada. t en [0, 1]."""
    te = smoothstep(t)
    estilo = (estilo or "zoom_in").strip().lower()
    if estilo not in ESTILOS_MOVIMIENTO:
        estilo = "zoom_in"
    if estilo in ("zoom_in", "zoom_out"):
        progreso = te if estilo == "zoom_in" else (1.0 - te)
        min_w, min_h = out_w, out_h
        crop_w = int(round(bw - progreso * (bw - min_w)))
        crop_h = int(round(bh - progreso * (bh - min_h)))
        crop_w = max(min_w, min(bw, crop_w))
        crop_h = max(min_h, min(bh, crop_h))
        x = max(0, (bw - crop_w) // 2)
        y = max(0, (bh - crop_h) // 2)
        return x, y, crop_w, crop_h
    crop_w, crop_h = out_w, out_h
    max_x = max(0, bw - crop_w)
    max_y = max(0, bh - crop_h)
    y = max_y // 2
    x = int(round(max_x * te)) if estilo == "pan_derecha" else int(round(max_x * (1.0 - te)))
    return x, y, crop_w, crop_h
