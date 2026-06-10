from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os
import json

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

def _cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

@app.after_request
def after_request(response):
    return _cors_headers(response)

from werkzeug.exceptions import HTTPException

@app.errorhandler(HTTPException)
def handle_http_exception(e):
    resp = jsonify({"error": e.name, "detalle": e.description})
    resp.status_code = e.code
    return _cors_headers(resp)

@app.errorhandler(Exception)
def handle_exception(e):
    resp = jsonify({"error": "Error interno del servidor", "detalle": str(e)})
    resp.status_code = 500
    return _cors_headers(resp)

@app.errorhandler(413)
def handle_payload_too_large(e):
    resp = jsonify({"error": "Archivos demasiado grandes", "detalle": "El paquete supera el límite de 100 MB."})
    resp.status_code = 413
    return _cors_headers(resp)

UPLOAD_FOLDER = "/tmp/viam_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ESTADO_RENDER = {"status": "libre", "detalle": "Esperando proyecto..."}

def hilo_renderizador(config_path, audio_path, output_path):
    global ESTADO_RENDER
    try:
        ESTADO_RENDER["status"] = "procesando"
        ESTADO_RENDER["detalle"] = "Compilando transiciones fluidas y subtítulos en español estricto..."
        
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
        detalle = (e.stderr or e.stdout or str(e)).strip()
        ESTADO_RENDER["detalle"] = f"Error en el motor: {detalle[:500]}"
    except Exception as e:
        ESTADO_RENDER["status"] = "error"
        ESTADO_RENDER["detalle"] = f"Fallo inesperado: {str(e)}"

@app.route('/renderizar', methods=['POST', 'OPTIONS'])
def renderizar():
    if request.method == 'OPTIONS':
        return '', 200
        
    global ESTADO_RENDER
    if ESTADO_RENDER["status"] == "procesando":
        return jsonify({"message": "Hay un proceso de renderizado en curso.", "status": "procesando"}), 202

    # Permite reintentar tras un error previo
    if ESTADO_RENDER["status"] in ("error", "listo"):
        ESTADO_RENDER = {"status": "libre", "detalle": "Preparando nuevo proyecto..."}

    try:
        video_final_path = "/tmp/video_viam_output.mp4"
        if os.path.exists(video_final_path):
            try: os.remove(video_final_path)
            except: pass

        # 1. Guardar Audio temporal
        audio_file = request.files.get('audio')
        audio_path = os.path.join(UPLOAD_FOLDER, "audio_temp.mp3")
        if audio_file:
            audio_file.save(audio_path)
        else:
            audio_path = ""

        # 2. Capturar y validar la línea de tiempo de forma ultra-segura
        linea_tiempo_raw = request.form.get('linea_tiempo', '[]')
        
        # Procesamos el JSON asegurándonos de que termine como una lista de Python
        try:
            if isinstance(linea_tiempo_raw, str):
                linea_tiempo_procesada = json.loads(linea_tiempo_raw)
            else:
                linea_tiempo_procesada = linea_tiempo_raw
                
            if not isinstance(linea_tiempo_procesada, list):
                linea_tiempo_procesada = []
        except:
            linea_tiempo_procesada = []

        leyenda_portada = request.form.get('leyenda_portada', '')
        leyenda_cierre = request.form.get('leyenda_cierre', '')
        
        config_data = {
            "linea_tiempo": linea_tiempo_procesada,
            "ruta_portada": "",
            "ruta_cierre": "",
            "leyenda_portada": leyenda_portada,
            "leyenda_cierre": leyenda_cierre
        }
        
        # 3. Guardar imágenes dinámicas de forma blindada con expansión automática de la lista de control
        for key in request.files:
            if key.startswith("imagen_"):
                try:
                    indice = int(key.split("_")[1])
                    img_file = request.files[key]
                    nombre_orig = img_file.filename or f"img_{indice}.jpg"
                    extension = os.path.splitext(nombre_orig)[1].lower() or ".jpg"
                    if extension not in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
                        extension = ".jpg"
                    img_path = os.path.join(UPLOAD_FOLDER, f"img_{indice}_temp{extension}")
                    img_file.save(img_path)
                    
                    # BLINDAJE NUEVO: Si el índice no existe en la lista, expandimos dinámicamente para evitar desbordes
                    while len(config_data["linea_tiempo"]) <= indice:
                        config_data["linea_tiempo"].append({"id": len(config_data["linea_tiempo"]), "texto": "", "duracion": 5.0})
                    
                    config_data["linea_tiempo"][indice]["ruta"] = img_path
                except Exception as error_img:
                    print(f"Aviso procesando imagen individual: {error_img}")

        config_json_path = os.path.join(UPLOAD_FOLDER, "render_config.json")
        with open(config_json_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False)
            
        # Lanzamos el proceso pesado en el hilo de fondo
        hilo = threading.Thread(target=hilo_renderizador, args=(config_json_path, audio_path, video_final_path))
        hilo.start()
        
        return jsonify({"message": "Iniciado correctamente.", "status": "procesando"}), 200
        
    except Exception as e:
        # El servidor responde con un error 500 estructurado en vez de colapsar en silencio
        return jsonify({"error": "No se pudo iniciar el renderizado", "detalle": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    import shutil
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg = None
    return jsonify({
        "status": "ok" if ffmpeg else "degraded",
        "ffmpeg": ffmpeg or "no disponible"
    })

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
        ESTADO_RENDER = {"status": "libre", "detalle": "Esperando proyecto..."}
        return response
    return jsonify({"error": "El archivo de video no está listo o no existe."}), 404

if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False)
