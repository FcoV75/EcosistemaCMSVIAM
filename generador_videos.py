import os
import re
import sys
import shutil
import cv2
import numpy as np
import json
import argparse
import subprocess

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_DISPONIBLE = True
except ImportError:
    PIL_DISPONIBLE = False

WIDTH, HEIGHT = 1280, 720  # Estable en Railway; CRF 18 mantiene buena calidad
FPS = 30

# Tamaños de texto legibles en pantalla completa
TAM_LEYENDA_PORTADA = 68
TAM_SUBTITULO = 52
TAM_NOMBRE_PISTA = 46
TAM_TEXTO_ESCENA = 40


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
    if img is None:
        return None
    return img


def ajustar_proporcion_lienzo(img, ancho_objetivo=WIDTH, alto_objetivo=HEIGHT):
    alto_orig, ancho_orig = img.shape[:2]
    escala = min(ancho_objetivo / ancho_orig, alto_objetivo / alto_orig)
    nuevo_ancho = int(ancho_orig * escala)
    nuevo_alto = int(alto_orig * escala)
    interp = cv2.INTER_LANCZOS4 if escala > 1.0 else cv2.INTER_AREA
    img_redimensionada = cv2.resize(img, (nuevo_ancho, nuevo_alto), interpolation=interp)
    lienzo = np.zeros((alto_objetivo, ancho_objetivo, 3), dtype=np.uint8)
    x_offset = (ancho_objetivo - nuevo_ancho) // 2
    y_offset = (alto_objetivo - nuevo_alto) // 2
    lienzo[y_offset:y_offset + nuevo_alto, x_offset:x_offset + nuevo_ancho] = img_redimensionada
    return lienzo


def _fuente_pillow(tamano):
    rutas = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for ruta in rutas:
        if os.path.exists(ruta):
            try:
                return ImageFont.truetype(ruta, tamano)
            except Exception:
                continue
    return ImageFont.load_default()


