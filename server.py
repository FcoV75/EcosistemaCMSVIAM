from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "temp_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ESTADO_PROCESO = {"status": "libre", "detalle": ""}

def ejecutar_renderizador():
    global ESTADO_PROCESO
    try:
        ESTADO_PROCESO["status"] = "procesando"
        ESTADO_PROCESO["detalle"] = "Procesando video de fidelidad nativa en Railway..."
        
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
            ESTADO_PROCESO["detalle"] = "No se generó el archivo final de video."
            
    except subprocess.CalledProcessError as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error: {e.stderr}"
    except Exception as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Inesperado: {str(e)}"

@app.route('/renderizar', methods=['POST'])
def renderizar():
    global ESTADO_PROCESO
    if ESTADO_PROCESO["status"] == "procesando":
        return jsonify({"message": "Hay un proceso en curso.", "status": "procesando"}), 202

    try:
        if os.path.exists("video_output.mp4"):
            try: os.remove("video_output.mp4")
            except: pass

        audio_file = request.files.get('audio')
        if audio_file:
            audio_file.save(os.path.join(UPLOAD_FOLDER, "audio_temp.mp3"))
            
        hilo = threading.Thread(target=ejecutar_renderizador)
        hilo.start()
        
        return jsonify({"message": "Iniciado.", "status": "procesando"}), 200
    except Exception as e:
        return jsonify({"error": "Fallo", "detalle": str(e)}), 500

@app.route('/status', methods=['GET'])
def obtener_status():
    global ESTADO_PROCESO
    return jsonify(ESTADO_PROCESO)

@app.route('/descargar', methods=['GET'])
def descargar_video():
    global ESTADO_PROCESO
    video_output = "video_output.mp4"
    if os.path.exists(video_output):
        response = send_file(video_output, as_attachment=True)
        ESTADO_PROCESO = {"status": "libre", "detalle": ""}
        return response
    return jsonify({"error": "No listo"}), 404

if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False) 
