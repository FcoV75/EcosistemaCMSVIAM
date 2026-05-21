from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os
import json
import werkzeug

app = Flask(__name__)
CORS(app)

# Configuración de carpetas de almacenamiento temporal
UPLOAD_FOLDER = "temp_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Diccionario global para rastrear el estado del renderizado
ESTADO_PROCESO = {"status": "libre", "detalle": ""}

def ejecutar_renderizador(config_path, audio_path):
    global ESTADO_PROCESO
    try:
        ESTADO_PROCESO["status"] = "procesando"
        ESTADO_PROCESO["detalle"] = "Generando fotogramas, subtítulos y auto-sincronización lógica en la nube..."
        
        # Ejecuta el motor del generador pasándole las rutas como argumentos
        # Esto evita que el subproceso herede variables vacías
        resultado = subprocess.run(
            ["python", "generador_videos.py", "--config", config_path, "--audio", audio_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        if os.path.exists("video_output.mp4") and os.path.getsize("video_output.mp4") > 1000:
            ESTADO_PROCESO["status"] = "listo"
            ESTADO_PROCESO["detalle"] = "Video renderizado con éxito y alta fidelidad."
        else:
            ESTADO_PROCESO["status"] = "error"
            ESTADO_PROCESO["detalle"] = "El motor no generó el archivo 'video_output.mp4' o quedó vacío."
            
    except subprocess.CalledProcessError as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error en generador: {e.stderr if e.stderr else e.output}"
    except Exception as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Fallo interno en el servidor: {str(e)}"

@app.route('/renderizar', methods=['POST'])
def iniciar_renderizado():
    global ESTADO_PROCESO
    
    if ESTADO_PROCESO["status"] == "procesando":
        return jsonify({"message": "Hay un proceso en curso en Railway. Espera un momento.", "status": "procesando"}), 202

    try:
        # Limpieza previa de archivos de salida anteriores para evitar datos corruptos
        if os.path.exists("video_output.mp4"):
            try: os.remove("video_output.mp4")
            except: pass

        # 1. Guardar el archivo de Audio de fondo indispensable
        audio_file = request.files.get('audio')
        audio_path = os.path.join(UPLOAD_FOLDER, "audio_temp.mp3")
        if audio_file:
            audio_file.save(audio_path)
        else:
            audio_path = "" # Sin audio de fondo

        # 2. Recolectar datos y empaquetar la estructura visual que envía el Frontend
        linea_tiempo_raw = request.form.get('linea_tiempo', '[]')
        leyenda_portada = request.form.get('leyenda_portada', '')
        leyenda_cierre = request.form.get('leyenda_cierre', '')
        
        # Guardar archivos multimedia individuales enviados en el formulario (Imágenes / Videos)
        secuencia_procesada = []
        linea_tiempo_lista = json.loads(linea_tiempo_raw)
        
        for idx, item in enumerate(linea_tiempo_lista):
            file_key = f"media_{idx}"
            uploaded_file = request.files.get(file_key)
            
            if uploaded_file:
                filename = werkzeug.utils.secure_filename(uploaded_file.filename)
                local_path = os.path.join(UPLOAD_FOLDER, f"file_{idx}_{filename}")
                uploaded_file.save(local_path)
                
                secuencia_procesada.append({
                    "tipo": item.get("tipo"),
                    "ruta": local_path
                })

        # Procesar e indexar portadas y cierres si existen en el request
        portada_file = request.files.get('portada')
        ruta_portada = ""
        if portada_file:
            ruta_portada = os.path.join(UPLOAD_FOLDER, "portada_viam.png")
            portada_file.save(ruta_portada)

        cierre_file = request.files.get('cierre')
        ruta_cierre = ""
        if cierre_file:
            ruta_cierre = os.path.join(UPLOAD_FOLDER, "cierre_viam.png")
            cierre_file.save(ruta_cierre)

        # 3. Compilar la configuración en un JSON temporal para que el generador lo lea de golpe
        config_data = {
            "linea_tiempo": secuencia_procesada,
            "ruta_portada": ruta_portada,
            "ruta_cierre": ruta_cierre,
            "leyenda_portada": leyenda_portada,
            "leyenda_cierre": leyenda_cierre
        }
        
        config_json_path = os.path.join(UPLOAD_FOLDER, "render_config.json")
        with open(config_json_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=4)
            
        # ¡LA MAGIA! Arranca el renderizado en un hilo separado (segundo plano) en Railway
        hilo = threading.Thread(target=ejecutar_renderizador, args=(config_json_path, audio_path))
        hilo.start()
        
        return jsonify({"message": "Proceso de renderizado iniciado con éxito en la nube.", "status": "procesando"}), 200
        
    except Exception as e:
        return jsonify({"error": "No se pudo iniciar el renderizado", "detalle": str(e)}), 500

@app.route('/status', methods=['GET'])
def obtener_status():
    global ESTADO_PROCESO
    return jsonify(ESTADO_PROCESO)

@app.route('/descargar', methods=['GET'])
def descargar_video():
    global ESTADO_PROCESO
    video_output = "video_output.mp4"
    
    if os.path.exists(video_output) and os.path.getsize(video_output) > 1000:
        # El archivo está listo y es válido, procedemos al envío seguro
        response = send_file(video_output, mimetype="video/mp4", as_attachment=True, download_name="Video_Diamante_VIAM.mp4")
        
        # Reiniciamos el estado de la pizarra una vez descargado con éxito
        ESTADO_PROCESO = {"status": "libre", "detalle": ""}
        return response
    else:
        # Si el video no existe o falló, mandamos un código 404 estructurado
        # Esto evita que el frontend guarde texto de error plano como si fuera un video corrupto de 84 bytes
        return jsonify({"error": "El archivo de video no está listo o no existe en el servidor."}), 404

if __name__ == "__main__":
    # Escucha en el puerto dinámico que Railway le asigne para producción
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port) 
