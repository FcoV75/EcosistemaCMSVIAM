from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os
import json

app = Flask(__name__)

# Permite de manera explícita tanto los dominios de Netlify como tu dominio personalizado
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://centromultidisciplinarioags.com",
            "http://centromultidisciplinarioags.com",
            "https://ecosistema-cms-viam-nexus.netlify.app"
        ],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Carpeta temporal del sistema Linux (con permisos de escritura garantizados en la nube)
UPLOAD_FOLDER = "/tmp/viam_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Aquí guardamos el estado del renderizado para que el frontend pueda preguntar cómo va
ESTADO_RENDER = {"status": "libre", "detalle": "Esperando proyecto..."}

def hilo_renderizador(config_path, audio_path, output_path):
    global ESTADO_RENDER
    try:
        ESTADO_RENDER["status"] = "procesando"
        ESTADO_RENDER["detalle"] = "Compilando transiciones fluidas y subtítulos en español estricto..."
        
        # Ejecuta el generador de manera independiente
        resultado = subprocess.run(
            ["python", "generador_videos.py", "--config", config_path, "--audio", audio_path, "--output", output_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            ESTADO_RENDER["status"] = "listo"
            ESTADO_RENDER["detalle"] = "¡Video Diamante renderizado con éxito!"
        else:
            ESTADO_RENDER["status"] = "error"
            ESTADO_RENDER["detalle"] = "El motor terminó pero el archivo de video final está vacío."
            
    except subprocess.CalledProcessError as e:
        ESTADO_RENDER["status"] = "error"
        ESTADO_RENDER["detalle"] = f"Error en el motor: {e.stderr if e.stderr else e.output}"
    except Exception as e:
        ESTADO_RENDER["status"] = "error"
        ESTADO_RENDER["detalle"] = f"Fallo inesperado: {str(e)}"

@app.route('/renderizar', methods=['POST', 'OPTIONS'])
def renderizar():
    # Manejo explícito de peticiones PREFLIGHT (OPTIONS) del navegador
    if request.method == 'OPTIONS':
        return '', 200
        
    global ESTADO_RENDER
    if ESTADO_RENDER["status"] == "procesando":
        return jsonify({"message": "Hay un proceso de renderizado en curso.", "status": "procesando"}), 202

    try:
        video_final_path = "/tmp/video_viam_output.mp4"
        if os.path.exists(video_final_path):
            try: os.remove(video_final_path)
            except: pass

        # 1. Guardar Audio temporal recibido
        audio_file = request.files.get('audio')
        audio_path = os.path.join(UPLOAD_FOLDER, "audio_temp.mp3")
        if audio_file:
            audio_file.save(audio_path)
        else:
            audio_path = ""

        # 2. Capturar datos de la línea de tiempo y textos
        linea_tiempo_raw = request.form.get('linea_tiempo', '[]')
        leyenda_portada = request.form.get('leyenda_portada', '')
        leyenda_cierre = request.form.get('leyenda_cierre', '')
        
        config_data = {
            "linea_tiempo": json.loads(linea_tiempo_raw),
            "ruta_portada": "",
            "ruta_cierre": "",
            "leyenda_portada": leyenda_portada,
            "leyenda_cierre": leyenda_cierre
        }
        
        # Guardar imágenes si existen de manera dinámica
        for key in request.files:
            if key.startswith("imagen_"):
                img_file = request.files[key]
                img_path = os.path.join(UPLOAD_FOLDER, f"{key}_temp.png")
                img_file.save(img_path)
                # Vincula de forma secuencial los elementos a tu lógica interna
                config_data["linea_tiempo"][int(key.split("_")[1])]["ruta"] = img_path

        config_json_path = os.path.join(UPLOAD_FOLDER, "render_config.json")
        with open(config_json_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False)
            
        # Lanzamos el renderizado en un hilo de fondo independiente
        hilo = threading.Thread(target=hilo_renderizador, args=(config_json_path, audio_path, video_final_path))
        hilo.start()
        
        return jsonify({"message": "Iniciado correctamente.", "status": "procesando"}), 200
        
    except Exception as e:
        return jsonify({"error": "No se pudo iniciar el renderizado", "detalle": str(e)}), 500

@app.route('/status', methods=['GET'])
def obtener_status():
    global ESTADO_RENDER
    return jsonify(ESTADO_RENDER)

@app.route('/descargar', methods=['GET'])
def descargar_video():
    global ESTADO_RENDER
    video_final_path = "/tmp/video_viam_output.mp4"
    if os.path.exists(video_final_path) and os.path.getsize(video_final_path) > 1000:
        response = send_file(video_final_path, as_attachment=True)
        # Reseteamos el estado para dejar libre el canal para el siguiente video
        ESTADO_RENDER = {"status": "libre", "detalle": "Esperando proyecto..."}
        return response
    return jsonify({"error": "El archivo de video no está listo o no existe."}), 404

if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False)
