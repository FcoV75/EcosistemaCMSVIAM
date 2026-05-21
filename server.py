from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import os

app = Flask(__name__)
CORS(app)  # Permite la comunicación limpia con la web de Netlify

@app.route('/renderizar', methods=['POST'])
def renderizar():
    try:
        print("🎬 Interfaz web conectada. Recibiendo archivos...")
        
        # 1. Guardar temporalmente el audio si es que llegó de la web
        audio_file = request.files.get('audio')
        if audio_file:
            audio_file.save("audio_temp.mp3")
            print("🎵 Audio de fondo guardado temporalmente.")
            
        print("⚡ Ejecutando motor gráfico de forma silenciosa en segundo plano...")
        
        # 2. Ejecutar tu script principal directo sin abrir ventanas estorbosas
        resultado = subprocess.run(
            ["python", "generador_videos.py"],
            capture_output=True,
            text=True,
            check=True
        )
        
        print("✅ ¡Motor de Python finalizado con éxito!")
        print("📺 Salida del script:", resultado.stdout)
        
        # 3. Buscar el video generado (Si tu script arroja otro nombre, cámbialo aquí)
        video_output = "video_output.mp4"
        
        if os.path.exists(video_output):
            return send_file(video_output, as_attachment=True)
        else:
            return jsonify({"error": "El script corrió pero no se encontró el archivo de video final."}), 500
            
    except subprocess.CalledProcessError as e:
        print("❌ Error crítico dentro de generador_videos.py:")
        print(e.stderr)
        return jsonify({"error": "Error al ejecutar el generador interno", "detalle": e.stderr}), 500
        
    except Exception as e:
        print(f"❌ Error general en el servidor puente: {str(e)}")
        return jsonify({"error": "Error inesperado en el servidor", "detalle": str(e)}), 500

if __name__ == '__main__':
    # Lee el puerto que le asigna Railway, y si no existe usa el 5000
    puerto = int(os.environ.get("PORT", 5000))
    # Escucha en el host 0.0.0.0 para permitir conexiones externas públicas
    app.run(host='0.0.0.0', port=puerto, debug=True)