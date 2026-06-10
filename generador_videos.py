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

WIDTH, HEIGHT = 1920, 1080
FPS = 30


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


def estampar_subtitulo_linea(img_bgr, linea, width, height, tamano=34):
    if not linea or not str(linea).strip():
        return img_bgr
    linea = str(linea).strip()
    y = height - 90
    if PIL_DISPONIBLE:
        overlay = img_bgr.copy()
        cv2.rectangle(overlay, (50, y - 12), (width - 50, y + tamano + 16), (0, 0, 0), -1)
        img_bgr = cv2.addWeighted(overlay, 0.6, img_bgr, 0.4, 0)
    return estampar_texto_sombra(img_bgr, linea, (70, y), tamano=tamano, color=(255, 255, 255))


def crear_lienzo_portada_cierre(leyenda, width, height):
    lienzo = np.full((height, width, 3), (28, 28, 35), dtype=np.uint8)
    if leyenda and PIL_DISPONIBLE:
        img_rgb = cv2.cvtColor(lienzo, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil)
        font = _fuente_pillow(48)
        for dx, dy in [(3, 3), (-2, 2)]:
            draw.multiline_text((width // 2 + dx, height // 2 + dy), leyenda, font=font, fill=(0, 0, 0), anchor="mm", align="center")
        draw.multiline_text((width // 2, height // 2), leyenda, font=font, fill=(255, 215, 0), anchor="mm", align="center")
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    if leyenda:
        lienzo = estampar_texto_sombra(lienzo, leyenda[:120], (width // 2 - 200, height // 2), tamano=48)
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


def subtitulo_para_frame(lineas, segundo_actual, duracion_total):
    if not lineas or duracion_total <= 0:
        return ""
    idx = int((segundo_actual / duracion_total) * len(lineas))
    idx = min(max(idx, 0), len(lineas) - 1)
    return lineas[idx]


def debe_mostrar_nombre_pista(segundo_actual, duracion_total):
    if duracion_total <= 0:
        return segundo_actual <= 15
    return segundo_actual <= 12 or segundo_actual >= max(0, duracion_total - 12)


def aplicar_overlays(frame, segundo_actual, duracion_total, texto_escena, lineas_letra, subtitulos_on, nombre_pista):
    f = frame.copy()
    if texto_escena:
        f = estampar_texto_sombra(f, texto_escena, (80, HEIGHT - 130), tamano=36, color=(255, 215, 0))
    if subtitulos_on and lineas_letra:
        linea = subtitulo_para_frame(lineas_letra, segundo_actual, duracion_total)
        f = estampar_subtitulo_linea(f, linea, WIDTH, HEIGHT)
    if debe_mostrar_nombre_pista(segundo_actual, duracion_total):
        etiqueta = f"🎵 {nombre_pista}"
        f = estampar_texto_sombra(f, etiqueta, (50, 45), tamano=28, color=(255, 255, 255))
    return f


def escribir_frames_imagen(writer, frame_base, frames_totales, texto_escena, lineas_letra, subtitulos_on,
                           nombre_pista, frame_contador, duracion_total):
    for i in range(frames_totales):
        segundo = frame_contador / FPS
        f_render = aplicar_overlays(frame_base, segundo, duracion_total, texto_escena, lineas_letra, subtitulos_on, nombre_pista)
        writer.write(f_render)
        frame_contador += 1
    return frame_contador


def escribir_frames_video(ruta_video, writer, duracion_asignada, texto_escena, lineas_letra, subtitulos_on,
                          nombre_pista, frame_contador, duracion_total):
    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        return frame_contador
    frames_objetivo = max(1, int(round(FPS * duracion_asignada)))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    paso = max(1, total_frames // frames_objetivo) if total_frames > frames_objetivo else 1
    leidos = 0
    idx = 0
    while leidos < frames_objetivo:
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(idx, max(0, total_frames - 1)))
        ok, frame = cap.read()
        if not ok:
            break
        frame = ajustar_proporcion_lienzo(frame)
        segundo = frame_contador / FPS
        frame = aplicar_overlays(frame, segundo, duracion_total, texto_escena, lineas_letra, subtitulos_on, nombre_pista)
        writer.write(frame)
        frame_contador += 1
        leidos += 1
        idx += paso
    cap.release()
    return frame_contador


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

    lineas_letra = parsear_lineas_letra(letra_cancion) if subtitulos_activos else []

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

    # Portada — siempre muestra leyenda sobre imagen o lienzo
    if leyenda_portada or ruta_portada:
        if ruta_portada and os.path.exists(ruta_portada):
            img = cargar_imagen_alta_calidad(ruta_portada)
            frame_base = ajustar_proporcion_lienzo(img) if img is not None else crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_portada, lineas_letra,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio
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
            frame_contador = escribir_frames_video(
                ruta, video_writer, duracion_por_segmento, texto, lineas_letra,
                subtitulos_activos, nombre_pista, frame_contador, duracion_audio
            )
        else:
            img = cargar_imagen_alta_calidad(ruta)
            if img is not None:
                frame_base = ajustar_proporcion_lienzo(img)
                frame_contador = escribir_frames_imagen(
                    video_writer, frame_base, frames_totales, texto, lineas_letra,
                    subtitulos_activos, nombre_pista, frame_contador, duracion_audio
                )

    # Cierre — siempre muestra leyenda
    if leyenda_cierre or ruta_cierre:
        if ruta_cierre and os.path.exists(ruta_cierre):
            img = cargar_imagen_alta_calidad(ruta_cierre)
            frame_base = ajustar_proporcion_lienzo(img) if img is not None else crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_cierre, lineas_letra,
            subtitulos_activos, nombre_pista, frame_contador, duracion_audio
        )

    video_writer.release()

    if frame_contador == 0:
        print("Error: ningún fotograma generado.")
        sys.exit(1)

    encode_args = [
        ffmpeg_bin, '-y', '-i', ruta_video_puro,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
    ]
    if os.path.exists(ruta_audio):
        encode_args += ['-i', ruta_audio, '-c:a', 'aac', '-b:a', '192k',
                        '-shortest', '-map', '0:v:0', '-map', '1:a:0', archivo_final]
    else:
        encode_args += [archivo_final]

    subprocess.run(encode_args, capture_output=True, text=True, check=True)

    if not os.path.exists(archivo_final) or os.path.getsize(archivo_final) < 1000:
        print("Error: MP4 final vacío.")
        sys.exit(1)

    print("¡Ensamble de alta fidelidad completado exitosamente!")
    if os.path.exists(ruta_video_puro):
        try:
            os.remove(ruta_video_puro)
        except Exception:
            pass


if __name__ == '__main__':
    generar_video_cloud()
