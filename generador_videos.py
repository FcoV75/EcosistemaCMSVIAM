import os
import sys
import cv2
import numpy as np
import json
import argparse
import subprocess

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

def estampar_texto_nativo(img, texto, posicion, escala_fuente=1.2, color_texto=(0, 215, 255)):
    x, y = posicion
    # Sombra negra de fondo para garantizar legibilidad perfecta
    cv2.putText(img, texto, (x + 2, y + 2), cv2.FONT_HERSHEY_SIMPLEX, escala_fuente, (0, 0, 0), 3, cv2.LINE_AA)
    # Texto principal al frente
    cv2.putText(img, texto, (x, y), cv2.FONT_HERSHEY_SIMPLEX, escala_fuente, color_texto, 2, cv2.LINE_AA)
    return img

def generar_video_cloud():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/tmp/viam_uploads/render_config.json')
    parser.add_argument('--audio', default='/tmp/viam_uploads/audio_temp.mp3')
    parser.add_argument('--output', default='/tmp/video_viam_output.mp4')
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Error crítico: No se encontró el archivo de configuración en {args.config}")
        sys.exit(1)

    with open(args.config, 'r', encoding='utf-8') as f:
        config = json.load(f)

    linea_tiempo = config.get("linea_tiempo", [])
    ruta_portada = config.get("ruta_portada", "")
    ruta_cierre = config.get("ruta_cierre", "")
    leyenda_portada = config.get("leyenda_portada", "")
    leyenda_cierre = config.get("leyenda_cierre", "")
    ruta_audio = args.audio
    archivo_final = args.output

    # LIMPIEZA PREVENTIVA: Si existe un archivo final previo, lo borramos antes de compilar
    if os.path.exists(archivo_final):
        try:
            os.remove(archivo_final)
            print(f"Limpieza preventiva: Archivo antiguo {archivo_final} eliminado con éxito.")
        except Exception as e:
            print(f"Aviso en limpieza preventiva: {e}")

    WIDTH, HEIGHT = 1280, 720
    FPS = 30
    DURACION_BASE_FOTO = 5.0

    # 1. Medimos la duración real del audio usando subprocess
    duracion_audio = 0.0
    if ruta_audio and os.path.exists(ruta_audio):
        try:
            resultado = subprocess.run(
                ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', ruta_audio],
                capture_output=True,
                text=True,
                check=True
            )
            duracion_audio = float(resultado.stdout.strip())
        except Exception as e:
            print(f"Aviso en ffprobe: {e}. Usando duración por defecto.")
            duracion_audio = 30.0
    else:
        duracion_audio = 30.0

    # 2. Conteo seguro de imágenes de la línea de tiempo (Corregido de raíz)
    conteo_imagenes = 0
    if isinstance(linea_tiempo, list):
        for item in linea_tiempo:
            conteo_imagenes += 1
    
    if ruta_portada: conteo_imagenes += 1
    if ruta_cierre: conteo_imagenes += 1

    # 3. Distribución armónica del tiempo por cuadro
    if duracion_audio > 0 and conteo_imagenes > 0:
        duracion_por_foto = duracion_audio / conteo_imagenes
    else:
        duracion_por_foto = DURACION_BASE_FOTO

    if duracion_por_foto < 2.0:
        duracion_por_foto = 2.0

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    ruta_video_puro = "/tmp/visual_temp_raw.mp4"
    
    # Limpieza preventiva del archivo crudo de video
    if os.path.exists(ruta_video_puro):
        try: os.remove(ruta_video_puro)
        except: pass

    video_writer = cv2.VideoWriter(ruta_video_puro, fourcc, FPS, (WIDTH, HEIGHT))
    nombre_pista = os.path.basename(ruta_audio) if ruta_audio else "Producción Sincronía Nexus"
    frame_contador = 0

    # --- RENDERIZADO DE LA PORTADA ---
    if ruta_portada and os.path.exists(ruta_portada):
        img = cv2.imread(ruta_portada)
        if img is not None:
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
            frames_totales = int(round(FPS * duracion_por_foto))
            for _ in range(frames_totales):
                f_render = frame_base.copy()
                if leyenda_portada:
                    f_render = estampar_texto_nativo(f_render, leyenda_portada, (80, HEIGHT - 100), 1.2, (0, 215, 255))
                if (frame_contador // FPS) <= 15:
                    f_render = estampar_texto_nativo(f_render, f"Audio: {nombre_pista}", (40, 50), 0.8, (255, 255, 255))
                video_writer.write(f_render)
                frame_contador += 1

    # --- RENDERIZADO DE LAS IMÁGENES INTERMEDIAS ---
    if isinstance(linea_tiempo, list):
        for item in linea_tiempo:
            if not isinstance(item, dict): continue
            
            ruta_img = item.get("ruta", "")
            texto_subtitulo = item.get("texto", "")
            
            if ruta_img and os.path.exists(ruta_img):
                img = cv2.imread(ruta_img)
                if img is not None:
                    frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
                    frames_totales = int(round(FPS * duracion_por_foto)) 
                    for _ in range(frames_totales):
                        f_render = frame_base.copy()
                        
                        if texto_subtitulo:
                            f_render = estampar_texto_nativo(f_render, texto_subtitulo, (80, HEIGHT - 100), 1.1, (255, 255, 255))
                            
                        if (frame_contador // FPS) <= 15:
                            f_render = estampar_texto_nativo(f_render, f"Audio: {nombre_pista}", (40, 50), 0.8, (255, 255, 255))
                        video_writer.write(f_render)
                        frame_contador += 1

    # --- RENDERIZADO DEL CIERRE ---
    if ruta_cierre and os.path.exists(ruta_cierre):
        img = cv2.imread(ruta_cierre)
        if img is not None:
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
            frames_totales = int(round(FPS * duracion_por_foto))
            for _ in range(frames_totales):
                f_render = frame_base.copy()
                if leyenda_cierre:
                    f_render = estampar_texto_nativo(f_render, leyenda_cierre, (80, HEIGHT - 100), 1.2, (0, 215, 255))
                if (frame_contador // FPS) <= 15:
                    f_render = estampar_texto_nativo(f_render, f"Audio: {nombre_pista}", (40, 50), 0.8, (255, 255, 255))
                video_writer.write(f_render)
                frame_contador += 1

    video_writer.release()

    if frame_contador == 0:
        print("Error crítico: No se generó ningún fotograma. Verifique que las imágenes sean válidas.")
        sys.exit(1)

    if not os.path.exists(ruta_video_puro) or os.path.getsize(ruta_video_puro) < 1000:
        print("Error crítico: El video visual temporal está vacío.")
        sys.exit(1)

    # --- ENSAMBLE DE AUDIO Y VIDEO CON FFMPEG (SOPORTE DE SOBREESCRITURA TOTAL) ---
    if os.path.exists(ruta_audio):
        try:
            print("Iniciando ensamble definitivo de audio y video con FFmpeg...")
            subprocess.run([
                'ffmpeg', '-y', '-i', ruta_video_puro, '-i', ruta_audio, 
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 
                '-shortest', '-map', '0:v:0', '-map', '1:a:0', archivo_final
            ], capture_output=True, text=True, check=True)
            print("¡Ensamble de alta fidelidad completado exitosamente!")
        except Exception as e:
            print(f"Error ensamblando con audio: {e}")
            sys.exit(1)
    else:
        try:
            print("Iniciando ensamble de fallback (sin pista de audio)...")
            subprocess.run([
                'ffmpeg', '-y', '-i', ruta_video_puro, 
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', archivo_final
            ], capture_output=True, text=True, check=True)
            print("Ensamble de fallback completado.")
        except Exception as e:
            print(f"Error ensamblando video fallback: {e}")
            sys.exit(1)

    if not os.path.exists(archivo_final) or os.path.getsize(archivo_final) < 1000:
        print("Error crítico: El archivo MP4 final no se generó correctamente.")
        sys.exit(1)

    # Limpieza absoluta de temporales
    if os.path.exists(ruta_video_puro):
        try: os.remove(ruta_video_puro)
        except: pass

if __name__ == '__main__':
    generar_video_cloud()
