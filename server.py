from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import threading
import os
import json
import shutil
import re
import time

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
        ESTADO_RENDER["detalle"] = f"Error en el motor: {detalle[:900]}"
    except Exception as e:
        ESTADO_RENDER["status"] = "error"
        ESTADO_RENDER["detalle"] = f"Fallo inesperado: {str(e)}"


def _resolver_ffmpeg_bin():
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        return ffmpeg_bin
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _medir_duracion_audio(ruta, ffmpeg_bin=None):
    try:
        from mutagen import File as MutagenFile
        meta = MutagenFile(ruta)
        if meta and meta.info and getattr(meta.info, "length", None):
            return float(meta.info.length)
    except Exception:
        pass
    ffmpeg_bin = ffmpeg_bin or _resolver_ffmpeg_bin()
    if ffmpeg_bin and os.path.exists(ruta):
        try:
            res = subprocess.run([ffmpeg_bin, "-i", ruta], capture_output=True, text=True, check=False)
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", (res.stderr or "") + (res.stdout or ""))
            if m:
                h, mn, s = m.groups()
                return int(h) * 3600 + int(mn) * 60 + float(s)
        except Exception:
            pass
    return 180.0


def _preparar_audio_groq(ruta_entrada):
    """Normaliza a MP3 mono 16 kHz — formato más estable para Groq Whisper."""
    ffmpeg_bin = _resolver_ffmpeg_bin()
    if not ffmpeg_bin or not os.path.exists(ruta_entrada):
        return ruta_entrada, os.path.basename(ruta_entrada), "audio/mpeg"
    ruta_salida = os.path.join(UPLOAD_FOLDER, "transcribe_groq.mp3")
    res = subprocess.run([
        ffmpeg_bin, "-y", "-i", ruta_entrada,
        "-ar", "16000", "-ac", "1", "-b:a", "64k", "-map", "a:0", ruta_salida
    ], capture_output=True, text=True, check=False)
    if res.returncode == 0 and os.path.exists(ruta_salida) and os.path.getsize(ruta_salida) > 500:
        return ruta_salida, "audio_groq.mp3", "audio/mpeg"
    return ruta_entrada, os.path.basename(ruta_entrada), "audio/mpeg"


def _palabras_desde_texto(texto, duracion):
    if not texto or duracion <= 0:
        return []
    inicio = min(15.0, duracion * 0.06)
    fin = max(duracion - 12.0, inicio + 1.0)
    tokens = re.findall(r"\S+", texto.strip())
    if not tokens:
        return []
    paso = (fin - inicio) / len(tokens)
    t, palabras = inicio, []
    for tok in tokens:
        palabras.append({"start": round(t, 3), "end": round(t + paso, 3), "text": tok, "word": tok})
        t += paso
    return palabras


def _segmentos_desde_texto(texto, duracion):
    lineas = [ln.strip() for ln in texto.replace("\r", "").split("\n") if ln.strip()]
    if not lineas:
        lineas = [texto.strip()] if texto.strip() else []
    if not lineas:
        return []
    inicio = min(15.0, duracion * 0.06)
    fin = max(duracion - 12.0, inicio + 1.0)
    paso = (fin - inicio) / len(lineas)
    t, segs = inicio, []
    for ln in lineas:
        segs.append({"start": round(t, 3), "end": round(t + paso, 3), "text": ln})
        t += paso
    if segs:
        segs[-1]["end"] = round(fin, 3)
    return segs


def _error_groq_es_interno(mensaje):
    return "internal error" in str(mensaje or "").lower()


def _llamar_groq_whisper(groq_key, ruta, nombre, mime, modelo, response_format, extras=None):
    import requests as http_requests
    payload = [
        ("model", modelo),
        ("language", "es"),
        ("response_format", response_format),
        ("temperature", "0"),
    ]
    if extras:
        payload.extend(extras)
    with open(ruta, "rb") as f:
        resp = http_requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {groq_key}"},
            files={"file": (nombre, f, mime)},
            data=payload,
            timeout=300,
        )
    try:
        data = resp.json()
    except Exception:
        data = {"error": {"message": resp.text[:300]}}
    return resp, data


