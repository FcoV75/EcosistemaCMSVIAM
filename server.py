from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import os

app = Flask(__name__)

# BLINDAJE CORS: Permite que absolutamente cualquier petición de Netlify entre sin bloqueos
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/renderizar', methods=['POST'])
def renderizar():
    try:
        print("🎬 Petición recibida en la nube. Validando archivos...")
        
        # Guardar audio eficientemente en el contenedor de la nube
        audio_file = request.files.get('audio')
        if audio_file:
            audio_file.save("audio_temp.mp3")
            
        print("⚡ Iniciando procesamiento del motor gráfico (Modo Silencioso)...")
        
        # Ejecuta el script de manera interna en el servidor de Railway
        resultado = subprocess.run(
            ["python", "generador_videos.py"],
            capture_output=True,
            text=True,
            check=True
        )
        
        video_output = "video_output.mp4"
        if os.path.exists(video_output):
            print("✅ Video compilado con éxito. Enviando al cliente...")
            return send_file(video_output, as_attachment=True)
        else:
            return jsonify({"error": "No se encontró el archivo de video final en el servidor."}), 500
            
    except subprocess.CalledProcessError as e:
        print("❌ Error en el script interno:", e.stderr)
        return jsonify({"error": "Error en el generador", "detalle": e.stderr}), 500
    except Exception as e:
        print("❌ Error general:", str(e))
        return jsonify({"error": "Error inesperado", "detalle": str(e)}), 500

if __name__ == '__main__':
    # Lee el puerto dinámico exacto asignado por el servidor de Railway
    puerto = int(os.environ.get("PORT", 8080))
    # Escucha en 0.0.0.0 para abrir de forma segura la red pública
    app.run(host='0.0.0.0', port=puerto, debug=False) 
