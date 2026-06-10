import os
import re
import sys
import shutil
import textwrap
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
            resultado = subprocess.run(
                [ffmpeg_bin, "-i", ruta_audio],
                capture_output=True, text=True, check=False
            )
            salida = (resultado.stderr or "") + (resultado.stdout or "")
            coincidencia = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", salida)
            if coincidencia:
                h, m, s = coincidencia.groups()
                return int(h) * 3600 + int(m) * 60 + float(s)
        except Exception as e:
            print(f"Aviso midiendo audio: {e}")
    return 30.0


def ajustar_proporcion_lienzo(img, ancho_objetivo=1280, alto_objetivo=720):
    alto_orig, ancho_orig = img.shape[:2]
    escala = min(ancho_objetivo / ancho_orig, alto_objetivo / alto_orig)
    nuevo_ancho = int(ancho_orig * escala)
    nuevo_alto = int(alto_orig * escala)
    img_redimensionada = cv2.resize(img, (nuevo_ancho, nuevo_alto), interpolation=cv2.INTER_AREA)
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


def estampar_bloque_subtitulo(img_bgr, texto, width, height, tamano=28):
    if not texto or not str(texto).strip():
        return img_bgr
    lineas = textwrap.wrap(str(texto).strip(), width=48)
    y_base = height - 30 - (len(lineas) * (tamano + 8))
    for i, linea in enumerate(lineas):
        y = y_base + i * (tamano + 8)
        if PIL_DISPONIBLE:
            overlay = img_bgr.copy()
            cv2.rectangle(overlay, (40, y - 8), (width - 40, y + tamano + 8), (0, 0, 0), -1)
            img_bgr = cv2.addWeighted(overlay, 0.55, img_bgr, 0.45, 0)
        img_bgr = estampar_texto_sombra(img_bgr, linea, (60, y), tamano=tamano, color=(255, 255, 255))
    return img_bgr