def _transcribir_groq_cascada(groq_key, ruta_audio, nombre, mime, duracion):
    """Varias estrategias: json simple primero (evita Internal Error de timestamps)."""
    estrategias = [
        ("whisper-large-v3-turbo", "json", None),
        ("whisper-large-v3-turbo", "verbose_json", None),
        ("whisper-large-v3", "json", None),
        ("whisper-large-v3", "verbose_json", None),
        ("whisper-large-v3", "verbose_json", [("timestamp_granularities[]", "word")]),
    ]
    ultimo_error = "Sin respuesta de Groq"
    for modelo, fmt, extras in estrategias:
        for intento in range(2):
            resp, data = _llamar_groq_whisper(groq_key, ruta_audio, nombre, mime, modelo, fmt, extras)
            if resp.ok:
                texto = (data.get("text") or "").strip()
                if not texto and fmt == "verbose_json":
                    texto = " ".join(
                        str(s.get("text", "")).strip() for s in data.get("segments", []) if s.get("text")
                    ).strip()
                if not texto:
                    ultimo_error = "Groq respondió vacío"
                    break
                palabras = data.get("words") or []
                segmentos = data.get("segments") or []
                if not palabras:
                    palabras = _palabras_desde_texto(texto, duracion)
                if not segmentos:
                    segmentos = _segmentos_desde_texto(texto, duracion)
                return {
                    "success": True,
                    "texto": texto,
                    "segmentos": segmentos,
                    "palabras": palabras,
                    "fuente": f"{modelo}/{fmt}",
                }
            ultimo_error = data.get("error", {}).get("message", str(data))
            if _error_groq_es_interno(ultimo_error) or resp.status_code >= 500:
                time.sleep(1.2 * (intento + 1))
                continue
            break
    raise RuntimeError(ultimo_error)


@app.route('/transcribir', methods=['POST', 'OPTIONS'])
def transcribir_audio():
    if request.method == 'OPTIONS':
        return '', 200

    audio = request.files.get('audio')
    if not audio or not audio.filename:
        return jsonify({"error": "No se recibió archivo de audio."}), 400

    groq_key = os.environ.get('GROQ_API_KEY')
    if not groq_key:
        return jsonify({
            "error": "GROQ_API_KEY no está configurada en Railway.",
            "detalle": "Agrégala en Variables del servicio ecosistemacmsviam."
        }), 500

    ext = os.path.splitext(audio.filename or "")[1].lower() or ".mp3"
    temp_entrada = os.path.join(UPLOAD_FOLDER, f"transcribe_in{ext}")
    temp_groq = os.path.join(UPLOAD_FOLDER, "transcribe_groq.mp3")
    audio.save(temp_entrada)

    try:
        duracion = _medir_duracion_audio(temp_entrada)
        ruta_groq, nombre_groq, mime_groq = _preparar_audio_groq(temp_entrada)
        resultado = _transcribir_groq_cascada(groq_key, ruta_groq, nombre_groq, mime_groq, duracion)
        return jsonify(resultado)
    except RuntimeError as e:
        return jsonify({"error": f"Transcripción fallida: {e}"}), 502
    except Exception as e:
        return jsonify({"error": "Error transcribiendo", "detalle": str(e)}), 500
    finally:
        for p in (temp_entrada, temp_groq):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass


