from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import os
from flask_cors import CORS
# 1. Definición global de la aplicación (Crucial para la nube)
app = Flask(__name__)
CORS(app)
# Permite que la web de Netlify se conecte de forma pública y segura
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/renderizar', methods=['POST'])
def renderizar():
    try:
        audio_file = request.files.get('audio')
        if audio_file:
            audio_file.save("audio_temp.mp3")
            
        resultado = subprocess.run(
            ["python", "generador_videos.py"],
            capture_output=True,
            text=True,
            check=True
        )
        
        video_output = "video_output.mp4"
        if os.path.exists(video_output):
            return send_file(video_output, as_attachment=True)
        else:
            return jsonify({"error": "No se encontró el archivo de video final."}), 500
            
    except subprocess.CalledProcessError as e:
        return jsonify({"error": "Error en el generador", "detalle": e.stderr}), 500
    except Exception as e:
        return jsonify({"error": "Error inesperado", "detalle": str(e)}), 500

# Este bloque se mantiene para cuando hagas pruebas locales en tu PC
if __name__ == '__main__':
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=puerto, debug=False) 
