import os
import re
import sys
import glob
import shutil
import cv2
import numpy as np
import json
import argparse
import subprocess
import unicodedata

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_DISPONIBLE = True
except ImportError:
    PIL_DISPONIBLE = False

WIDTH, HEIGHT = 1280, 720
FPS = 24  # Menos fotogramas = render mucho más rápido, suficiente para slideshow

TAM_LEYENDA_PORTADA = 38
TAM_SUBTITULO = 40
TAM_NOMBRE_PISTA = 32
TAM_TEXTO_ESCENA = 36
MARGEN_INTRO_LETRA = 15.0
MARGEN_OUTRO_LETRA = 12.0
MARCA_AGUA_TEXTO = "IAVIAM VIDEO_DIAMANTE"
TAM_MARCA_AGUA = 22
MAX_PALABRAS_LINEA_KARAOKE = 10
PADDING_FONDO = 8
TAM_MINIMO_FUENTE = 72

_FUENTE_RUTA = None
_FUENTE_CACHE = {}


def resolver_ffmpeg():
    candidatos = [os.environ.get("FFMPEG_BINARY"), shutil.which("ffmpeg")]
    for ruta in candidatos:
        if ruta and os.path.isfile(ruta):
            return ruta
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _resolver_ruta_fuente():
    global _FUENTE_RUTA
    if _FUENTE_RUTA:
        return _FUENTE_RUTA
    base = os.path.dirname(os.path.abspath(__file__))
    candidatos = [
        os.path.join(base, "assets", "fonts", "DejaVuSans-Bold.ttf"),
        os.path.join(base, "Assets", "fonts", "DejaVuSans-Bold.ttf"),
    ]
    for pattern in (
        "/usr/share/fonts/**/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/**/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ):
        candidatos.extend(glob.glob(pattern, recursive=True) if "**" in pattern else [pattern])
    for ruta in candidatos:
        if ruta and os.path.isfile(ruta):
            _FUENTE_RUTA = ruta
            print(f"Fuente UTF-8: {ruta}")
            return ruta
    print("ERROR: fuente TTF no encontrada — el texto saldrá minúsculo y sin acentos.")
    return None


def _reparar_mojibake(texto):
    """UTF-8 mal leído como Latin-1: 'mÃ¡s' → 'más', 'atenciÃ³n' → 'atención'."""
    if not texto or not re.search(r"[Ãâï¿½]", texto):
        return texto
    for codec in ("utf-8", "cp1252"):
        try:
            reparado = texto.encode("latin-1").decode(codec)
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
        if reparado and "\ufffd" not in reparado:
            return reparado
    return texto


def _normalizar_texto(texto):
    if texto is None:
        return ""
    if not isinstance(texto, str):
        texto = str(texto)
    texto = _reparar_mojibake(texto)
    texto = unicodedata.normalize("NFC", texto)
    texto = texto.replace("\ufffd", "")
    texto = re.sub(r"[\u200b-\u200d\ufeff]", "", texto)
    return texto.strip()


def _aplicar_escala_tipografia(escala_texto):
    global TAM_LEYENDA_PORTADA, TAM_SUBTITULO, TAM_NOMBRE_PISTA, TAM_TEXTO_ESCENA, TAM_MARCA_AGUA
    escala = max(1.0, min(6.0, float(escala_texto or 6.0)))
    TAM_LEYENDA_PORTADA = max(TAM_MINIMO_FUENTE, int(38 * escala))
    TAM_SUBTITULO = max(TAM_MINIMO_FUENTE, int(40 * escala))
    TAM_NOMBRE_PISTA = max(TAM_MINIMO_FUENTE, int(32 * escala))
    TAM_TEXTO_ESCENA = max(TAM_MINIMO_FUENTE, int(36 * escala))
    TAM_MARCA_AGUA = max(18, int(22 * (escala / 2)))
    print(f"Tipografía escala x{escala}: sub={TAM_SUBTITULO} escena={TAM_TEXTO_ESCENA}")


def _fuente_pillow(tamano):
    if tamano in _FUENTE_CACHE:
        return _FUENTE_CACHE[tamano]
    ruta = _resolver_ruta_fuente()
    if ruta:
        try:
            font = ImageFont.truetype(ruta, tamano)
            _FUENTE_CACHE[tamano] = font
            return font
        except Exception as e:
            print(f"Aviso cargando fuente {ruta} @ {tamano}px: {e}")
    print(f"Aviso: usando fuente por defecto (pequeña) para tamaño {tamano}px")
    font = ImageFont.load_default()
    _FUENTE_CACHE[tamano] = font
    return font


def _partir_texto_en_lineas(texto, draw, tamano, max_ancho, max_lineas=4):
    palabras = texto.split()
    if not palabras:
        return texto
    font = _fuente_pillow(tamano)
    lineas, actual = [], []
    for i, palabra in enumerate(palabras):
        prueba = " ".join(actual + [palabra])
        bbox = draw.textbbox((0, 0), prueba, font=font)
        if bbox[2] - bbox[0] <= max_ancho or not actual:
            actual.append(palabra)
            continue
        lineas.append(" ".join(actual))
        if len(lineas) >= max_lineas:
            sobrantes = [palabra] + palabras[i + 1:]
            lineas[-1] = lineas[-1] + " " + " ".join(sobrantes)
            return "\n".join(lineas[:max_lineas])
        actual = [palabra]
    if actual:
        lineas.append(" ".join(actual))
    return "\n".join(lineas[:max_lineas])


def _ajustar_tamano_fuente(draw, texto, tam_inicial, max_ancho, min_ratio=0.88):
    """Reduce como mucho ~12% — antes encogía hasta la mitad y anulaba la escala XXL/L."""
    tam = tam_inicial
    piso = max(28, int(tam_inicial * min_ratio))
    while tam >= piso:
        font = _fuente_pillow(tam)
        bbox = draw.textbbox((0, 0), texto, font=font)
        if bbox[2] - bbox[0] <= max_ancho:
            return font, tam
        tam -= 2
    return _fuente_pillow(piso), piso


def _dibujar_texto_fondo_ajustado(img_bgr, texto, x, y, tamano, color_texto, color_fondo=(0, 0, 0, 170),
                                  centrado=False, multilinea=False, anchor_center=False):
    """Sombra/fondo limitado estrictamente al bbox del texto (+padding)."""
    texto = _normalizar_texto(texto)
    if not texto:
        return img_bgr
    if not PIL_DISPONIBLE:
        return estampar_texto_sombra_simple(img_bgr, texto, (x, y), tamano, color_texto)

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    base = Image.fromarray(img_rgb).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    max_ancho = WIDTH - 100
    if multilinea or anchor_center:
        if "\n" not in texto:
            texto = _partir_texto_en_lineas(texto, draw, tamano, max_ancho, max_lineas=5)
        multilinea = True
        font, tam = _ajustar_tamano_fuente(draw, texto.split("\n")[0], tamano, max_ancho)
        bbox = draw.multiline_textbbox((0, 0), texto, font=font, align="center")
    else:
        if len(texto) > 28:
            envuelto = _partir_texto_en_lineas(texto, draw, tamano, max_ancho, max_lineas=3)
            if "\n" in envuelto:
                texto = envuelto
                multilinea = True
                font, tam = _ajustar_tamano_fuente(draw, texto.split("\n")[0], tamano, max_ancho)
                bbox = draw.multiline_textbbox((0, 0), texto, font=font, align="center")
            else:
                font, tam = _ajustar_tamano_fuente(draw, texto, tamano, max_ancho)
                bbox = draw.textbbox((0, 0), texto, font=font)
        else:
            font, tam = _ajustar_tamano_fuente(draw, texto, tamano, max_ancho)
            bbox = draw.textbbox((0, 0), texto, font=font)

    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    if anchor_center:
        px, py = x - tw // 2, y - th // 2
    elif centrado:
        px, py = (WIDTH - tw) // 2, y
    else:
        px, py = x, y

    pad = PADDING_FONDO
    draw.rounded_rectangle(
        (px - pad, py - pad, px + tw + pad, py + th + pad),
        radius=6, fill=color_fondo
    )

    sombra = (0, 0, 0, 220)
    principal = (color_texto[2], color_texto[1], color_texto[0], 255)
    if multilinea or anchor_center:
        cx = px + tw // 2 if anchor_center else px
        cy = py + th // 2 if anchor_center else py
        for dx, dy in ((3, 3), (-2, 2)):
            if multilinea:
                draw.multiline_text((cx + dx, cy + dy), texto, font=font, fill=sombra, anchor="mm" if anchor_center else None, align="center")
            else:
                draw.text((px + dx, py + dy), texto, font=font, fill=sombra)
        if multilinea:
            draw.multiline_text((cx, cy), texto, font=font, fill=principal, anchor="mm" if anchor_center else None, align="center")
        else:
            draw.text((px, py), texto, font=font, fill=principal)
    else:
        for dx, dy in ((3, 3), (-2, 2)):
            draw.text((px + dx, py + dy), texto, font=font, fill=sombra)
        draw.text((px, py), texto, font=font, fill=principal)

    result = Image.alpha_composite(base, overlay)
    return cv2.cvtColor(np.array(result.convert("RGB")), cv2.COLOR_RGB2BGR)


def _agrupar_palabras_en_lineas(palabras, gap=0.65):
    if not palabras:
        return []
    lineas = [[palabras[0]]]
    for p in palabras[1:]:
        prev = lineas[-1][-1]
        if p["start"] - prev["end"] > gap or len(lineas[-1]) >= MAX_PALABRAS_LINEA_KARAOKE:
            lineas.append([p])
        else:
            lineas[-1].append(p)
    return lineas


def _linea_karaoke_activa(palabras, segundo_actual):
    lineas = _agrupar_palabras_en_lineas(palabras)
    if not lineas:
        return [], -1
    for linea in lineas:
        fin_linea = linea[-1]["end"] + 0.25
        if linea[0]["start"] <= segundo_actual <= fin_linea:
            idx = -1
            for i, p in enumerate(linea):
                fin_palabra = p["end"] + 0.06
                if p["start"] <= segundo_actual <= fin_palabra:
                    idx = i
                    break
                if segundo_actual >= p["start"]:
                    idx = i
            return linea, idx
    iniciadas = [ln for ln in lineas if ln[0]["start"] <= segundo_actual]
    if iniciadas:
        linea = iniciadas[-1]
        idx = len(linea) - 1
        return linea, idx
    return [], -1


def _dibujar_karaoke(img_bgr, palabras_visibles, palabra_actual_idx, y_base, tamano):
    if not palabras_visibles:
        return img_bgr
    if not PIL_DISPONIBLE:
        linea = " ".join(p["text"] for p in palabras_visibles)
        return _dibujar_texto_fondo_ajustado(img_bgr, linea, WIDTH // 2, y_base, tamano, (255, 255, 255), centrado=True)

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    base = Image.fromarray(img_rgb).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    partes = [_normalizar_texto(p["text"]) for p in palabras_visibles]
    linea = " ".join(partes)
    font, tam = _ajustar_tamano_fuente(draw, linea, tamano, WIDTH - 80)
    bbox = draw.textbbox((0, 0), linea, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    px = (WIDTH - tw) // 2
    py = y_base
    pad = PADDING_FONDO
    draw.rounded_rectangle((px - pad, py - pad, px + tw + pad, py + th + pad), radius=6, fill=(0, 0, 0, 175))

    x_cursor = px
    for i, palabra in enumerate(partes):
        if i > 0:
            sp = " "
            draw.text((x_cursor, py + 3), sp, font=font, fill=(0, 0, 0, 220))
            draw.text((x_cursor, py), sp, font=font, fill=(255, 255, 255, 255))
            x_cursor += draw.textbbox((0, 0), sp, font=font)[2]
        if i == palabra_actual_idx:
            fill = (255, 215, 0, 255)
        else:
            fill = (255, 255, 255, 255)
        draw.text((x_cursor + 2, py + 2), palabra, font=font, fill=(0, 0, 0, 220))
        draw.text((x_cursor, py), palabra, font=font, fill=fill)
        x_cursor += draw.textbbox((0, 0), palabra, font=font)[2]

    result = Image.alpha_composite(base, overlay)
    return cv2.cvtColor(np.array(result.convert("RGB")), cv2.COLOR_RGB2BGR)


def estampar_texto_sombra_simple(img_bgr, texto, posicion, tamano=36, color=(255, 215, 0)):
    texto = _normalizar_texto(texto)
    if not texto:
        return img_bgr
    x, y = posicion
    cv2.putText(img_bgr, texto, (x + 2, y + 2), cv2.FONT_HERSHEY_SIMPLEX, tamano / 40, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(img_bgr, texto, (x, y), cv2.FONT_HERSHEY_SIMPLEX, tamano / 40, color, 2, cv2.LINE_AA)
    return img_bgr


def estampar_texto_escena(img_bgr, texto, width, height, tamano=TAM_TEXTO_ESCENA):
    return _dibujar_texto_fondo_ajustado(img_bgr, texto, 0, height - 200, tamano, (255, 215, 0), centrado=True)


def estampar_subtitulo_karaoke(img_bgr, palabras, segundo_actual, width, height, tamano=TAM_SUBTITULO):
    linea, idx = _linea_karaoke_activa(palabras, segundo_actual)
    if not linea:
        return img_bgr
    return _dibujar_karaoke(img_bgr, linea, idx, height - 140, tamano)


def estampar_marca_agua(img_bgr, width, height, tamano=TAM_MARCA_AGUA):
    if not PIL_DISPONIBLE:
        return _dibujar_texto_fondo_ajustado(img_bgr, MARCA_AGUA_TEXTO, width - 280, height - 30, tamano, (200, 200, 200))
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    base = Image.fromarray(img_rgb).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font, _ = _ajustar_tamano_fuente(draw, MARCA_AGUA_TEXTO, tamano, width // 3)
    bbox = draw.textbbox((0, 0), MARCA_AGUA_TEXTO, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    px, py = width - tw - 16, height - th - 14
    pad = 4
    draw.rounded_rectangle((px - pad, py - pad, px + tw + pad, py + th + pad), radius=4, fill=(0, 0, 0, 90))
    draw.text((px + 1, py + 1), MARCA_AGUA_TEXTO, font=font, fill=(0, 0, 0, 120))
    draw.text((px, py), MARCA_AGUA_TEXTO, font=font, fill=(210, 210, 210, 160))
    return cv2.cvtColor(np.array(Image.alpha_composite(base, overlay).convert("RGB")), cv2.COLOR_RGB2BGR)


def estampar_leyenda_grande(img_bgr, texto, width, height, tamano=TAM_LEYENDA_PORTADA):
    return _dibujar_texto_fondo_ajustado(
        img_bgr, texto, width // 2, height // 2, tamano, (255, 215, 0),
        multilinea=True, anchor_center=True, color_fondo=(0, 0, 0, 150)
    )


def crear_lienzo_portada_cierre(leyenda, width, height):
    lienzo = np.full((height, width, 3), (28, 28, 35), dtype=np.uint8)
    if leyenda:
        return estampar_leyenda_grande(lienzo, leyenda, width, height)
    return lienzo


def obtener_duracion_audio(ruta_audio, ffmpeg_bin=None):
    if not ruta_audio or not os.path.exists(ruta_audio):
        return 30.0
    try:
        from mutagen import File as MutagenFile
        meta = MutagenFile(ruta_audio)
        if meta and meta.info and getattr(meta.info, "length", None):
            return float(meta.info.length)
    except Exception:
        pass
    ffmpeg_bin = ffmpeg_bin or resolver_ffmpeg()
    if ffmpeg_bin:
        try:
            resultado = subprocess.run([ffmpeg_bin, "-i", ruta_audio], capture_output=True, text=True, check=False)
            salida = (resultado.stderr or "") + (resultado.stdout or "")
            coincidencia = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", salida)
            if coincidencia:
                h, m, s = coincidencia.groups()
                return int(h) * 3600 + int(m) * 60 + float(s)
        except Exception as e:
            print(f"Aviso midiendo audio: {e}")
    return 30.0


def cargar_imagen_alta_calidad(ruta):
    img = cv2.imread(ruta, cv2.IMREAD_COLOR)
    return img


def ajustar_proporcion_lienzo(img, ancho_objetivo=WIDTH, alto_objetivo=HEIGHT):
    alto_orig, ancho_orig = img.shape[:2]
    escala = min(ancho_objetivo / ancho_orig, alto_objetivo / alto_orig)
    nuevo_ancho = int(ancho_orig * escala)
    nuevo_alto = int(alto_orig * escala)
    interp = cv2.INTER_AREA
    img_redimensionada = cv2.resize(img, (nuevo_ancho, nuevo_alto), interpolation=interp)
    lienzo = np.zeros((alto_objetivo, ancho_objetivo, 3), dtype=np.uint8)
    x_offset = (ancho_objetivo - nuevo_ancho) // 2
    y_offset = (alto_objetivo - nuevo_alto) // 2
    lienzo[y_offset:y_offset + nuevo_alto, x_offset:x_offset + nuevo_ancho] = img_redimensionada
    return lienzo


def parsear_lineas_letra(letra):
    letra = _normalizar_texto(letra)
    if not letra:
        return []
    lineas = [t for raw in letra.replace("\r", "").split("\n") if (t := raw.strip())]
    if not lineas:
        lineas = [s.strip() for s in re.split(r'[.!?]+', letra) if s.strip()]
    return lineas


def contar_palabras(texto):
    return len(re.findall(r"\w+", texto, flags=re.UNICODE)) or 1


def ventana_vocal(duracion_total):
    inicio = min(MARGEN_INTRO_LETRA, max(0.0, duracion_total * 0.06))
    fin = max(duracion_total - MARGEN_OUTRO_LETRA, inicio + 1.0)
    return inicio, fin


def construir_intervalos_lineas(lineas, duracion_total):
    if not lineas or duracion_total <= 0:
        return []
    inicio_vocal, fin_vocal = ventana_vocal(duracion_total)
    usable = fin_vocal - inicio_vocal
    pesos = [float(contar_palabras(ln)) for ln in lineas]
    total_peso = sum(pesos) or float(len(lineas))
    intervalos, t = [], inicio_vocal
    for linea, peso in zip(lineas, pesos):
        dur = (peso / total_peso) * usable
        intervalos.append({"start": t, "end": t + dur, "text": linea})
        t += dur
    if intervalos:
        intervalos[-1]["end"] = fin_vocal
    return intervalos


def normalizar_palabras_raw(palabras_raw, duracion_total):
    palabras = []
    for item in palabras_raw or []:
        if not isinstance(item, dict):
            continue
        word = _normalizar_texto(item.get("word", item.get("text", "")))
        if not word:
            continue
        try:
            inicio = max(0.0, float(item.get("start", 0)))
            fin = min(duracion_total, float(item.get("end", inicio + 0.25)))
        except (TypeError, ValueError):
            continue
        if fin <= inicio:
            fin = min(duracion_total, inicio + 0.25)
        palabras.append({"start": inicio, "end": fin, "text": word})
    return palabras


def lineas_a_palabras_timed(lineas, duracion_total):
    palabras = []
    for seg in construir_intervalos_lineas(lineas, duracion_total):
        words = _normalizar_texto(seg["text"]).split()
        if not words:
            continue
        dur = (seg["end"] - seg["start"]) / len(words)
        t = seg["start"]
        for w in words:
            palabras.append({"start": t, "end": t + dur, "text": w})
            t += dur
    return palabras


def normalizar_segmentos_letra(segmentos_raw, duracion_total):
    if not segmentos_raw or duracion_total <= 0:
        return []
    intervalos = []
    for seg in segmentos_raw:
        if not isinstance(seg, dict):
            continue
        texto = _normalizar_texto(seg.get("text", ""))
        if not texto:
            continue
        try:
            inicio = max(0.0, float(seg.get("start", 0)))
            fin = min(duracion_total, float(seg.get("end", inicio + 1)))
        except (TypeError, ValueError):
            continue
        if fin <= inicio:
            fin = min(duracion_total, inicio + 1.5)
        for w in texto.split():
            dur = (fin - inicio) / max(1, len(texto.split()))
            intervalos.append({"start": inicio, "end": inicio + dur, "text": w})
            inicio += dur
    return intervalos


def preparar_palabras_subtitulo(letra_palabras, letra_cancion, letra_segmentos, duracion_total, subtitulos_on):
    if not subtitulos_on:
        return []
    palabras = normalizar_palabras_raw(letra_palabras, duracion_total)
    if palabras:
        return palabras
    lineas = parsear_lineas_letra(letra_cancion)
    if lineas:
        return lineas_a_palabras_timed(lineas, duracion_total)
    return normalizar_segmentos_letra(letra_segmentos, duracion_total)


def debe_mostrar_nombre_pista(segundo_actual, duracion_total):
    if duracion_total <= 0:
        return segundo_actual <= 15
    return segundo_actual <= 12 or segundo_actual >= max(0, duracion_total - 12)


def _clave_overlay(segundo_actual, duracion_total, texto_escena, subtitulos_on, nombre_pista, leyenda_grande, mostrar_marca_agua, num_palabras_sub):
    return (
        round(segundo_actual, 2),
        texto_escena,
        subtitulos_on,
        nombre_pista,
        leyenda_grande,
        mostrar_marca_agua,
        num_palabras_sub,
        debe_mostrar_nombre_pista(segundo_actual, duracion_total),
    )


def aplicar_overlays(frame, segundo_actual, duracion_total, texto_escena, palabras_sub, subtitulos_on,
                     nombre_pista, leyenda_grande=False, mostrar_marca_agua=False):
    f = frame
    texto_escena = _normalizar_texto(texto_escena)
    nombre_pista = _normalizar_texto(nombre_pista)
    if texto_escena:
        if leyenda_grande:
            f = estampar_leyenda_grande(f, texto_escena, WIDTH, HEIGHT)
        else:
            f = estampar_texto_escena(f, texto_escena, WIDTH, HEIGHT)
    if subtitulos_on and palabras_sub:
        f = estampar_subtitulo_karaoke(f, palabras_sub, segundo_actual, WIDTH, HEIGHT)
    if debe_mostrar_nombre_pista(segundo_actual, duracion_total):
        etiqueta = f"♪ {nombre_pista}"
        f = _dibujar_texto_fondo_ajustado(f, etiqueta, 0, 36, TAM_NOMBRE_PISTA, (255, 255, 255), centrado=True, color_fondo=(0, 0, 0, 150))
    if mostrar_marca_agua:
        f = estampar_marca_agua(f, WIDTH, HEIGHT)
    return f


def escribir_frames_imagen(writer, frame_base, frames_totales, texto_escena, palabras_sub, subtitulos_on,
                           nombre_pista, frame_contador, duracion_total, leyenda_grande=False,
                           mostrar_marca_agua=False):
    cache_clave = None
    cache_frame = None
    for _ in range(frames_totales):
        segundo = frame_contador / FPS
        n_vis = len([p for p in palabras_sub if p["start"] <= segundo]) if palabras_sub else 0
        clave = _clave_overlay(segundo, duracion_total, texto_escena, subtitulos_on, nombre_pista,
                               leyenda_grande, mostrar_marca_agua, n_vis)
        if clave == cache_clave and cache_frame is not None:
            writer.write(cache_frame)
        else:
            cache_frame = aplicar_overlays(
                frame_base, segundo, duracion_total, texto_escena, palabras_sub,
                subtitulos_on, nombre_pista, leyenda_grande=leyenda_grande,
                mostrar_marca_agua=mostrar_marca_agua
            )
            cache_clave = clave
            writer.write(cache_frame)
        frame_contador += 1
    return frame_contador


def escribir_frames_video(ruta_video, writer, duracion_asignada, texto_escena, palabras_sub, subtitulos_on,
                          nombre_pista, frame_contador, duracion_total, mostrar_marca_agua=False):
    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        return frame_contador, None
    frames_objetivo = max(1, int(round(FPS * duracion_asignada)))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    paso = max(1, total_frames // frames_objetivo) if total_frames > frames_objetivo else 1
    leidos, idx, ultimo = 0, 0, None
    cache_clave, cache_frame = None, None
    while leidos < frames_objetivo:
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(idx, max(0, total_frames - 1)))
        ok, frame = cap.read()
        if not ok:
            break
        frame = ajustar_proporcion_lienzo(frame)
        segundo = frame_contador / FPS
        n_vis = len([p for p in palabras_sub if p["start"] <= segundo]) if palabras_sub else 0
        clave = _clave_overlay(segundo, duracion_total, texto_escena, subtitulos_on, nombre_pista,
                               False, mostrar_marca_agua, n_vis)
        if clave == cache_clave and cache_frame is not None:
            writer.write(cache_frame)
            ultimo = cache_frame
        else:
            frame = aplicar_overlays(
                frame, segundo, duracion_total, texto_escena, palabras_sub, subtitulos_on, nombre_pista,
                mostrar_marca_agua=mostrar_marca_agua
            )
            cache_clave, cache_frame = clave, frame
            writer.write(frame)
            ultimo = frame.copy()
        frame_contador += 1
        leidos += 1
        idx += paso
    while leidos < frames_objetivo and ultimo is not None:
        segundo = frame_contador / FPS
        frame = aplicar_overlays(
            ultimo, segundo, duracion_total, texto_escena, palabras_sub, subtitulos_on, nombre_pista,
            mostrar_marca_agua=mostrar_marca_agua
        )
        writer.write(frame)
        frame_contador += 1
        leidos += 1
    cap.release()
    return frame_contador, ultimo


def generar_video_cloud():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/tmp/viam_uploads/render_config.json')
    parser.add_argument('--audio', default='/tmp/viam_uploads/audio_temp.mp3')
    parser.add_argument('--output', default='/tmp/video_viam_output.mp4')
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Error crítico: No se encontró configuración en {args.config}")
        sys.exit(1)

    with open(args.config, 'r', encoding='utf-8') as f:
        config = json.load(f)

    linea_tiempo = config.get("linea_tiempo", [])
    ruta_portada = config.get("ruta_portada", "")
    ruta_cierre = config.get("ruta_cierre", "")
    leyenda_portada = _normalizar_texto(config.get("leyenda_portada", ""))
    leyenda_cierre = _normalizar_texto(config.get("leyenda_cierre", ""))
    letra_cancion = _normalizar_texto(config.get("letra_cancion", ""))
    letra_segmentos = config.get("letra_segmentos", [])
    letra_palabras = config.get("letra_palabras", [])
    subtitulos_activos = config.get("subtitulos_activos", False)
    nombre_pista = _normalizar_texto(config.get("nombre_pista", "") or "Pista VIAM")
    es_premium = bool(config.get("es_premium", False))
    sin_marca_agua = bool(config.get("sin_marca_agua", False))
    mostrar_marca_agua = not es_premium or not sin_marca_agua

    ruta_audio = args.audio
    archivo_final = args.output

    if os.path.exists(archivo_final):
        try:
            os.remove(archivo_final)
        except Exception:
            pass

    ffmpeg_bin = resolver_ffmpeg()
    if not ffmpeg_bin:
        print("Error crítico: FFmpeg no disponible.")
        sys.exit(1)

    _resolver_ruta_fuente()
    _aplicar_escala_tipografia(config.get("escala_texto", 6.0))
    duracion_audio = obtener_duracion_audio(ruta_audio, ffmpeg_bin)
    print(f"Duración audio: {duracion_audio:.2f}s | FPS: {FPS} | Pista: {nombre_pista}")

    palabras_sub = preparar_palabras_subtitulo(
        letra_palabras, letra_cancion, letra_segmentos, duracion_audio, subtitulos_activos
    )
    print(f"Palabras subtítulo: {len(palabras_sub)}")

    segmentos = []
    if leyenda_portada or ruta_portada:
        segmentos.append("portada")
    if isinstance(linea_tiempo, list):
        segmentos.extend([x for x in linea_tiempo if isinstance(x, dict)])
    if leyenda_cierre or ruta_cierre:
        segmentos.append("cierre")

    conteo = max(1, len(segmentos))
    duracion_por_segmento = duracion_audio / conteo if duracion_audio > 0 else 5.0
    if duracion_por_segmento < 2.0:
        duracion_por_segmento = 2.0

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    ruta_video_puro = "/tmp/visual_temp_raw.mp4"
    if os.path.exists(ruta_video_puro):
        try:
            os.remove(ruta_video_puro)
        except Exception:
            pass

    video_writer = cv2.VideoWriter(ruta_video_puro, fourcc, FPS, (WIDTH, HEIGHT))
    frame_contador = 0
    frames_totales = int(round(FPS * duracion_por_segmento))
    ultimo_frame = None

    if leyenda_portada or ruta_portada:
        if ruta_portada and os.path.exists(ruta_portada):
            img = cargar_imagen_alta_calidad(ruta_portada)
            frame_base = ajustar_proporcion_lienzo(img) if img is not None else crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        ultimo_frame = frame_base.copy()
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_portada, palabras_sub,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio,
            leyenda_grande=bool(leyenda_portada), mostrar_marca_agua=mostrar_marca_agua
        )

    for item in linea_tiempo:
        if not isinstance(item, dict):
            continue
        tipo = item.get("tipo", "imagen")
        ruta = item.get("ruta", "")
        texto = _normalizar_texto(item.get("texto", ""))
        if not ruta or not os.path.exists(ruta):
            continue
        if tipo == "video":
            frame_contador, ultimo_vid = escribir_frames_video(
                ruta, video_writer, duracion_por_segmento, texto, palabras_sub,
                subtitulos_activos, nombre_pista, frame_contador, duracion_audio,
                mostrar_marca_agua=mostrar_marca_agua
            )
            if ultimo_vid is not None:
                ultimo_frame = ultimo_vid
        else:
            img = cargar_imagen_alta_calidad(ruta)
            if img is not None:
                frame_base = ajustar_proporcion_lienzo(img)
                ultimo_frame = frame_base.copy()
                frame_contador = escribir_frames_imagen(
                    video_writer, frame_base, frames_totales, texto, palabras_sub,
                    subtitulos_activos, nombre_pista, frame_contador, duracion_audio,
                    mostrar_marca_agua=mostrar_marca_agua
                )

    if leyenda_cierre or ruta_cierre:
        if ruta_cierre and os.path.exists(ruta_cierre):
            img = cargar_imagen_alta_calidad(ruta_cierre)
            frame_base = ajustar_proporcion_lienzo(img) if img is not None else crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        ultimo_frame = frame_base.copy()
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_cierre, palabras_sub,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio,
            leyenda_grande=bool(leyenda_cierre), mostrar_marca_agua=mostrar_marca_agua
        )

    frames_objetivo_total = max(1, int(round(FPS * duracion_audio)))
    if ultimo_frame is not None and frame_contador < frames_objetivo_total:
        faltan = frames_objetivo_total - frame_contador
        print(f"Extendiendo {faltan} fotogramas para igualar audio ({duracion_audio:.2f}s)")
        frame_contador = escribir_frames_imagen(
            video_writer, ultimo_frame, faltan, "", palabras_sub,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio,
            mostrar_marca_agua=mostrar_marca_agua
        )

    video_writer.release()

    if frame_contador == 0:
        print("Error: ningún fotograma generado.")
        sys.exit(1)

    ensamblar_con_ffmpeg(ffmpeg_bin, ruta_video_puro, ruta_audio, archivo_final, duracion_audio)

    if not os.path.exists(archivo_final) or os.path.getsize(archivo_final) < 1000:
        print("Error: MP4 final vacío.")
        sys.exit(1)

    print("¡Ensamble completado!")
    if os.path.exists(ruta_video_puro):
        try:
            os.remove(ruta_video_puro)
        except Exception:
            pass


def ensamblar_con_ffmpeg(ffmpeg_bin, ruta_video, ruta_audio, salida, duracion_audio=None):
    tiene_audio = ruta_audio and os.path.exists(ruta_audio)
    duracion_flag = ["-t", f"{duracion_audio:.3f}"] if tiene_audio and duracion_audio and duracion_audio > 0 else []
    estrategias = []

    if tiene_audio:
        estrategias.append([
            ffmpeg_bin, "-y", "-i", ruta_video, "-i", ruta_audio,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k",
            *duracion_flag,
            "-map", "0:v:0", "-map", "1:a:0", "-movflags", "+faststart", salida
        ])
    else:
        estrategias.append([
            ffmpeg_bin, "-y", "-i", ruta_video,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "22", salida
        ])

    ultimo_error = ""
    for i, args in enumerate(estrategias):
        print(f"FFmpeg intento {i + 1}/{len(estrategias)}...")
        result = subprocess.run(args, capture_output=True, text=True, check=False)
        if result.returncode == 0 and os.path.exists(salida) and os.path.getsize(salida) > 1000:
            print(f"FFmpeg exitoso en intento {i + 1}")
            return
        ultimo_error = (result.stderr or result.stdout or f"código {result.returncode}").strip()
        print(f"FFmpeg fallo intento {i + 1}: {ultimo_error[:300]}")

    print(f"Error crítico FFmpeg: {ultimo_error[:800]}")
    sys.exit(1)


if __name__ == '__main__':
    generar_video_cloud()