@app.route('/estudio/letra', methods=['POST', 'OPTIONS'])
def estudio_generar_letra():
    if request.method == 'OPTIONS':
        return '', 200
    import requests as http_requests
    groq_key = os.environ.get('GROQ_API_KEY')
    if not groq_key:
        return jsonify({"error": "GROQ_API_KEY no configurada."}), 500
    body = request.get_json(silent=True) or {}
    tema = str(body.get("tema", "")).strip()
    genero = str(body.get("genero", "pop")).strip()
    mood = str(body.get("mood", "romántico")).strip()
    if not tema:
        return jsonify({"error": "Indica un tema para la letra."}), 400
    prompt = (
        f"Escribe la letra completa de una canción original en español latino.\n"
        f"Tema: {tema}\nGénero musical: {genero}\nEstado de ánimo: {mood}\n\n"
        "Reglas estrictas:\n"
        "- Solo la letra, sin títulos ni explicaciones.\n"
        "- Usa acentos y tildes correctos (á é í ó ú ñ).\n"
        "- Estructura clara: versos y estribillo separados por líneas en blanco.\n"
        "- Rima natural y cantable.\n"
        "- Entre 16 y 28 líneas."
    )
    modelos = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    ultimo = "Sin respuesta"
    for modelo in modelos:
        try:
            resp = http_requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": modelo,
                    "temperature": 0.75,
                    "messages": [
                        {"role": "system", "content": "Eres un compositor latinoamericano experto. Solo devuelves letra de canción."},
                        {"role": "user", "content": prompt},
                    ],
                },
                timeout=120,
            )
            data = resp.json()
            if resp.ok:
                letra = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
                if letra:
                    return jsonify({"success": True, "letra": letra, "modelo": modelo})
            ultimo = data.get("error", {}).get("message", str(data))
        except Exception as exc:
            ultimo = str(exc)
    return jsonify({"error": f"No se pudo generar letra: {ultimo}"}), 502