def estampar_texto_sombra(img_bgr, texto, posicion, tamano=36, color=(255, 215, 0)):
    if not texto or not str(texto).strip():
        return img_bgr
    texto = str(texto).strip()
    x, y = posicion
    if PIL_DISPONIBLE:
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil)
        font = _fuente_pillow(tamano)
        for dx, dy in [(3, 3), (-2, 2), (2, -2)]:
            draw.text((x + dx, y + dy), texto, font=font, fill=(0, 0, 0))
        draw.text((x, y), texto, font=font, fill=(color[2], color[1], color[0]))
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    cv2.putText(img_bgr, texto, (x + 2, y + 2), cv2.FONT_HERSHEY_SIMPLEX, tamano / 40, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(img_bgr, texto, (x, y), cv2.FONT_HERSHEY_SIMPLEX, tamano / 40, color, 2, cv2.LINE_AA)
    return img_bgr


def estampar_subtitulo_linea(img_bgr, linea, width, height, tamano=TAM_SUBTITULO):
    if not linea or not str(linea).strip():
        return img_bgr
    linea = str(linea).strip()
    y = height - 105
    if PIL_DISPONIBLE:
        overlay = img_bgr.copy()
        cv2.rectangle(overlay, (40, y - 18), (width - 40, y + tamano + 22), (0, 0, 0), -1)
        img_bgr = cv2.addWeighted(overlay, 0.65, img_bgr, 0.35, 0)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil)
        font = _fuente_pillow(tamano)
        bbox = draw.textbbox((0, 0), linea, font=font)
        text_w = bbox[2] - bbox[0]
        x = max(50, (width - text_w) // 2)
        for dx, dy in [(3, 3), (-2, 2), (2, -2)]:
            draw.text((x + dx, y + dy), linea, font=font, fill=(0, 0, 0))
        draw.text((x, y), linea, font=font, fill=(255, 255, 255))
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return estampar_texto_sombra(img_bgr, linea, (70, y), tamano=tamano, color=(255, 255, 255))


def estampar_leyenda_grande(img_bgr, texto, width, height, tamano=TAM_LEYENDA_PORTADA):
    """Leyenda de portada/cierre: grande y centrada sobre la imagen."""
    if not texto or not str(texto).strip():
        return img_bgr
    texto = str(texto).strip()
    if PIL_DISPONIBLE:
        overlay = img_bgr.copy()
        cv2.rectangle(overlay, (60, height // 2 - 90), (width - 60, height // 2 + 90), (0, 0, 0), -1)
        img_bgr = cv2.addWeighted(overlay, 0.45, img_bgr, 0.55, 0)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil)
        font = _fuente_pillow(tamano)
        for dx, dy in [(4, 4), (-3, 3), (3, -3)]:
            draw.multiline_text((width // 2 + dx, height // 2 + dy), texto, font=font, fill=(0, 0, 0), anchor="mm", align="center")
        draw.multiline_text((width // 2, height // 2), texto, font=font, fill=(255, 215, 0), anchor="mm", align="center")
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return estampar_texto_sombra(img_bgr, texto[:160], (width // 2 - 280, height // 2 - 40), tamano=tamano)


def crear_lienzo_portada_cierre(leyenda, width, height):
    lienzo = np.full((height, width, 3), (28, 28, 35), dtype=np.uint8)
    if leyenda:
        return estampar_leyenda_grande(lienzo, leyenda, width, height)
    return lienzo


def parsear_lineas_letra(letra):
    if not letra:
        return []
    lineas = []
    for raw in letra.replace("\r", "").split("\n"):
        t = raw.strip()
        if t:
            lineas.append(t)
    if not lineas and letra.strip():
        lineas = [s.strip() for s in re.split(r'[.!?]+', letra) if s.strip()]
    return lineas


def construir_intervalos_lineas(lineas, duracion_total):
    """Distribuye la letra proporcional al largo de cada línea (mejor sync con el canto)."""
    if not lineas or duracion_total <= 0:
        return []
    pesos = [max(len(re.sub(r"\s+", " ", ln)), 8) for ln in lineas]
    total_peso = float(sum(pesos))
    intervalos = []
    t = 0.0
    for linea, peso in zip(lineas, pesos):
        dur = (peso / total_peso) * duracion_total
        intervalos.append({"start": t, "end": t + dur, "text": linea})
        t += dur
    if intervalos:
        intervalos[-1]["end"] = duracion_total
    return intervalos


def normalizar_segmentos_letra(segmentos_raw, duracion_total):
    if not segmentos_raw or duracion_total <= 0:
        return []
    intervalos = []
    for seg in segmentos_raw:
        if not isinstance(seg, dict):
            continue
        texto = str(seg.get("text", "")).strip()
        if not texto:
            continue
        try:
            inicio = max(0.0, float(seg.get("start", 0)))
            fin = min(duracion_total, float(seg.get("end", inicio + 1)))
        except (TypeError, ValueError):
            continue
        if fin <= inicio:
            fin = min(duracion_total, inicio + 1.5)
        intervalos.append({"start": inicio, "end": fin, "text": texto})
    intervalos.sort(key=lambda x: x["start"])
    return intervalos


def subtitulo_para_frame(intervalos, segundo_actual):
    if not intervalos:
        return ""
    for seg in intervalos:
        if seg["start"] <= segundo_actual < seg["end"]:
            return seg["text"]
    if segundo_actual >= intervalos[-1]["start"]:
        return intervalos[-1]["text"]
    return intervalos[0]["text"]


def debe_mostrar_nombre_pista(segundo_actual, duracion_total):
    if duracion_total <= 0:
        return segundo_actual <= 15
    return segundo_actual <= 12 or segundo_actual >= max(0, duracion_total - 12)


def aplicar_overlays(frame, segundo_actual, duracion_total, texto_escena, intervalos_sub, subtitulos_on,
                     nombre_pista, leyenda_grande=False):
    f = frame.copy()
    if texto_escena:
        if leyenda_grande:
            f = estampar_leyenda_grande(f, texto_escena, WIDTH, HEIGHT)
        else:
            f = estampar_texto_sombra(f, texto_escena, (80, HEIGHT - 145), tamano=TAM_TEXTO_ESCENA, color=(255, 215, 0))
    if subtitulos_on and intervalos_sub:
        linea = subtitulo_para_frame(intervalos_sub, segundo_actual)
        f = estampar_subtitulo_linea(f, linea, WIDTH, HEIGHT)
    if debe_mostrar_nombre_pista(segundo_actual, duracion_total):
        etiqueta = f"🎵 {nombre_pista}"
        if PIL_DISPONIBLE:
            img_rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(img_rgb)
            draw = ImageDraw.Draw(pil)
            font = _fuente_pillow(TAM_NOMBRE_PISTA)
            for dx, dy in [(3, 3), (-2, 2)]:
                draw.text((52 + dx, 42 + dy), etiqueta, font=font, fill=(0, 0, 0))
            draw.text((52, 42), etiqueta, font=font, fill=(255, 255, 255))
            f = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        else:
            f = estampar_texto_sombra(f, etiqueta, (50, 45), tamano=TAM_NOMBRE_PISTA, color=(255, 255, 255))
    return f


def escribir_frames_imagen(writer, frame_base, frames_totales, texto_escena, intervalos_sub, subtitulos_on,
                           nombre_pista, frame_contador, duracion_total, leyenda_grande=False):
    for _ in range(frames_totales):
        segundo = frame_contador / FPS
        f_render = aplicar_overlays(
            frame_base, segundo, duracion_total, texto_escena, intervalos_sub,
            subtitulos_on, nombre_pista, leyenda_grande=leyenda_grande
        )
        writer.write(f_render)
        frame_contador += 1
    return frame_contador


def escribir_frames_video(ruta_video, writer, duracion_asignada, texto_escena, intervalos_sub, subtitulos_on,
                          nombre_pista, frame_contador, duracion_total):
    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        return frame_contador, None
    frames_objetivo = max(1, int(round(FPS * duracion_asignada)))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    paso = max(1, total_frames // frames_objetivo) if total_frames > frames_objetivo else 1
    leidos = 0
    idx = 0
    ultimo = None
    while leidos < frames_objetivo:
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(idx, max(0, total_frames - 1)))
        ok, frame = cap.read()
        if not ok:
            break
        frame = ajustar_proporcion_lienzo(frame)
        segundo = frame_contador / FPS
        frame = aplicar_overlays(frame, segundo, duracion_total, texto_escena, intervalos_sub, subtitulos_on, nombre_pista)
        writer.write(frame)
        ultimo = frame.copy()
        frame_contador += 1
        leidos += 1
        idx += paso
    while leidos < frames_objetivo and ultimo is not None:
        segundo = frame_contador / FPS
        frame = aplicar_overlays(ultimo, segundo, duracion_total, texto_escena, intervalos_sub, subtitulos_on, nombre_pista)
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
    leyenda_portada = config.get("leyenda_portada", "")
    leyenda_cierre = config.get("leyenda_cierre", "")
    letra_cancion = config.get("letra_cancion", "")
    letra_segmentos = config.get("letra_segmentos", [])
    subtitulos_activos = config.get("subtitulos_activos", False)
    nombre_pista = config.get("nombre_pista", "") or "Pista VIAM"

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

    duracion_audio = obtener_duracion_audio(ruta_audio, ffmpeg_bin)
    print(f"Duración audio: {duracion_audio:.2f}s | Pista: {nombre_pista}")

    if subtitulos_activos and letra_segmentos:
        intervalos_sub = normalizar_segmentos_letra(letra_segmentos, duracion_audio)
    elif subtitulos_activos:
        lineas_letra = parsear_lineas_letra(letra_cancion)
        intervalos_sub = construir_intervalos_lineas(lineas_letra, duracion_audio)
    else:
        intervalos_sub = []

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

    # Portada — leyenda grande sobre imagen o lienzo
    if leyenda_portada or ruta_portada:
        if ruta_portada and os.path.exists(ruta_portada):
            img = cargar_imagen_alta_calidad(ruta_portada)
            frame_base = ajustar_proporcion_lienzo(img) if img is not None else crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        ultimo_frame = frame_base.copy()
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_portada, intervalos_sub,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio, leyenda_grande=bool(leyenda_portada)
        )

    for item in linea_tiempo:
        if not isinstance(item, dict):
            continue
        tipo = item.get("tipo", "imagen")
        ruta = item.get("ruta", "")
        texto = item.get("texto", "")
        if not ruta or not os.path.exists(ruta):
            continue
        if tipo == "video":
            frame_contador, ultimo_vid = escribir_frames_video(
                ruta, video_writer, duracion_por_segmento, texto, intervalos_sub,
                subtitulos_activos, nombre_pista, frame_contador, duracion_audio
            )
            if ultimo_vid is not None:
                ultimo_frame = ultimo_vid
        else:
            img = cargar_imagen_alta_calidad(ruta)
            if img is not None:
                frame_base = ajustar_proporcion_lienzo(img)
                ultimo_frame = frame_base.copy()
                frame_contador = escribir_frames_imagen(
                    video_writer, frame_base, frames_totales, texto, intervalos_sub,
                    subtitulos_activos, nombre_pista, frame_contador, duracion_audio
                )

    # Cierre — leyenda grande
    if leyenda_cierre or ruta_cierre:
        if ruta_cierre and os.path.exists(ruta_cierre):
            img = cargar_imagen_alta_calidad(ruta_cierre)
            frame_base = ajustar_proporcion_lienzo(img) if img is not None else crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        ultimo_frame = frame_base.copy()
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_cierre, intervalos_sub,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio, leyenda_grande=bool(leyenda_cierre)
        )

    # Rellenar hasta cubrir toda la pista musical (evita corte abrupto del audio)
    frames_objetivo_total = max(1, int(round(FPS * duracion_audio)))
    if ultimo_frame is not None and frame_contador < frames_objetivo_total:
        faltan = frames_objetivo_total - frame_contador
        print(f"Extendiendo {faltan} fotogramas para igualar audio ({duracion_audio:.2f}s)")
        frame_contador = escribir_frames_imagen(
            video_writer, ultimo_frame, faltan, "", intervalos_sub,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio
        )

    video_writer.release()

    if frame_contador == 0:
        print("Error: ningún fotograma generado.")
        sys.exit(1)

    ensamblar_con_ffmpeg(ffmpeg_bin, ruta_video_puro, ruta_audio, archivo_final, duracion_audio)

    if not os.path.exists(archivo_final) or os.path.getsize(archivo_final) < 1000:
        print("Error: MP4 final vacío.")
        sys.exit(1)

    print("¡Ensamble de alta fidelidad completado exitosamente!")
    if os.path.exists(ruta_video_puro):
        try:
            os.remove(ruta_video_puro)
        except Exception:
            pass


def ensamblar_con_ffmpeg(ffmpeg_bin, ruta_video, ruta_audio, salida, duracion_audio=None):
    """Ensambla video + audio; la duración la marca la pista musical completa."""
    tiene_audio = ruta_audio and os.path.exists(ruta_audio)
    duracion_flag = []
    if tiene_audio and duracion_audio and duracion_audio > 0:
        duracion_flag = ["-t", f"{duracion_audio:.3f}"]
    estrategias = []

    if tiene_audio:
        estrategias.append([
            ffmpeg_bin, "-y", "-i", ruta_video, "-i", ruta_audio,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            *duracion_flag,
            "-map", "0:v:0", "-map", "1:a:0", "-movflags", "+faststart", salida
        ])
        estrategias.append([
            ffmpeg_bin, "-y", "-i", ruta_video, "-i", ruta_audio,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            *duracion_flag,
            "-map", "0:v:0", "-map", "1:a:0", salida
        ])
    else:
        estrategias.append([
            ffmpeg_bin, "-y", "-i", ruta_video,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", salida
        ])

    estrategias.append([
        ffmpeg_bin, "-y", "-i", ruta_video,
        *(["-i", ruta_audio] if tiene_audio else []),
        "-c:v", "mpeg4", "-q:v", "2",
        *(["-c:a", "aac"] if tiene_audio else []),
        *duracion_flag,
        *(["-map", "0:v:0", "-map", "1:a:0"] if tiene_audio else []),
        salida
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