def crear_lienzo_portada_cierre(leyenda, width, height):
    lienzo = np.full((height, width, 3), (28, 28, 35), dtype=np.uint8)
    if leyenda:
        if PIL_DISPONIBLE:
            img_rgb = cv2.cvtColor(lienzo, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(img_rgb)
            draw = ImageDraw.Draw(pil)
            font = _fuente_pillow(42)
            bbox = draw.multiline_textbbox((0, 0), leyenda, font=font, align="center")
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            tx = (width - tw) // 2
            ty = (height - th) // 2
            for dx, dy in [(3, 3), (-2, 2)]:
                draw.multiline_text((tx + dx, ty + dy), leyenda, font=font, fill=(0, 0, 0), align="center")
            draw.multiline_text((tx, ty), leyenda, font=font, fill=(255, 215, 0), align="center")
            return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        lienzo = estampar_texto_sombra(lienzo, leyenda[:80], (80, height // 2), tamano=42)
    return lienzo


def escribir_frames_imagen(writer, frame_base, frames_totales, texto, letra_global, nombre_pista, frame_contador, fps, height):
    for _ in range(frames_totales):
        f_render = frame_base.copy()
        if texto:
            f_render = estampar_texto_sombra(f_render, texto, (80, height - 100), tamano=32)
        if letra_global:
            f_render = estampar_bloque_subtitulo(f_render, letra_global, 1280, height)
        if (frame_contador // fps) <= 15:
            f_render = estampar_texto_sombra(f_render, f"Audio: {nombre_pista}", (40, 50), tamano=24, color=(255, 255, 255))
        writer.write(f_render)
        frame_contador += 1
    return frame_contador


def escribir_frames_video(ruta_video, writer, duracion_asignada, texto, letra_global, nombre_pista, frame_contador, fps, width, height, silenciado):
    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        return frame_contador
    frames_objetivo = max(1, int(round(fps * duracion_asignada)))
    vfps = cap.get(cv2.CAP_PROP_FPS) or fps
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    paso = max(1, total_frames // frames_objetivo) if total_frames > frames_objetivo else 1
    leidos = 0
    idx = 0
    while leidos < frames_objetivo:
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(idx, max(0, total_frames - 1)))
        ok, frame = cap.read()
        if not ok:
            break
        frame = ajustar_proporcion_lienzo(frame, width, height)
        if texto:
            frame = estampar_texto_sombra(frame, texto, (80, height - 100), tamano=32)
        if letra_global:
            frame = estampar_bloque_subtitulo(frame, letra_global, width, height)
        if (frame_contador // fps) <= 15:
            frame = estampar_texto_sombra(frame, f"Audio: {nombre_pista}", (40, 50), tamano=24, color=(255, 255, 255))
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
    letra_global = letra_cancion if subtitulos_activos and letra_cancion else ""

    ruta_audio = args.audio
    archivo_final = args.output

    if os.path.exists(archivo_final):
        try:
            os.remove(archivo_final)
        except Exception:
            pass

    WIDTH, HEIGHT = 1280, 720
    FPS = 30
    DURACION_BASE_FOTO = 5.0

    ffmpeg_bin = resolver_ffmpeg()
    if not ffmpeg_bin:
        print("Error crítico: FFmpeg no disponible.")
        sys.exit(1)

    duracion_audio = obtener_duracion_audio(ruta_audio, ffmpeg_bin)
    print(f"Duración audio: {duracion_audio:.2f}s")

    segmentos = []
    if leyenda_portada or ruta_portada:
        segmentos.append({"tipo": "portada"})
    if isinstance(linea_tiempo, list):
        for item in linea_tiempo:
            if isinstance(item, dict):
                segmentos.append(item)
    if leyenda_cierre or ruta_cierre:
        segmentos.append({"tipo": "cierre"})

    conteo = max(1, len(segmentos))
    duracion_por_segmento = duracion_audio / conteo if duracion_audio > 0 else DURACION_BASE_FOTO
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
    nombre_pista = os.path.basename(ruta_audio) if ruta_audio else "VIAM"
    frame_contador = 0
    frames_totales = int(round(FPS * duracion_por_segmento))

    # Portada
    if leyenda_portada or ruta_portada:
        if ruta_portada and os.path.exists(ruta_portada):
            img = cv2.imread(ruta_portada)
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT) if img is not None else crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_portada, WIDTH, HEIGHT)
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_portada if ruta_portada and os.path.exists(ruta_portada) else "",
            letra_global, nombre_pista, frame_contador, FPS, HEIGHT
        )

    # Línea de tiempo
    for item in linea_tiempo:
        if not isinstance(item, dict):
            continue
        tipo = item.get("tipo", "imagen")
        ruta = item.get("ruta", "")
        texto = item.get("texto", "")
        silenciado = item.get("silenciado", True)
        if not ruta or not os.path.exists(ruta):
            continue
        if tipo == "video":
            frame_contador = escribir_frames_video(
                ruta, video_writer, duracion_por_segmento, texto, letra_global,
                nombre_pista, frame_contador, FPS, WIDTH, HEIGHT, silenciado
            )
        else:
            img = cv2.imread(ruta)
            if img is not None:
                frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
                frame_contador = escribir_frames_imagen(
                    video_writer, frame_base, frames_totales, texto, letra_global,
                    nombre_pista, frame_contador, FPS, HEIGHT
                )

    # Cierre
    if leyenda_cierre or ruta_cierre:
        if ruta_cierre and os.path.exists(ruta_cierre):
            img = cv2.imread(ruta_cierre)
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT) if img is not None else crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        else:
            frame_base = crear_lienzo_portada_cierre(leyenda_cierre, WIDTH, HEIGHT)
        frame_contador = escribir_frames_imagen(
            video_writer, frame_base, frames_totales, leyenda_cierre if ruta_cierre and os.path.exists(ruta_cierre) else "",
            letra_global, nombre_pista, frame_contador, FPS, HEIGHT
        )

    video_writer.release()

    if frame_contador == 0:
        print("Error: ningún fotograma generado.")
        sys.exit(1)

    if os.path.exists(ruta_audio):
        subprocess.run([
            ffmpeg_bin, '-y', '-i', ruta_video_puro, '-i', ruta_audio,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
            '-shortest', '-map', '0:v:0', '-map', '1:a:0', archivo_final
        ], capture_output=True, text=True, check=True)
    else:
        subprocess.run([
            ffmpeg_bin, '-y', '-i', ruta_video_puro,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', archivo_final
        ], capture_output=True, text=True, check=True)

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
