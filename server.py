from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os

app = Flask(__name__)
CORS(app)

# Diccionario global para rastrear el estado del renderizado [cite: 1]
ESTADO_PROCESO = {"status": "libre", "detalle": ""}

def ejecutar_renderizador():
    global ESTADO_PROCESO
    try:
        ESTADO_PROCESO["status"] = "procesando"
        ESTADO_PROCESO["detalle"] = "Generando fotogramas y subtítulos en segundo plano..."
        
        # Ejecuta el script principal del motor de video [cite: 2]
        resultado = subprocess.run(
            ["python", "generador_videos.py"],
            capture_output=True,
            text=True,
            check=True
        )
        
        if os.path.exists("video_output.mp4"): [cite: 3]
            ESTADO_PROCESO["status"] = "listo"
            ESTADO_PROCESO["detalle"] = "Video renderizado con éxito."
        else:
            ESTADO_PROCESO["status"] = "error"
            ESTADO_PROCESO["detalle"] = "No se encontró el archivo de video de salida." [cite: 3]
            
    except subprocess.CalledProcessError as e: [cite: 4]
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error en generador: {e.stderr}" [cite: 4]
    except Exception as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error inesperado: {str(e)}"

@app.route('/renderizar', methods=['POST'])
def renderizar():
    global ESTADO_PROCESO
    
    # Si ya hay un video procesándose, avisamos de inmediato [cite: 5]
    if ESTADO_PROCESO["status"] == "procesando": [cite: 5]
        return jsonify({"message": "Hay un proceso en curso. Espera un momento.", "status": "procesando"}), 202 [cite: 5]

    try:
        # Asegurar limpieza de residuos antes de procesar
        if os.path.exists("video_output.mp4"):
            try: os.remove("video_output.mp4")
            except: pass

        audio_file = request.files.get('audio')
        if audio_file:
            audio_file.save("audio_temp.mp3")
            
        # Arranca el renderizado en un hilo separado (segundo plano) para evitar el error 502 [cite: 6]
        hilo = threading.Thread(target=ejecutar_renderizador)
        hilo.start()
        
        return jsonify({"message": "Proceso de renderizado iniciado con éxito.", "status": "procesando"}), 200
        
    except Exception as e:
        return jsonify({"error": "No se pudo iniciar el renderizado", "detalle": str(e)}), 500 [cite: 7]

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
        # Reiniciamos el estado para el siguiente video libremente
        ESTADO_PROCESO = {"status": "libre", "detalle": ""}
        return response
    else:
        # Retorna error estructurado en vez de un archivo falso corrupto
        return jsonify({"error": "El archivo de video no está listo o no existe."}), 404

if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000)) [cite: 8]
    app.run(host='0.0.0.0', port=puerto, debug=False) [cite: 8]
