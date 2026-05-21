from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os

app = Flask(__name__)
CORS(app)

# Diccionario global para rastrear el estado del renderizado
ESTADO_PROCESO = {"status": "libre", "detalle": ""}

def ejecutar_renderizador():
    global ESTADO_PROCESO
    try:
        ESTADO_PROCESO["status"] = "procesando"
        ESTADO_PROCESO["detalle"] = "Generando fotogramas y subtítulos..."
        
        # Ejecuta el script principal
        resultado = subprocess.run(
            ["python", "generador_videos.py"],
            capture_output=True,
            text=True,
            check=True
        )
        
        if os.path.exists("video_output.mp4"):
            ESTADO_PROCESO["status"] = "listo"
            ESTADO_PROCESO["detalle"] = "Video renderizado con éxito."
        else:
            ESTADO_PROCESO["status"] = "error"
            ESTADO_PROCESO["detalle"] = "No se encontró el archivo de video de salida."
            
    except subprocess.CalledProcessError as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error en generador: {e.stderr}"
    except Exception as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error inesperado: {str(e)}"

@app.route('/renderizar', methods=['POST'])
def renderizar():
    global ESTADO_PROCESO
    
    # Si ya hay un video procesándose, avisamos de inmediato
    if ESTADO_PROCESO["status"] == "procesando":
        return jsonify({"message": "Hay un proceso en curso. Espera un momento.", "status": "procesando"}), 202

    try:
        audio_file = request.files.get('audio')
        if audio_file:
            audio_file.save("audio_temp.mp3")
            
        # ¡LA MAGIA! Arranca el renderizado en un hilo separado (segundo plano)
        hilo = threading.Thread(target=ejecutar_renderizador)
        hilo.start()
        
        # Responde de inmediato al navegador en milisegundos para EVITAR EL 502
        return jsonify({"message": "Proceso de renderizado iniciado con éxito.", "status": "procesando"}), 200
        
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
    if os.path.exists(video_output):
        # Reiniciamos el estado para el siguiente video
        ESTADO_PROCESO = {"status": "libre", "detalle": ""}
        return send_file(video_output, as_attachment=True)
    else:
        return jsonify({"error": "El archivo de video no está listo o no existe."}), 404

if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False) 
