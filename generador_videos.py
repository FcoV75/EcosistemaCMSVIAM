import os
import cv2
import numpy as np
import json
import argparse
from PIL import Image, ImageDraw, ImageFont

def ajustar_proporcion_lienzo(img, ancho_objetivo=1280, alto_objetivo=720):
    alto_orig, ancho_orig = img.shape[:2]
    escala = min(ancho_objetivo / ancho_orig, alto_objetivo / alto_orig)
    nuevo_ancho = int(ancho_orig * escala)
    nuevo_alto = int(alto_orig * escala)
    
    img_redimensionada = cv2.resize(img, (nuevo_ancho, nuevo_alto), interpolation=cv2.INTER_AREA)
    lienzo = np.zeros((alto_objetivo, ancho_objetivo, 3), dtype=np.uint8)
    
    x_offset = (ancho_objetivo - nuevo_ancho) // 2
    y_offset = (alto_objetivo - nuevo_alto) // 2
    lienzo[y_offset:y_offset+nuevo_alto, x_offset:x_offset+nuevo_ancho] = img_redimensionada
    return lienzo

def estampar_texto_con_sombra(img, texto, posicion, tamano_fuente, color_texto):
    img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(img_pil)
    
    try:
        fuente = ImageFont.truetype("arial.ttf", tamano_fuente)
    except IOError:
        fuente = ImageFont.load_default()
        
    x, y = posicion
    # Estampar la sombra negra corrida para alta legibilidad
    draw.text((x + 2, y + 2), texto, font=fuente, fill=(0, 0, 0))
    # Estampar el texto original
    draw.text((x, y), texto, font=fuente, fill=color_texto)
    
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