@app.route('/estudio/imagen', methods=['POST', 'OPTIONS'])
def estudio_generar_imagen():
    if request.method == 'OPTIONS':
        return '', 200
    import requests as http_requests
    from urllib.parse import quote
    body = request.get_json(silent=True) or {}
    prompt = str(body.get("prompt", "")).strip()
    if not prompt:
        return jsonify({"error": "Describe la imagen que deseas."}), 400
    prompt_en = f"{prompt}, cinematic lighting, high quality, 16:9 composition, no text, no watermark"
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            resp = http_requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key={gemini_key}",
                json={
                    "contents": [{"parts": [{"text": f"Genera una imagen fotográfica profesional: {prompt_en}"}]}],
                    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
                },
                timeout=120,
            )
            data = resp.json()
            if resp.ok:
                for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                    inline = part.get("inlineData") or part.get("inline_data")
                    if inline and inline.get("data"):
                        return jsonify({
                            "success": True,
                            "imagen_base64": inline["data"],
                            "mime": inline.get("mimeType") or inline.get("mime_type") or "image/png",
                            "fuente": "gemini",
                        })
        except Exception as exc:
            print(f"Gemini imagen falló: {exc}")
    url = f"https://image.pollinations.ai/prompt/{quote(prompt_en)}?width=1280&height=720&nologo=true&seed={abs(hash(prompt)) % 99999}"
    try:
        img = http_requests.get(url, timeout=90)
        if img.ok and img.content:
            import base64
            return jsonify({
                "success": True,
                "imagen_base64": base64.b64encode(img.content).decode("ascii"),
                "mime": img.headers.get("Content-Type", "image/jpeg"),
                "fuente": "pollinations",
            })
    except Exception as exc:
        return jsonify({"error": f"Error generando imagen: {exc}"}), 502
    return jsonify({"error": "No se pudo generar la imagen."}), 502


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
        letra_cancion = request.form.get('letra_cancion', '')
        letra_segmentos_raw = request.form.get('letra_segmentos', '[]')
        try:
            letra_segmentos = json.loads(letra_segmentos_raw) if isinstance(letra_segmentos_raw, str) else letra_segmentos_raw
            if not isinstance(letra_segmentos, list):
                letra_segmentos = []
        except Exception:
            letra_segmentos = []
        letra_palabras_raw = request.form.get('letra_palabras', '[]')
        try:
            letra_palabras = json.loads(letra_palabras_raw) if isinstance(letra_palabras_raw, str) else letra_palabras_raw
            if not isinstance(letra_palabras, list):
                letra_palabras = []
        except Exception:
            letra_palabras = []
        subtitulos_activos = request.form.get('subtitulos_activos', 'false').lower() == 'true'
        es_premium = request.form.get('es_premium', 'false').lower() == 'true'
        sin_marca_agua = request.form.get('sin_marca_agua', 'false').lower() == 'true'
        try:
            escala_texto = float(request.form.get('escala_texto', '6'))
        except (TypeError, ValueError):
            escala_texto = 6.0
        escala_texto = max(1.0, min(6.0, escala_texto))
        nombre_pista = request.form.get('nombre_pista', '')
        if not nombre_pista and audio_file and audio_file.filename:
            nombre_pista = os.path.splitext(os.path.basename(audio_file.filename))[0]

        config_data = {
            "linea_tiempo": linea_tiempo_procesada,
            "ruta_portada": "",
            "ruta_cierre": "",
            "leyenda_portada": leyenda_portada,
            "leyenda_cierre": leyenda_cierre,
            "letra_cancion": letra_cancion,
            "letra_segmentos": letra_segmentos,
            "letra_palabras": letra_palabras,
            "subtitulos_activos": subtitulos_activos,
            "es_premium": es_premium,
            "sin_marca_agua": sin_marca_agua,
            "escala_texto": escala_texto,
            "nombre_pista": nombre_pista
        }

        def guardar_archivo(file_storage, prefijo, extension_default):
            nombre_orig = file_storage.filename or prefijo
            extension = os.path.splitext(nombre_orig)[1].lower() or extension_default
            ruta = os.path.join(UPLOAD_FOLDER, f"{prefijo}{extension}")
            file_storage.save(ruta)
            return ruta

        portada_file = request.files.get('portada_file')
        if portada_file and portada_file.filename:
            config_data["ruta_portada"] = guardar_archivo(portada_file, "portada_temp", ".jpg")

        cierre_file = request.files.get('cierre_file')
        if cierre_file and cierre_file.filename:
            config_data["ruta_cierre"] = guardar_archivo(cierre_file, "cierre_temp", ".jpg")

        for key in request.files:
            if key.startswith("imagen_"):
                try:
                    indice = int(key.split("_")[1])
                    media_file = request.files[key]
                    nombre_orig = media_file.filename or f"media_{indice}.jpg"
                    extension = os.path.splitext(nombre_orig)[1].lower() or ".jpg"
                    if extension in (".mp4", ".mov", ".webm", ".avi"):
                        media_path = os.path.join(UPLOAD_FOLDER, f"video_{indice}_temp{extension}")
                        tipo = "video"
                    else:
                        if extension not in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
                            extension = ".jpg"
                        media_path = os.path.join(UPLOAD_FOLDER, f"img_{indice}_temp{extension}")
                        tipo = "imagen"
                    media_file.save(media_path)
                    while len(config_data["linea_tiempo"]) <= indice:
                        config_data["linea_tiempo"].append({
                            "id": len(config_data["linea_tiempo"]), "texto": "", "duracion": 5.0, "tipo": "imagen"
                        })
                    config_data["linea_tiempo"][indice]["ruta"] = media_path
                    config_data["linea_tiempo"][indice]["tipo"] = tipo
                except Exception as error_img:
                    print(f"Aviso procesando media {key}: {error_img}")

            elif key.startswith("video_"):
                try:
                    indice = int(key.split("_")[1])
                    media_file = request.files[key]
                    extension = os.path.splitext(media_file.filename or "")[1].lower() or ".mp4"
                    media_path = os.path.join(UPLOAD_FOLDER, f"video_{indice}_temp{extension}")
                    media_file.save(media_path)
                    while len(config_data["linea_tiempo"]) <= indice:
                        config_data["linea_tiempo"].append({
                            "id": len(config_data["linea_tiempo"]), "texto": "", "duracion": 5.0, "tipo": "video"
                        })
                    config_data["linea_tiempo"][indice]["ruta"] = media_path
                    config_data["linea_tiempo"][indice]["tipo"] = "video"
                except Exception as error_vid:
                    print(f"Aviso procesando video {key}: {error_vid}")

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
