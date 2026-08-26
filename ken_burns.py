"""Geometría del movimiento cinematográfico Ken Burns (sin OpenCV)."""

ESTILOS_MOVIMIENTO = (
    "zoom_in",
    "zoom_out",
    "pan_derecha",
    "pan_izquierda",
    "pan_arriba",
    "pan_abajo",
    "zoom_in_derecha",
    "zoom_in_izquierda",
    "ken_burns",
    "zoom_out_izquierda",
)
# Cubrir el cuadro + factor alto: con letterbox el zoom casi no se notaba.
FACTOR_MOVIMIENTO = 1.62
CICLO_KEN_BURNS_SEG = 6.0
MAX_MOVIMIENTO_GRATUITO = 5
MAX_MOVIMIENTO_PREMIUM = 30


def smoothstep(t):
    t = max(0.0, min(1.0, float(t)))
    s = t * t * (3.0 - 2.0 * t)
    # Mezcla con lineal para que el movimiento arranque desde el primer segundo.
    return 0.4 * t + 0.6 * s


def quiere_movimiento(valor):
    if isinstance(valor, bool):
        return valor
    if valor is None:
        return False
    return str(valor).strip().lower() in ("1", "true", "yes", "si", "sí", "on")


def progreso_ken_burns(frame_idx, fps=24, ciclo_seg=CICLO_KEN_BURNS_SEG):
    """t en [0, 1]. Si ciclo_seg coincide con la duración de la toma, recorre un Ken Burns completo."""
    periodo = max(1.0, float(ciclo_seg or CICLO_KEN_BURNS_SEG))
    fps = max(1.0, float(fps or 24))
    seg = max(0, int(frame_idx)) / fps
    ciclo = (seg / periodo) % 2.0
    return ciclo if ciclo <= 1.0 else 2.0 - ciclo


def _plan_estilo(estilo, te):
    """zoom 0=abierto (toda la imagen ampliada), 1=cerrado (cuadro de salida). nx/ny 0..1."""
    estilo = (estilo or "zoom_in").strip().lower()
    if estilo not in ESTILOS_MOVIMIENTO:
        estilo = "zoom_in"
    if estilo == "zoom_in":
        return te, 0.5, 0.5
    if estilo == "zoom_out":
        return 1.0 - te, 0.5, 0.5
    if estilo == "pan_derecha":
        return 1.0, te, 0.5
    if estilo == "pan_izquierda":
        return 1.0, 1.0 - te, 0.5
    if estilo == "pan_arriba":
        return 1.0, 0.5, 1.0 - te
    if estilo == "pan_abajo":
        return 1.0, 0.5, te
    if estilo == "zoom_in_derecha":
        return te, te, 0.5
    if estilo == "zoom_in_izquierda":
        return te, 1.0 - te, 0.5
    if estilo == "zoom_out_izquierda":
        return 1.0 - te, 1.0 - te, 0.5
    # ken_burns: zoom + diagonal clásica
    return te, te, 1.0 - te


def recuadro_ken_burns(t, estilo, bw, bh, out_w, out_h):
    """Recorte (x, y, w, h) sobre la imagen ampliada. t en [0, 1]."""
    te = smoothstep(t)
    zoom, nx, ny = _plan_estilo(estilo, te)
    min_w, min_h = out_w, out_h
    crop_w = int(round(bw - zoom * (bw - min_w)))
    crop_h = int(round(bh - zoom * (bh - min_h)))
    crop_w = max(min_w, min(bw, crop_w))
    crop_h = max(min_h, min(bh, crop_h))
    max_x = max(0, bw - crop_w)
    max_y = max(0, bh - crop_h)
    nx = max(0.0, min(1.0, float(nx)))
    ny = max(0.0, min(1.0, float(ny)))
    x = int(round(max_x * nx))
    y = int(round(max_y * ny))
    return x, y, crop_w, crop_h