def generar_video_cloud():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='temp_uploads/render_config.json')
    parser.add_argument('--audio', default='temp_uploads/audio_temp.mp3')
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Error: No se encontró el mapa de configuración {args.config}")
        return

    with open(args.config, 'r', encoding='utf-8') as f:
        config = json.load(f)

    linea_tiempo = config.get("linea_tiempo", [])
    ruta_portada = config.get("ruta_portada", "")
    ruta_cierre = config.get("ruta_cierre", "")
    leyenda_portada = config.get("leyenda_portada", "")
    leyenda_cierre = config.get("leyenda_cierre", "")
    ruta_audio = args.audio

    # Parámetros estándar HD fijos para el renderizador en la nube
    WIDTH, HEIGHT = 1280, 720
    FPS = 30
    DURACION_BASE_FOTO = 4.0

    # 1. Calcular duración total del audio
    duracion_audio = 0.0
    if ruta_audio and os.path.exists(ruta_audio):
        try:
            # Comando ágil para extraer los metadatos exactos de duración del audio
            cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{ruta_audio}"'
            resultado = os.popen(cmd).read().strip()
            duracion_audio = float(resultado)
        except:
            duracion_audio = 30.0 # Caída de seguridad por defecto si falla ffprobe
    else:
        duracion_audio = 30.0

    # 2. Calcular la duración de los videos intermedios
    duracion_videos = 0.0
    conteo_imagenes = 0
    if ruta_portada: conteo_imagenes += 1
    if ruta_cierre: conteo_imagenes += 1

    for item in linea_tiempo:
        if item['tipo'] == 'img':
            conteo_imagenes += 1
        elif item['tipo'] == 'vid' and os.path.exists(item['ruta']):
            cap = cv2.VideoCapture(item['ruta'])
            v_fps = cap.get(cv2.CAP_PROP_FPS)
            v_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            if v_fps > 0:
                duracion_videos += (v_frames / v_fps)
            cap.release()

    # 3. Lógica matemática de sincronización exacta (Evita cortes y errores lógicos)
    duracion_restante = duracion_audio - duracion_videos
    if duracion_restante > 0 and conteo_imagenes > 0:
        duracion_por_foto = duracion_restante / conteo_imagenes
    else:
        duracion_por_foto = DURACION_BASE_FOTO

    if duracion_por_foto < 2.0:
        duracion_por_foto = 2.0

    # Preparar el archivo de video visual temporal
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    ruta_video_puro = "visual_temp.mp4"
    video_writer = cv2.VideoWriter(ruta_video_puro, fourcc, FPS, (WIDTH, HEIGHT))
    
    nombre_pista = os.path.basename(ruta_audio) if ruta_audio else "Producción VIAM"
    frame_contador = 0

    # --- PROCESAR PORTADA ---
    if ruta_portada and os.path.exists(ruta_portada):
        img = cv2.imread(ruta_portada)
        if img is not None:
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
            if leyenda_portada:
                frame_base = estampar_texto_con_sombra(frame_base, leyenda_portada, (80, HEIGHT - 130), 38, (255, 215, 0))
            
            frames_totales = int(FPS * duracion_por_foto)
            for _ in range(frames_totales):
                seg_global = frame_contador // FPS
                f_render = frame_base.copy()
                if seg_global <= 15:
                    f_render = estampar_texto_con_sombra(f_render, f"🎵 {nombre_pista}", (40, 40), 20, (255, 255, 255))
                video_writer.write(f_render)
                frame_contador += 1

    # --- PROCESAR SECUENCIA INTERMEDIA ---
    for item in linea_tiempo:
        if not os.path.exists(item['ruta']): continue
        
        if item['tipo'] == 'img':
            img = cv2.imread(item['ruta'])
            if img is not None:
                frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
                frames_totales = int(FPS * duracion_por_foto)
                for _ in range(frames_totales):
                    seg_global = frame_contador // FPS
                    f_render = frame_base.copy()
                    if seg_global <= 15:
                        f_render = estampar_texto_con_sombra(f_render, f"🎵 {nombre_pista}", (40, 40), 20, (255, 255, 255))
                    video_writer.write(f_render)
                    frame_contador += 1
                    
        elif item['tipo'] == 'vid':
            cap = cv2.VideoCapture(item['ruta'])
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break
                frame_base = ajustar_proporcion_lienzo(frame, WIDTH, HEIGHT)
                seg_global = frame_contador // FPS
                if seg_global <= 15:
                    frame_base = estampar_texto_con_sombra(frame_base, f"🎵 {nombre_pista}", (40, 40), 20, (255, 255, 255))
                video_writer.write(frame_base)
                frame_contador += 1
            cap.release()

    # --- PROCESAR CIERRE FINAL ---
    if ruta_cierre and os.path.exists(ruta_cierre):
        img = cv2.imread(ruta_cierre)
        if img is not None:
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
            if leyenda_cierre:
                frame_base = estampar_texto_con_sombra(frame_base, leyenda_cierre, (80, HEIGHT - 130), 38, (255, 215, 0))
            
            frames_totales = int(FPS * duracion_por_foto)
            for _ in range(frames_totales):
                seg_global = frame_contador // FPS
                f_render = frame_base.copy()
                if seg_global <= 15:
                    f_render = estampar_texto_con_sombra(f_render, f"🎵 {nombre_pista}", (40, 40), 20, (255, 255, 255))
                video_writer.write(f_render)
                frame_contador += 1

    video_writer.release()

    # --- MEZCLA FINAL DE ALTA FIDELIDAD CON FFMPGE ---
    archivo_final = "video_output.mp4"
    if os.path.exists(ruta_audio):
        # Comando estructurado para renderizado síncrono compatible con cualquier reproductor web/móvil
        cmd_mix = f'ffmpeg -y -i "{ruta_video_puro}" -i "{ruta_audio}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "{archivo_final}"'
        os.system(cmd_mix)
    else:
        if os.path.exists(archivo_final): os.remove(archivo_final)
        os.rename(ruta_video_puro, archivo_final)

    # Limpieza de temporales individuales
    if os.path.exists(ruta_video_puro):
        try: os.remove(ruta_video_puro)
        except: pass

    print("¡Proceso de renderizado en la nube completado exitosamente!")

if __name__ == '__main__':
    generar_video_cloud()
