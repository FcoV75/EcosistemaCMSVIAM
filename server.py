from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os
import json

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "temp_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ESTADO_PROCESO = {"status": "libre", "detalle": ""}

def ejecutar_renderizador(config_path, audio_path):
    global ESTADO_PROCESO
    try:
        ESTADO_PROCESO["status"] = "procesando"
        ESTADO_PROCESO["detalle"] = "Procesando video de fidelidad nativa en Railway..."
        
        resultado = subprocess.run(
            ["python", "generador_videos.py", "--config", config_path, "--audio", audio_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        if os.path.exists("video_output.mp4") and os.path.getsize("video_output.mp4") > 1000:
            ESTADO_PROCESO["status"] = "listo"
            ESTADO_PROCESO["detalle"] = "Video renderizado con éxito."
        else:
            ESTADO_PROCESO["status"] = "error"
            ESTADO_PROCESO["detalle"] = "No se generó el archivo de video final o está vacío."
            
    except subprocess.CalledProcessError as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Error en generador: {e.stderr if e.stderr else e.output}"
    except Exception as e:
        ESTADO_PROCESO["status"] = "error"
        ESTADO_PROCESO["detalle"] = f"Fallo imprevisto: {str(e)}"

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
        audio_path = os.path.join(UPLOAD_FOLDER, "audio_temp.mp3")
        if audio_file:
            audio_file.save(audio_path)
        else:
            audio_path = ""

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
        
        portada = request.files.get('portada')
        if portada:
            p_path = os.path.join(UPLOAD_FOLDER, "portada_temp.png")
            portada.save(p_path)
            config_data["ruta_portada"] = p_path

        cierre = request.files.get('cierre')
        if cierre:
            c_path = os.path.join(UPLOAD_FOLDER, "cierre_temp.png")
            cierre.save(c_path)
            config_data["ruta_cierre"] = c_path

        config_json_path = os.path.join(UPLOAD_FOLDER, "render_config.json")
        with open(config_json_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False)
            
        hilo = threading.Thread(target=ejecutar_renderizador, args=(config_json_path, audio_path))
        hilo.start()
        
        return jsonify({"message": "Iniciado correctamente.", "status": "procesando"}), 200
    except Exception as e:
        return jsonify({"error": "No se pudo iniciar el proceso", "detalle": str(e)}), 500

@app.route('/status', methods=['GET'])
def obtener_status():
    global ESTADO_PROCESO
    return jsonify(ESTADO_PROCESO)

@app.route('/descargar', methods=['GET'])
def descargar_video():
    global ESTADO_PROCESO
    video_output = "video_output.mp4"
    if os.path.exists(video_output) and os.path.getsize(video_output) > 1000:
        response = send_file(video_output, as_attachment=True)
        ESTADO_PROCESO = {"status": "libre", "detalle": ""}
        return response
    return jsonify({"error": "El archivo no existe o sigue procesándose."}), 404

if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False) 
