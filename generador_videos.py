import os
import cv2
import numpy as np
import json
import argparse

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
        return

    with open(args.config, 'r', encoding='utf-8') as f:
        config = json.load(f)

    linea_tiempo = config.get("linea_tiempo", [])
    ruta_portada = config.get("ruta_portada", "")
    ruta_cierre = config.get("ruta_cierre", "")
    leyenda_portada = config.get("leyenda_portada", "")
    leyenda_cierre = config.get("leyenda_cierre", "")
    ruta_audio = args.audio

    WIDTH, HEIGHT = 1280, 720
    FPS = 30
    DURACION_BASE_FOTO = 5.0

    # 1. Medimos de forma precisa la duración real del archivo de audio MP3
    duracion_audio = 0.0
    if ruta_audio and os.path.exists(ruta_audio):
        try:
            cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{ruta_audio}"'
            duracion_audio = float(os.popen(cmd).read().strip())
        except:
            duracion_audio = 30.0
    else:
        duracion_audio = 30.0

    # 2. SISTEMA ULTRA-RESISTENTE: Contamos de forma segura los nodos válidos
    conteo_imagenes = 0
    if isinstance(linea_tiempo, list):
        for item in linea_tiempo:
            if isinstance(item, dict) and item.get("ruta"):
                conteo_imagenes += 1
            elif isinstance(item, dict):
                # Si viene el nodo pero la ruta se está procesando, la contamos para mantener la simetría
                conteo_imagenes += 1
    
    if ruta_portada: conteo_imagenes += 1
    if ruta_cierre: conteo_imagenes += 1

    # 3. Calculamos una distribución del tiempo milimétrica y armónica
    if duracion_audio > 0 and conteo_imagenes > 0:
        duracion_por_foto = duracion_audio / conteo_imagenes
    else:
        duracion_por_foto = DURACION_BASE_FOTO

    # Forzamos un límite mínimo de tiempo por imagen para evitar transiciones traumáticas
    if duracion_por_foto < 2.0:
        duracion_por_foto = 2.0

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    ruta_video_puro = "/tmp/visual_temp_raw.mp4"
    video_writer = cv2.VideoWriter(ruta_video_puro, fourcc, FPS, (WIDTH, HEIGHT))
    
    nombre_pista = os.path.basename(ruta_audio) if ruta_audio else "Producción Sincronía Nexus"
    frame_contador = 0

    # --- RENDERIZADO DE LA PORTADA ---
    if ruta_portada and os.path.exists(ruta_portada):
        img = cv2.imread(ruta_portada)
        if img is not None:
            frame_base = ajustar_proporcion_lienzo(img, WIDTH, HEIGHT)
            # Cambiamos esto en tu script de renderizado:
            frames_totales = int(round(FPS * duracion_por_foto))
            for _ in range(frames_totales):
                f_render = frame_base.copy()
                if leyenda_portada:
                    f_render = estampar_texto_nativo(f_render, leyenda_portada, (80, HEIGHT - 100), 1.2, (0, 215, 255))
                if (frame_contador // FPS) <= 15:
                    f_render = estampar_texto_nativo(f_render, f"Audio: {nombre_pista}", (40, 50), 0.8, (255, 255, 255))
                video_writer.write(f_render)
                frame_contador += 1

    # --- RENDERIZADO DE LAS IMÁGENES INTERMEDIAS CON SUBTÍTULOS DINÁMICOS ---
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
                        
                            # Si la celda contiene subtítulos añadidos por el usuario, los estampamos en tiempo real
                        if texto_subtitulo:
                            f_render = estampar_texto_nativo(f_render, texto_subtitulo, (80, HEIGHT - 100), 1.1, (255, 255, 255))
                            
                        if (frame_contador // FPS) <= 15:
                            f_render = estampar_texto_nativo(f_render, f"Audio: {nombre_pista}", (40, 50), 0.8, (255, 255, 255))
                        video_writer.write(f_render)
                        frame_contador += 1

    # --- RENDERIZADO DEL CIERRE ---
   async function generarVideo() {
    // 1. Validamos que existan los archivos obligatorios en tu interfaz
    if (!audioFile) {
        alert("Por favor, selecciona un archivo de audio primero.");
        return;
    }
    if (!selectedImages || selectedImages.length === 0) {
        alert("Por favor, selecciona al menos una imagen para la línea de tiempo.");
        return;
    }

    const statusText = document.getElementById("status-text");
    statusText.innerText = "Sincronizando archivos y empaquetando proyecto Diamante...";
    document.getElementById("loading-box").style.display = "block";

    const formData = new FormData();
    
    // 2. Adjuntamos el archivo de audio real
    formData.append("audio", audioFile);
    
    // 3. Construimos la estructura de la línea de tiempo limpia para Python
    const listaLineaTiempo = [];

    // Recorremos tus imágenes seleccionadas de forma directa
    selectedImages.forEach((img, index) => {
        // Busmamos si hay un subtítulo escrito en la interfaz para este índice
        const inputsSubtitulos = document.querySelectorAll('.input-subtitulo');
        const textoSubtitulo = (inputsSubtitulos && inputsSubtitulos[index]) ? inputsSubtitulos[index].value : "";

        // Creamos el diccionario exacto que Python espera leer
        listaLineaTiempo.push({
            id: index,
            texto: textoSubtitulo,
            duracion: 5.0
        });

        // Adjuntamos el archivo binario real de la imagen
        formData.append(`imagen_${index}`, img);
    });

    // Convertimos la estructura de control a texto JSON para evitar fallos de lectura
    formData.append("linea_tiempo", JSON.stringify(listaLineaTiempo));

    // Capturamos las leyendas de los extremos si existen en tu panel
    const txtPortada = document.getElementById("texto-portada");
    const txtCierre = document.getElementById("texto-cierre");
    formData.append("leyenda_portada", txtPortada ? txtPortada.value : "");
    formData.append("leyenda_cierre", txtCierre ? txtCierre.value : "");

    try {
        statusText.innerText = "Transmitiendo datos al servidor de VIAM...";
        
        const respuesta = await fetch("https://ecosistemacmsviam-production.up.railway.app/renderizar", {
            method: "POST",
            body: formData
        });

        const datos = await respuesta.json();

        if (respuesta.status === 200 || respuesta.status === 202) {
            statusText.innerText = "¡Proyecto recibido en la nube! Procesando video en segundo plano...";
            verificarEstatusRenderizado();
        } else {
            statusText.innerText = "Error: " + (datos.detalle || "Error de procesamiento");
            alert("El motor reportó un detalle: " + (datos.detalle || "Revisa la configuración del proyecto"));
            document.getElementById("loading-box").style.display = "none";
        }
    } catch (error) {
        console.error("Error crítico de comunicación:", error);
        statusText.innerText = "Sincronizando con el canal de renderizado de fondo...";
        verificarEstatusRenderizado();
    }
}

function verificarEstatusRenderizado() {
    const statusText = document.getElementById("status-text");
    
    if (window.renderInterval) {
        clearInterval(window.renderInterval);
    }

    window.renderInterval = setInterval(async () => {
        try {
            const respuesta = await fetch("https://ecosistemacmsviam-production.up.railway.app/status");
            const datos = await respuesta.json();

            console.log("Estatus recibido de la nube:", datos.status);

            if (datos.status === "procesando") {
                statusText.innerText = `Renderizando: ${datos.detalle || 'Sincronizando transiciones fluidas...'}`;
            } 
            else if (datos.status === "listo") {
                clearInterval(window.renderInterval);
                statusText.innerText = "¡Video Diamante procesado con éxito! Iniciando descarga nativa...";
                
                window.location.href = "https://ecosistemacmsviam-production.up.railway.app/descargar";
                
                setTimeout(() => {
                    document.getElementById("loading-box").style.display = "none";
                }, 5000);
            } 
            else if (datos.status === "error") {
                clearInterval(window.renderInterval);
                statusText.innerText = `Fallo en el motor: ${datos.detalle}`;
                alert("El renderizador de fondo se detuvo: " + datos.detalle);
                document.getElementById("loading-box").style.display = "none";
            }
        } catch (error) {
            console.log("Sincronizando con el servidor de fondo de VIAM...");
        }
    }, 4000);
}
    # --- ENSAMBLE DE AUDIO Y VIDEO CON FFMPEG (ALTA FIDELIDAD) ---
    archivo_final = args.output
    if os.path.exists(ruta_audio):
        cmd_mix = f'ffmpeg -y -i "{ruta_video_puro}" -i "{ruta_audio}" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -map 0:v:0 -map 1:a:0 "{archivo_final}"'
        os.system(cmd_mix)
    else:
        if os.path.exists(archivo_final): 
            try: os.remove(archivo_final)
            except: pass
        # Si no hay audio, convertimos el crudo al formato final ejecutable
        cmd_fallback = f'ffmpeg -y -i "{ruta_video_puro}" -c:v libx264 -pix_fmt yuv420p "{archivo_final}"'
        os.system(cmd_fallback)

    # Limpieza absoluta de temporales en la máquina virtual
    if os.path.exists(ruta_video_puro):
        try: os.remove(ruta_video_puro)
        except: pass

if __name__ == '__main__':
    generar_video_cloud()
